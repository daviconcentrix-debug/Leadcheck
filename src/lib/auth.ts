const TOKEN_KEY = "parcela-justa-bo-token";
const EXP_KEY = "parcela-justa-bo-exp";

export function getBackofficeToken() {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function clearBackofficeSession() {
  try {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(EXP_KEY);
  } catch {
    /* ignore */
  }
}

export function saveBackofficeSession(token: string, expiresAt: number) {
  sessionStorage.setItem(TOKEN_KEY, token);
  sessionStorage.setItem(EXP_KEY, String(expiresAt));
}

export function hasLocalSession() {
  const token = getBackofficeToken();
  const exp = Number(sessionStorage.getItem(EXP_KEY) || 0);
  if (!token || !exp || Date.now() > exp) {
    clearBackofficeSession();
    return false;
  }
  return true;
}

export async function loginBackoffice(password: string) {
  const res = await fetch("/api/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  const data = (await res.json()) as {
    ok: boolean;
    token?: string;
    expiresAt?: number;
    error?: string;
  };
  if (!res.ok || !data.ok || !data.token || !data.expiresAt) {
    throw new Error(data.error || "Falha na autenticação.");
  }
  saveBackofficeSession(data.token, data.expiresAt);
  return data;
}

export async function verifyBackofficeSession() {
  const token = getBackofficeToken();
  if (!token || !hasLocalSession()) return false;
  try {
    const res = await fetch("/api/auth", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      clearBackofficeSession();
      return false;
    }
    const data = (await res.json()) as { ok: boolean };
    if (!data.ok) clearBackofficeSession();
    return !!data.ok;
  } catch {
    // Offline: confia no token local ainda válido (exp)
    return hasLocalSession();
  }
}

/**
 * Dev local sem serverless: senha só em memória de build NÃO fica no bundle.
 * Em localhost sem /api/auth, aceita se o usuário definiu VITE_BACKOFFICE_DEV_PASSWORD
 * no .env.local (nunca commitado). Produção sempre usa /api/auth.
 */
export async function loginBackofficeSmart(password: string) {
  try {
    return await loginBackoffice(password);
  } catch (err) {
    const isLocal = typeof window !== "undefined" && /localhost|127\.0\.0\.1/.test(window.location.hostname);
    const devPass = import.meta.env.VITE_BACKOFFICE_DEV_PASSWORD as string | undefined;
    if (isLocal && devPass && password === devPass) {
      const expiresAt = Date.now() + 12 * 60 * 60 * 1000;
      const token = `dev.${expiresAt}.local`;
      saveBackofficeSession(token, expiresAt);
      return { ok: true, token, expiresAt };
    }
    throw err;
  }
}
