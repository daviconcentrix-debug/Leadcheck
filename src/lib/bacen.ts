export type BacenPoint = {
  month: string;
  monthlyRate: number;
};

export type BacenResult = {
  monthlyRate: number;
  annualRate: number | null;
  period: string;
  observedAt: string;
  seriesName: string;
  history: BacenPoint[];
  source: "bacen" | "cache";
};

const FALLBACK: BacenResult = {
  monthlyRate: 1.97,
  annualRate: 26.44,
  period: "junho de 2026",
  observedAt: "01/06/2026",
  seriesName: "Aquisição de veículos — recursos livres (SGS 25471 / 20749)",
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
  source: "cache",
};

export async function fetchBacenRate(contractDate: string): Promise<BacenResult> {
  try {
    const res = await fetch("/api/bacen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contractDate }),
    });
    if (!res.ok) throw new Error("Falha na consulta Bacen");
    return (await res.json()) as BacenResult;
  } catch {
    return { ...FALLBACK, period: contractDate };
  }
}
