import type { VercelRequest, VercelResponse } from "@vercel/node";

/** Catálogo veículos PF — alinhado a sgs-peritos / uso pericial */
const SERIES_MONTHLY = 25471; // % a.m. aquisição veículos PF recursos livres
const SERIES_ANNUAL = 20749; // % a.a. mesma modalidade
const SERIES_LABEL =
  "Aquisição de veículos — PF — recursos livres (SGS 25471 mensal / 20749 anual)";

type RawPoint = { data: string; valor: string };

const FALLBACK = {
  monthlyRate: 1.97,
  annualRate: 26.44,
  period: "junho de 2026",
  observedAt: "01/06/2026",
  seriesName: SERIES_LABEL,
  history: [
    { month: "2025-07", monthlyRate: 2.03 },
    { month: "2025-08", monthlyRate: 2.03 },
    { month: "2025-09", monthlyRate: 2.03 },
    { month: "2025-10", monthlyRate: 2.04 },
    { month: "2025-11", monthlyRate: 2.01 },
    { month: "2025-12", monthlyRate: 1.97 },
    { month: "2026-01", monthlyRate: 2.06 },
    { month: "2026-02", monthlyRate: 2.03 },
    { month: "2026-03", monthlyRate: 1.98 },
    { month: "2026-04", monthlyRate: 1.99 },
    { month: "2026-05", monthlyRate: 1.97 },
    { month: "2026-06", monthlyRate: 1.97 },
  ],
  ratesConsistent: true,
  impliedAnnual: 26.44,
  source: "cache" as const,
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

function monthLabel(yearMonth: string) {
  const [year, month] = yearMonth.split("-").map(Number);
  if (!year || !month) return yearMonth;
  return `${MESES[month - 1]} de ${year}`;
}

function parseYm(brDate: string) {
  const [, mm, yyyy] = brDate.split("/");
  return `${yyyy}-${mm}`;
}

function monthDistance(a: string, b: string) {
  const [ay, am] = a.split("-").map(Number);
  const [by, bm] = b.split("-").map(Number);
  return Math.abs(ay * 12 + am - (by * 12 + bm));
}

function nearest(points: RawPoint[], yearMonth: string): RawPoint | null {
  if (!points.length) return null;
  const exact = points.find((p) => parseYm(p.data) === yearMonth);
  if (exact) return exact;
  return points.reduce((best, point) => {
    const bestDist = monthDistance(parseYm(best.data), yearMonth);
    const dist = monthDistance(parseYm(point.data), yearMonth);
    return dist < bestDist ? point : best;
  });
}

async function fetchSeries(code: number, start: string, end: string): Promise<RawPoint[]> {
  const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${code}/dados?formato=json&dataInicial=${encodeURIComponent(start)}&dataFinal=${encodeURIComponent(end)}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`Bacen ${code} ${res.status}`);
  const json = (await res.json()) as RawPoint[];
  return Array.isArray(json) ? json : [];
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const contractDate = String(req.body?.contractDate || "").trim();
  if (!/^\d{4}-\d{2}$/.test(contractDate)) {
    return res.status(400).json({ error: "Use o formato AAAA-MM" });
  }

  try {
    const [monthly, annual] = await Promise.all([
      fetchSeries(SERIES_MONTHLY, "01/01/2017", "01/12/2030"),
      fetchSeries(SERIES_ANNUAL, "01/01/2017", "01/12/2030"),
    ]);

    const monthlyPoint = nearest(monthly, contractDate);
    if (!monthlyPoint) {
      return res.status(200).json({ ...FALLBACK, period: monthLabel(contractDate) });
    }

    const ym = parseYm(monthlyPoint.data);
    const annualPoint = nearest(annual, ym);
    const history = monthly
      .map((point) => ({
        month: parseYm(point.data),
        monthlyRate: Number(point.valor),
      }))
      .filter((point) => Number.isFinite(point.monthlyRate))
      .slice(-12);

    const monthlyRate = Number(monthlyPoint.valor);
    const annualRate = annualPoint ? Number(annualPoint.valor) : null;
    const impliedAnnual =
      Number.isFinite(monthlyRate) ? (Math.pow(1 + monthlyRate / 100, 12) - 1) * 100 : null;
    const ratesConsistent =
      annualRate != null &&
      impliedAnnual != null &&
      Math.abs(impliedAnnual - annualRate) / Math.max(Math.abs(impliedAnnual), 0.01) <= 0.15;

    return res.status(200).json({
      monthlyRate,
      annualRate,
      impliedAnnual: impliedAnnual != null ? Number(impliedAnnual.toFixed(4)) : null,
      ratesConsistent,
      period: monthLabel(ym),
      observedAt: monthlyPoint.data,
      seriesName: SERIES_LABEL,
      history,
      source: "bacen",
    });
  } catch {
    return res.status(200).json({
      ...FALLBACK,
      period: monthLabel(contractDate) || FALLBACK.period,
    });
  }
}
