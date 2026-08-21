import { formatBRL, formatRate, maskCpfHidden, monthLabel } from "./br";
import type { Lead } from "./leads";
import type { SavingsEstimate } from "./simulate";
import { scoreLead, tierLabel } from "./score";

function esc(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function openPrelaudoPrint(lead: Lead, savings: SavingsEstimate | null) {
  const score = scoreLead(lead);
  const flags = [
    lead.flags.quitacao ? "Quitação" : null,
    lead.flags.prestamista ? "Seguro prestamista" : null,
    lead.flags.reduzir ? "Reduzir parcela" : null,
  ]
    .filter(Boolean)
    .join(", ");

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Pré-laudo ${esc(lead.nome)}</title>
  <style>
    body { font-family: system-ui, sans-serif; color: #1b1916; max-width: 720px; margin: 24px auto; padding: 0 16px; line-height: 1.45; }
    h1 { font-size: 22px; margin: 0 0 4px; }
    h2 { font-size: 14px; text-transform: uppercase; letter-spacing: 0.08em; color: #1e3d32; margin: 24px 0 8px; }
    .muted { color: #6f6a62; font-size: 13px; }
    .card { border: 1px solid #e5e1da; border-radius: 12px; padding: 14px 16px; margin: 10px 0; }
    .alert { background: #f4e6e2; border-color: #e8cfc9; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    td { padding: 6px 0; vertical-align: top; }
    td:first-child { color: #6f6a62; width: 42%; }
    .footer { margin-top: 28px; font-size: 11px; color: #9a948a; border-top: 1px solid #e5e1da; padding-top: 12px; }
    @media print { body { margin: 0; } .no-print { display: none; } }
  </style>
</head>
<body>
  <p class="muted">Parcela Justa · Pré-laudo de orientação</p>
  <h1>Pré-laudo — revisão de juros (veículos)</h1>
  <p class="muted">Protocolo: ${esc(lead.id.slice(0, 8).toUpperCase())} · Gerado em ${new Date().toLocaleString("pt-BR")}</p>

  <h2>Cliente</h2>
  <div class="card">
    <table>
      <tr><td>Nome</td><td>${esc(lead.nome)}</td></tr>
      <tr><td>WhatsApp</td><td>${esc(lead.whatsapp)}</td></tr>
      <tr><td>CPF</td><td>${esc(maskCpfHidden(lead.cpf))}</td></tr>
      <tr><td>Contrato</td><td>${esc(monthLabel(lead.contractDate) || lead.contractDate)}</td></tr>
      <tr><td>Parcela informada</td><td>${esc(formatBRL(lead.parcela))}</td></tr>
      <tr><td>Interesses</td><td>${esc(flags || "—")}</td></tr>
      <tr><td>Score interno</td><td>${score.points} pts · ${tierLabel(score.tier)}</td></tr>
    </table>
  </div>

  <h2>Referência Bacen (SGS)</h2>
  <div class="card alert">
    <p style="margin:0 0 8px"><strong>Atenção:</strong> a taxa média do Bacen na época do contrato
      ${lead.bacenMonthly != null ? `era <strong>${esc(formatRate(lead.bacenMonthly))} a.m.</strong>` : "não pôde ser consultada"}
      ${lead.bacenAnnual != null ? ` (${esc(formatRate(lead.bacenAnnual))} a.a.)` : ""}.
      O contrato pode estar acima da média de mercado.</p>
    <p class="muted" style="margin:0">Fonte: SGS 25471 / 20749 — Aquisição de veículos PF, recursos livres.
      Competência: ${esc(lead.bacenPeriod || "—")}. A referência correta em revisão é a <em>média de mercado</em>, não a taxa divulgada pelo banco.</p>
  </div>

  ${
    savings
      ? `<h2>Simulação orientativa</h2>
  <div class="card">
    <table>
      <tr><td>Prazo assumido</td><td>${savings.months} meses</td></tr>
      <tr><td>Principal estimado</td><td>${esc(formatBRL(savings.principalEstimated))}</td></tr>
      <tr><td>Parcela atual</td><td>${esc(formatBRL(savings.currentInstallment))}</td></tr>
      <tr><td>Parcela se taxa = média Bacen</td><td><strong>${esc(formatBRL(savings.bacenInstallment))}</strong></td></tr>
      <tr><td>Economia mensal estimada</td><td>${esc(formatBRL(savings.monthlySavings))} (${savings.savingsPercent.toFixed(1).replace(".", ",")}%)</td></tr>
      <tr><td>Economia total no prazo</td><td><strong>${esc(formatBRL(savings.totalSavings))}</strong></td></tr>
    </table>
    <p class="muted" style="margin:10px 0 0">Estimativa com base na parcela informada e na média Bacen. Não substitui cálculo pericial com o contrato completo.</p>
  </div>`
      : ""
  }

  <h2>Próximos passos</h2>
  <div class="card">
    <ol style="margin:0; padding-left:18px">
      <li>Conferir contrato (taxa, CET, prestamista, IOF).</li>
      <li>Confrontar com a série SGS da modalidade e competência.</li>
      <li>Elaborar laudo / parecer se houver indício de abusividade.</li>
    </ol>
  </div>

  <div class="footer">
    Documento orientativo gerado automaticamente. Não constitui aconselhamento jurídico nem laudo pericial.
    Dados pessoais tratados apenas para atendimento da solicitação (LGPD). Parcela Justa não é instituição financeira.
  </div>

  <p class="no-print" style="margin-top:20px">
    <button onclick="window.print()" style="padding:10px 16px; font-size:14px; cursor:pointer">Imprimir / salvar PDF</button>
  </p>
  <script>window.onload = function () { setTimeout(function () { window.print(); }, 300); };</script>
</body>
</html>`;

  const w = window.open("", "_blank", "noopener,noreferrer,width=800,height=900");
  if (!w) {
    alert("Permita pop-ups para gerar o pré-laudo em PDF.");
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
}
