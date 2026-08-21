/**
 * CET / TAEG aproximados a partir da taxa nominal mensal do contrato
 * e custos extras (seguro, tarifas) informados ou estimados.
 *
 * CET oficial exige fluxo de caixa completo do contrato.
 * Aqui oferecemos uma aproximação orientativa para o pré-laudo.
 */

/** Taxa efetiva anual a partir da mensal nominal: (1 + i_m)^12 - 1 */
export function annualEffectiveFromMonthly(monthlyPercent: number) {
  return (Math.pow(1 + monthlyPercent / 100, 12) - 1) * 100;
}

/** Taxa mensal equivalente a partir da anual efetiva */
export function monthlyFromAnnualEffective(annualPercent: number) {
  return (Math.pow(1 + annualPercent / 100, 1 / 12) - 1) * 100;
}

/**
 * Aproxima CET incluindo custo extra diluído no principal.
 * extrasTotal = soma de tarifas/seguros embutidos ou pagos no início.
 */
export function approximateCet(opts: {
  principal: number;
  monthlyRatePercent: number;
  months: number;
  extrasTotal?: number;
}) {
  const principal = opts.principal;
  const extras = Math.max(0, opts.extrasTotal ?? 0);
  const months = opts.months;
  const i = opts.monthlyRatePercent / 100;

  if (principal <= 0 || months <= 0) {
    return { cetMonthly: 0, cetAnnual: 0, installment: 0 };
  }

  // Prestação Price sobre o principal
  const f = Math.pow(1 + i, months);
  const installment = i === 0 ? principal / months : (principal * (i * f)) / (f - 1);

  // Valor presente dos pagamentos com taxa "cet" deve igualar principal + extras
  const target = principal + extras;
  if (extras <= 0) {
    const cetAnnual = annualEffectiveFromMonthly(opts.monthlyRatePercent);
    return {
      cetMonthly: opts.monthlyRatePercent,
      cetAnnual,
      installment,
    };
  }

  // Busca binária da taxa mensal que faz NPV(parcelas) = target
  let lo = 0;
  let hi = 0.2; // 20% a.m. teto absurdo
  for (let k = 0; k < 48; k++) {
    const mid = (lo + hi) / 2;
    const ff = Math.pow(1 + mid, months);
    const pmt = mid === 0 ? target / months : installment; // usamos a mesma prestação do contrato
    // PV das n prestações à taxa mid
    const pv = mid === 0 ? pmt * months : (pmt * (1 - Math.pow(1 + mid, -months))) / mid;
    if (pv > target) lo = mid;
    else hi = mid;
  }
  const cetMonthly = ((lo + hi) / 2) * 100;
  return {
    cetMonthly,
    cetAnnual: annualEffectiveFromMonthly(cetMonthly),
    installment,
  };
}

export function formatCet(monthly: number, annual: number) {
  const m = monthly.toFixed(2).replace(".", ",");
  const a = annual.toFixed(2).replace(".", ",");
  return `${m}% a.m. · ${a}% a.a. (aprox.)`;
}
