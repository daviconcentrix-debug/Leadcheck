import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createHmac, timingSafeEqual } from "crypto";

const SESSION_HOURS = 12;

function getPassword() {
  return (process.env.BACKOFFICE_PASSWORD || "").trim();
}

function getSecret() {
  return (process.env.BACKOFFICE_SECRET || getPassword() || "parcela-justa-dev-secret").trim();
}

function sign(payload: string) {
  return createHmac("sha256", getSecret()).update(payload).digest("hex");
}

function issueToken() {
  const exp = Date.now() + SESSION_HOURS * 60 * 60 * 1000;
  const nonce = Math.random().toString(36).slice(2, 12);
  const body = `${exp}.${nonce}`;
  return { token: `${body}.${sign(body)}`, expiresAt: exp };
}

export function verifyToken(token: string | undefined | null): boolean {
  if (!token || typeof token !== "string") return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [expStr, nonce, sig] = parts;
  const body = `${expStr}.${nonce}`;
  const expected = sign(body);
  try {
    const a = Buffer.from(sig, "utf8");
    const b = Buffer.from(expected, "utf8");
    if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  } catch {
    return false;
  }
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || Date.now() > exp) return false;
  return true;
}

function safeEqual(a: string, b: string) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) {
    timingSafeEqual(ba, ba);
    return false;
  }
  return timingSafeEqual(ba, bb);
}

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "GET") {
    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : (req.query.token as string) || "";
    const ok = verifyToken(token);
    return res.status(ok ? 200 : 401).json({ ok });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const password = getPassword();
  if (!password) {
    return res.status(503).json({
      ok: false,
      error:
        "BACKOFFICE_PASSWORD não configurada no servidor. Defina a variável de ambiente no Vercel (Project → Settings → Environment Variables).",
    });
  }

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  const given = String(body.password || "");

  if (!given || !safeEqual(given, password)) {
    return res.status(401).json({ ok: false, error: "Senha incorreta." });
  }

  const session = issueToken();
  return res.status(200).json({ ok: true, ...session });
}
