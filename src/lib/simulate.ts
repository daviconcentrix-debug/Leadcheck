/**
 * PMT e simulação "se a taxa fosse a média Bacen".
 * Fórmula clássica de prestação (sistema Price):
 * PMT = P × [i (1+i)^n] / [(1+i)^n − 1]
 */
export function monthlyRateFromAnnual(annualPercent: number) {
  return annualPercent / 100 / 12;
}

export function monthlyRateFromMonthly(monthlyPercent: number) {
  return monthlyPercent / 100;
}

export function pmt(principal: number, monthlyRate: number, months: number) {
  if (principal <= 0 || months <= 0) return 0;
  if (monthlyRate === 0) return principal / months;
  const f = Math.pow(1 + monthlyRate, months);
  return (principal * (monthlyRate * f)) / (f - 1);
}

export function totalPaid(installment: number, months: number) {
  return installment * months;
}

export function totalInterest(principal: number, installment: number, months: number) {
  return Math.max(0, totalPaid(installment, months) - principal);
}

/**
 * Estima o principal a partir da parcela atual e de uma taxa mensal.
 * Inverso aproximado do PMT (útil quando o cliente só informa a parcela).
 */
export function principalFromPmt(installment: number, monthlyRate: number, months: number) {
  if (installment <= 0 || months <= 0) return 0;
  if (monthlyRate === 0) return installment * months;
  const f = Math.pow(1 + monthlyRate, months);
  return (installment * (f - 1)) / (monthlyRate * f);
}

export type SavingsEstimate = {
  months: number;
  /** Taxa mensal usada como proxy do contrato (estimativa). */
  assumedContractMonthly: number;
  principalEstimated: number;
  currentInstallment: number;
  bacenInstallment: number;
  monthlySavings: number;
  totalSavings: number;
  savingsPercent: number;
};

/**
 * Compara parcela atual com parcela se a taxa fosse a média Bacen.
 * Como o cliente muitas vezes não informa valor financiado nem prazo,
 * usamos prazo padrão configurável e estimamos o principal pela parcela atual
 * com uma taxa "contrato típica" um pouco acima da média (proxy conservador).
 */
export function estimateSavingsVsBacen(opts: {
  currentInstallment: number;
  bacenMonthlyPercent: number;
  months?: number;
  /** Spread acima da média Bacen assumido no contrato (pp a.m.). */
  assumedSpreadPp?: number;
}): SavingsEstimate | null {
  const months = opts.months ?? 48;
  const spread = opts.assumedSpreadPp ?? 0.4;
  const installment = opts.currentInstallment;
  if (installment < 50 || !Number.isFinite(opts.bacenMonthlyPercent)) return null;

  const assumedContractMonthly = opts.bacenMonthlyPercent + spread;
  const iContract = monthlyRateFromMonthly(assumedContractMonthly);
  const iBacen = monthlyRateFromMonthly(opts.bacenMonthlyPercent);
  const principalEstimated = principalFromPmt(installment, iContract, months);
  const bacenInstallment = pmt(principalEstimated, iBacen, months);
  const monthlySavings = Math.max(0, installment - bacenInstallment);
  const totalSavings = monthlySavings * months;
  const savingsPercent = installment > 0 ? (monthlySavings / installment) * 100 : 0;

  return {
    months,
    assumedContractMonthly,
    principalEstimated,
    currentInstallment: installment,
    bacenInstallment,
    monthlySavings,
    totalSavings,
    savingsPercent,
  };
}
