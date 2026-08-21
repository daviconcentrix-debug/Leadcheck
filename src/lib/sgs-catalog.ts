/**
 * Catálogo curado de séries SGS (Bacen) — modalidade veículos PF.
 * Códigos alinhados ao uso pericial (média de mercado, recursos livres).
 */
export type SgsSeries = {
  id: string;
  code: number;
  label: string;
  unit: "am" | "aa";
  modality: "veiculos_pf";
};

export const SGS_VEICULOS_PF = {
  mensal: {
    id: "pf_veiculos_mensal",
    code: 25471,
    label: "Aquisição de veículos — PF — recursos livres (% a.m.)",
    unit: "am" as const,
    modality: "veiculos_pf" as const,
  },
  anual: {
    id: "pf_veiculos_anual",
    code: 20749,
    label: "Aquisição de veículos — PF — recursos livres (% a.a.)",
    unit: "aa" as const,
    modality: "veiculos_pf" as const,
  },
};

export const SGS_CATALOG: SgsSeries[] = [SGS_VEICULOS_PF.mensal, SGS_VEICULOS_PF.anual];

export function seriesLabel(code: number) {
  return SGS_CATALOG.find((s) => s.code === code)?.label ?? `SGS ${code}`;
}

/** Verifica se anual ≈ (1 + mensal/100)^12 - 1 (tolerância 15%). */
export function ratesAreConsistent(monthly: number, annual: number) {
  const implied = (Math.pow(1 + monthly / 100, 12) - 1) * 100;
  if (implied === 0) return Math.abs(annual) < 0.5;
  return Math.abs(implied - annual) / Math.max(Math.abs(implied), 0.01) <= 0.15;
}
