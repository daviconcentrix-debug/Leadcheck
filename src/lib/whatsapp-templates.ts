import { formatBRL, formatRate, monthLabel } from "./br";
import type { Lead } from "./leads";

export function templateByFlags(lead: Lead) {
  const parts: string[] = [];
  if (lead.flags.quitacao) {
    parts.push(
      `Vi que você quer *quitar o veículo*. Podemos analisar saldo devedor e cenários de quitação com base na média Bacen.`,
    );
  }
  if (lead.flags.prestamista) {
    parts.push(
      `Você marcou *seguro prestamista* no contrato. Esse é um dos pontos mais revisados — vamos checar se a cobrança estava embutida e se cabe contestação.`,
    );
  }
  if (lead.flags.reduzir) {
    parts.push(
      `Sua prioridade é *reduzir a parcela*. Com a média oficial do Bacen na época do contrato, estimamos se há espaço de recálculo.`,
    );
  }
  if (!parts.length) {
    parts.push(`Recebemos sua solicitação de revisão de juros do financiamento.`);
  }
  return parts.join("\n\n");
}

export function buildSpecialistMessage(lead: Lead) {
  const bacen =
    lead.bacenMonthly != null
      ? `${formatRate(lead.bacenMonthly)} a.m.${lead.bacenAnnual != null ? ` (${formatRate(lead.bacenAnnual)} a.a.)` : ""}`
      : "não consultada";

  return [
    `Olá, ${lead.nome.split(" ")[0]}! Sou da equipe *Parcela Justa*.`,
    ``,
    templateByFlags(lead),
    ``,
    `*Resumo do pré-laudo*`,
    `• Contrato: ${monthLabel(lead.contractDate) || lead.contractDate}`,
    `• Parcela informada: ${formatBRL(lead.parcela)}`,
    `• Média Bacen (veículos PF): ${bacen}`,
    lead.paid ? `• Pré-laudo liberado em ${lead.paidAt ? new Date(lead.paidAt).toLocaleString("pt-BR") : "—"}` : `• Pagamento: pendente`,
    ``,
    `Quando puder, envie o contrato (PDF ou foto das páginas de taxa e prestamista) para aprofundarmos a análise.`,
    ``,
    `_Esta mensagem não constitui aconselhamento jurídico definitivo._`,
  ].join("\n");
}

export function specialistWaLink(phoneDigits: string, lead: Lead) {
  const wa = phoneDigits.replace(/\D/g, "").replace(/^55/, "");
  if (wa.length < 10) return null;
  const text = encodeURIComponent(buildSpecialistMessage(lead));
  return `https://wa.me/55${wa}?text=${text}`;
}

export function clientWaLink(clientPhone: string, message: string) {
  const wa = clientPhone.replace(/\D/g, "").replace(/^55/, "");
  if (wa.length < 10) return null;
  return `https://wa.me/55${wa}?text=${encodeURIComponent(message)}`;
}
