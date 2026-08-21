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

export function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

export function maskCpf(value: string) {
  const d = onlyDigits(value).slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

export function maskCpfHidden(value: string) {
  const d = onlyDigits(value);
  if (d.length < 11) return maskCpf(d);
  return `***.***.***-${d.slice(9)}`;
}

export function isValidCpf(value: string) {
  const d = onlyDigits(value);
  if (d.length !== 11) return false;
  if (/^(\d)\1+$/.test(d)) return false;
  const digit = (base: number) => {
    let sum = 0;
    for (let i = 0; i < base; i++) sum += Number(d[i]) * (base + 1 - i);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return digit(9) === Number(d[9]) && digit(10) === Number(d[10]);
}

export function maskPhone(value: string) {
  const d = onlyDigits(value).slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function isValidPhone(value: string) {
  const d = onlyDigits(value);
  return d.length === 10 || d.length === 11;
}

export function formatBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export function formatRate(value: number) {
  return `${new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)}%`;
}

export function parseParcelaInput(raw: string) {
  const digits = onlyDigits(raw).slice(0, 9);
  if (!digits) return 0;
  return Number(digits) / 100;
}

export function maskParcela(raw: string) {
  return formatBRL(parseParcelaInput(raw));
}

export function monthLabel(yearMonth: string) {
  const [year, month] = yearMonth.split("-").map(Number);
  if (!year || !month) return yearMonth;
  return `${MESES[month - 1]} de ${year}`;
}

export function stripAccents(value: string) {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

export function newId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `pj_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
