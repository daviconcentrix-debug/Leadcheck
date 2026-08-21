import { newId } from "./br";

export type FunnelFlags = {
  quitacao: boolean;
  prestamista: boolean;
  reduzir: boolean;
};

export type Lead = {
  id: string;
  createdAt: string;
  nome: string;
  whatsapp: string;
  cpf: string;
  contractDate: string;
  parcela: number;
  bacenMonthly: number | null;
  bacenAnnual: number | null;
  bacenPeriod: string | null;
  flags: FunnelFlags;
  fileName: string | null;
  fileSize: number | null;
  fileDataUrl: string | null;
  paid: boolean;
  paidAt: string | null;
  pixPayload: string | null;
};

export const LEADS_KEY = "parcela-justa-leads";

export function emptyFlags(): FunnelFlags {
  return { quitacao: false, prestamista: false, reduzir: false };
}

export function loadLeads(): Lead[] {
  try {
    const raw = localStorage.getItem(LEADS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Lead[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveLeads(leads: Lead[]) {
  localStorage.setItem(LEADS_KEY, JSON.stringify(leads));
}

export function upsertLead(lead: Lead) {
  const leads = loadLeads();
  const index = leads.findIndex((item) => item.id === lead.id);
  const next = index >= 0 ? leads.map((item) => (item.id === lead.id ? lead : item)) : [lead, ...leads];
  saveLeads(next);
  return next;
}

export function createLeadDraft(): Lead {
  return {
    id: newId(),
    createdAt: new Date().toISOString(),
    nome: "",
    whatsapp: "",
    cpf: "",
    contractDate: "",
    parcela: 0,
    bacenMonthly: null,
    bacenAnnual: null,
    bacenPeriod: null,
    flags: emptyFlags(),
    fileName: null,
    fileSize: null,
    fileDataUrl: null,
    paid: false,
    paidAt: null,
    pixPayload: null,
  };
}

export function leadPriority(lead: Lead) {
  if (lead.flags.quitacao) return "maxima" as const;
  if (lead.flags.prestamista) return "alta" as const;
  return "normal" as const;
}

export function priorityLabel(priority: ReturnType<typeof leadPriority>) {
  if (priority === "maxima") return "Máxima";
  if (priority === "alta") return "Alta";
  return "Normal";
}

export function leadsToCsv(leads: Lead[]) {
  const headers = [
    "Timestamp",
    "Nome",
    "WhatsApp",
    "CPF",
    "DataContrato",
    "Parcela",
    "TaxaBacenAM",
    "TaxaBacenAA",
    "FlagQuitacao",
    "FlagPrestamista",
    "FlagReducao",
    "Arquivo",
    "Pago",
    "Prioridade",
  ];
  const rows = leads.map((lead) => [
    lead.createdAt,
    lead.nome,
    lead.whatsapp,
    lead.cpf,
    lead.contractDate,
    String(lead.parcela).replace(".", ","),
    lead.bacenMonthly == null ? "" : String(lead.bacenMonthly).replace(".", ","),
    lead.bacenAnnual == null ? "" : String(lead.bacenAnnual).replace(".", ","),
    lead.flags.quitacao ? "TRUE" : "FALSE",
    lead.flags.prestamista ? "TRUE" : "FALSE",
    lead.flags.reduzir ? "TRUE" : "FALSE",
    lead.fileName ?? "",
    lead.paid ? "TRUE" : "FALSE",
    priorityLabel(leadPriority(lead)),
  ]);
  const escape = (value: string) => `"${value.replaceAll('"', '""')}"`;
  return [headers, ...rows].map((row) => row.map(escape).join(";")).join("\n");
}

export const SHEETS_FORMULAS = {
  prioridade: `=ARRAYFORMULA(SE(A2:A="";"";SE(I2:I=VERDADEIRO;"MÁXIMA";SE(J2:J=VERDADEIRO;"ALTA";"NORMAL"))))`,
  abaQuitacao: `=LET(base; Leads!A1:N; QUERY(base; "select * where I = TRUE order by A desc"; 1))`,
  abaPagos: `=LET(base; Leads!A1:N; QUERY(base; "select * where M = TRUE order by A desc"; 1))`,
  abaPrestamista: `=LET(base; Leads!A1:N; QUERY(base; "select * where J = TRUE order by A desc"; 1))`,
};
