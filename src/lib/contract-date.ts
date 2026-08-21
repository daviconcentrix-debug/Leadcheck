/** Helpers de data de contrato (AAAA-MM). */

const MESES = [
  { value: "01", label: "Janeiro" },
  { value: "02", label: "Fevereiro" },
  { value: "03", label: "Março" },
  { value: "04", label: "Abril" },
  { value: "05", label: "Maio" },
  { value: "06", label: "Junho" },
  { value: "07", label: "Julho" },
  { value: "08", label: "Agosto" },
  { value: "09", label: "Setembro" },
  { value: "10", label: "Outubro" },
  { value: "11", label: "Novembro" },
  { value: "12", label: "Dezembro" },
];

export function monthOptions() {
  return MESES;
}

export function yearOptions(from = 2005) {
  const now = new Date();
  const current = now.getFullYear();
  const years: number[] = [];
  for (let y = current; y >= from; y--) years.push(y);
  return years;
}

export function parseContractYm(value: string): { year: string; month: string } {
  const m = /^(\d{4})-(\d{2})$/.exec(value || "");
  if (!m) return { year: "", month: "" };
  return { year: m[1], month: m[2] };
}

export function buildContractYm(year: string, month: string) {
  if (!year || !month) return "";
  return `${year}-${month}`;
}

export function maxContractYm() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Atalhos: últimos anos + “este mês”. */
export function quickYearChips() {
  const y = new Date().getFullYear();
  return [y, y - 1, y - 2, y - 3, y - 4, y - 5];
}
