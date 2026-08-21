/**
 * Cloudflare Worker — proxy da API SGS do Bacen (CORS liberado).
 *
 * Deploy:
 *   1. Cloudflare Dashboard → Workers → Create
 *   2. Cole este arquivo
 *   3. Aponte o frontend (VITE_BACEN_PROXY ou fetchBacenRate) para a URL do Worker
 *
 * POST JSON: { "contractDate": "2024-06" }
 * GET  ?contractDate=2024-06
 */

const SERIES_MONTHLY = 25471;
const SERIES_ANNUAL = 20749;
const SERIES_LABEL =
  "Aquisição de veículos — PF — recursos livres (SGS 25471 mensal / 20749 anual)";

const FALLBACK = {
  monthlyRate: 1.97,
  annualRate: 26.44,
  period: "junho de 2026",
  observedAt: "01/06/2026",
  seriesName: SERIES_LABEL,
  ratesConsistent: true,
  impliedAnnual: 26.44,
  history: [],
  source: "cache",
};

const MESES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "public, max-age=3600",
  };
}

function parseYm(brDate) {
  const [d, m, y] = brDate.split("/");
  return `${y}-${m}`;
}

function monthLabel(ym) {
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return ym;
  return `${MESES[m - 1]} de ${y}`;
}

async function fetchSeries(code) {
  const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${code}/dados?formato=json&dataInicial=01/01/2017&dataFinal=01/12/2030`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`SGS ${code}`);
  return res.json();
}

function nearest(points, targetYm) {
  if (!points?.length) return null;
  let best = points[0];
  let bestDiff = Infinity;
  for (const p of points) {
    const ym = parseYm(p.data);
    const diff = Math.abs(
      new Date(`${ym}-01`).getTime() - new Date(`${targetYm}-01`).getTime(),
    );
    if (diff < bestDiff) {
      bestDiff = diff;
      best = p;
    }
  }
  return best;
}

async function handle(contractDate) {
  if (!/^\d{4}-\d{2}$/.test(contractDate || "")) {
    return new Response(JSON.stringify({ error: "Use AAAA-MM" }), {
      status: 400,
      headers: { ...corsHeaders(), "Content-Type": "application/json" },
    });
  }
  try {
    const [monthly, annual] = await Promise.all([
      fetchSeries(SERIES_MONTHLY),
      fetchSeries(SERIES_ANNUAL),
    ]);
    const monthlyPoint = nearest(monthly, contractDate);
    if (!monthlyPoint) {
      return Response.json(
        { ...FALLBACK, period: monthLabel(contractDate) },
        { headers: corsHeaders() },
      );
    }
    const ym = parseYm(monthlyPoint.data);
    const annualPoint = nearest(annual, ym);
    const monthlyRate = Number(monthlyPoint.valor);
    const annualRate = annualPoint ? Number(annualPoint.valor) : null;
    const impliedAnnual = (Math.pow(1 + monthlyRate / 100, 12) - 1) * 100;
    const ratesConsistent =
      annualRate != null &&
      Math.abs(impliedAnnual - annualRate) / Math.max(Math.abs(impliedAnnual), 0.01) <= 0.15;
    const history = monthly
      .map((p) => ({ month: parseYm(p.data), monthlyRate: Number(p.valor) }))
      .filter((p) => Number.isFinite(p.monthlyRate))
      .slice(-12);

    return Response.json(
      {
        monthlyRate,
        annualRate,
        impliedAnnual: Number(impliedAnnual.toFixed(4)),
        ratesConsistent,
        period: monthLabel(ym),
        observedAt: monthlyPoint.data,
        seriesName: SERIES_LABEL,
        history,
        source: "bacen",
      },
      { headers: corsHeaders() },
    );
  } catch {
    return Response.json(
      { ...FALLBACK, period: monthLabel(contractDate) || FALLBACK.period },
      { headers: corsHeaders() },
    );
  }
}

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }
    let contractDate = "";
    if (request.method === "GET") {
      contractDate = new URL(request.url).searchParams.get("contractDate") || "";
    } else if (request.method === "POST") {
      const body = await request.json().catch(() => ({}));
      contractDate = body.contractDate || "";
    } else {
      return new Response("Method not allowed", { status: 405, headers: corsHeaders() });
    }
    return handle(contractDate);
  },
};
