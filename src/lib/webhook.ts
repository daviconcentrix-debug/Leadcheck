import type { Lead } from "./leads";
import { scoreLead } from "./score";

/**
 * Dispara webhook opcional (n8n, Make, Google Apps Script, etc.)
 * quando o lead marca “Já paguei”. Zero custo se a URL estiver vazia.
 */
export async function notifyWebhook(url: string | undefined | null, lead: Lead) {
  const endpoint = (url || "").trim();
  if (!endpoint) return { sent: false as const, reason: "no-url" as const };

  const score = scoreLead(lead);
  const payload = {
    event: "lead.paid",
    at: new Date().toISOString(),
    lead: {
      id: lead.id,
      nome: lead.nome,
      whatsapp: lead.whatsapp,
      cpf: lead.cpf,
      contractDate: lead.contractDate,
      parcela: lead.parcela,
      bacenMonthly: lead.bacenMonthly,
      bacenAnnual: lead.bacenAnnual,
      bacenPeriod: lead.bacenPeriod,
      flags: lead.flags,
      fileName: lead.fileName,
      paid: lead.paid,
      paidAt: lead.paidAt,
      score: score.points,
      tier: score.tier,
    },
  };

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      mode: "cors",
    });
    return { sent: true as const, status: res.status };
  } catch (err) {
    return {
      sent: false as const,
      reason: "network" as const,
      error: err instanceof Error ? err.message : "erro",
    };
  }
}
