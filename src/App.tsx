import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { fetchBacenRate, type BacenResult } from "./lib/bacen";
import {
  formatBRL,
  formatRate,
  isValidCpf,
  isValidPhone,
  maskCpf,
  maskCpfHidden,
  maskParcela,
  maskPhone,
  monthLabel,
  newId,
  parseParcelaInput,
} from "./lib/br";
import {
  createLeadDraft,
  leadPriority,
  leadsToCsv,
  loadLeads,
  markContacted,
  priorityLabel,
  saveLeads,
  SHEETS_FORMULAS,
  unpaidContactQueue,
  upsertLead,
  type FunnelFlags,
  type Lead,
} from "./lib/leads";
import { buildPixPayload } from "./lib/pix";
import {
  DEFAULT_SETTINGS,
  isDemoPixKey,
  loadSettings,
  saveSettings,
  type AppSettings,
} from "./lib/settings";
import { openPrelaudoPrint } from "./lib/pdf-prelaudo";
import { scoreLead, tierLabel } from "./lib/score";
import { estimateSavingsVsBacen, type SavingsEstimate } from "./lib/simulate";
import { buildSpecialistMessage, clientWaLink } from "./lib/whatsapp-templates";
import { SGS_VEICULOS_PF } from "./lib/sgs-catalog";
import {
  clearBackofficeSession,
  hasLocalSession,
  loginBackofficeSmart,
  verifyBackofficeSession,
} from "./lib/auth";
import { annualEffectiveFromMonthly, formatCet } from "./lib/cet";
import {
  buildContractYm,
  monthOptions,
  parseContractYm,
  quickYearChips,
  yearOptions,
} from "./lib/contract-date";
import { notifyWebhook } from "./lib/webhook";

type View = "funnel" | "backoffice";

export default function App() {
  const [view, setView] = useState<View>(() =>
    typeof window !== "undefined" && window.location.hash === "#backoffice" ? "backoffice" : "funnel",
  );

  useEffect(() => {
    const onHash = () => setView(window.location.hash === "#backoffice" ? "backoffice" : "funnel");
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  if (view === "backoffice") return <Backoffice onHome={() => (window.location.hash = "")} />;
  return <Funnel onBackoffice={() => (window.location.hash = "backoffice")} />;
}

function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <svg viewBox="0 0 32 32" width={compact ? 28 : 32} height={compact ? 28 : 32} aria-hidden>
        <rect width="32" height="32" rx="8" fill="var(--forest)" />
        <rect x="8" y="9" width="16" height="2.2" rx="1.1" fill="var(--bg)" />
        <rect x="8" y="14.2" width="11" height="2.2" rx="1.1" fill="var(--bg)" />
        <path
          d="M18.2 20.2 20.1 22l4.2-4.6"
          fill="none"
          stroke="var(--bg)"
          strokeWidth="2.1"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="font-display" style={{ fontSize: compact ? 16 : 18, letterSpacing: "-0.02em" }}>
        Parcela Justa
      </span>
    </div>
  );
}

function Button({
  children,
  variant = "primary",
  size = "md",
  style,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
}) {
  const base: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    border: "none",
    fontFamily: "inherit",
    fontWeight: 500,
    transition: "opacity 150ms var(--ease), transform 150ms var(--ease)",
    borderRadius: size === "lg" ? "var(--radius-lg)" : "var(--radius)",
    height: size === "lg" ? 48 : size === "sm" ? 36 : 44,
    padding: size === "sm" ? "0 12px" : "0 16px",
    width: size === "lg" ? "100%" : undefined,
    fontSize: size === "sm" ? 13 : 14,
  };
  const variants: Record<string, React.CSSProperties> = {
    primary: { background: "var(--forest)", color: "var(--forest-fg)" },
    secondary: { background: "var(--surface)", color: "var(--ink)", boxShadow: "var(--shadow)" },
    ghost: { background: "transparent", color: "var(--ink)" },
  };
  return (
    <button
      {...props}
      style={{ ...base, ...variants[variant], ...style }}
      onMouseDown={(e) => {
        (e.currentTarget as HTMLButtonElement).style.transform = "scale(0.96)";
        props.onMouseDown?.(e);
      }}
      onMouseUp={(e) => {
        (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)";
        props.onMouseUp?.(e);
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)";
      }}
    >
      {children}
    </button>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  const { invalid, style, ...rest } = props;
  return (
    <input
      {...rest}
      style={{
        height: 48,
        width: "100%",
        borderRadius: "var(--radius)",
        border: "none",
        background: "var(--surface)",
        boxShadow: invalid ? "0 0 0 2px var(--alert)" : "var(--shadow)",
        padding: "0 16px",
        fontSize: 16,
        fontFamily: "inherit",
        color: "var(--ink)",
        outline: "none",
        ...style,
      }}
    />
  );
}

function Field({ label, htmlFor, error, children }: { label: string; htmlFor?: string; error?: string; children: ReactNode }) {
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <label htmlFor={htmlFor} style={{ fontSize: 14, fontWeight: 500 }}>
        {label}
      </label>
      {children}
      {error ? <p style={{ margin: 0, fontSize: 12, color: "var(--alert)" }}>{error}</p> : null}
    </div>
  );
}

function StepProgress({ step, total }: { step: number; total: number }) {
  return (
    <div style={{ display: "flex", gap: 6 }} aria-label={`Etapa ${step} de ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          style={{
            height: 4,
            flex: 1,
            borderRadius: 999,
            background: i < step ? "var(--forest)" : "rgba(27,25,22,0.1)",
          }}
        />
      ))}
    </div>
  );
}

function Funnel({ onBackoffice: _onBackoffice }: { onBackoffice: () => void }) {
  const [step, setStep] = useState(1);
  const [lead, setLead] = useState<Lead>(createLeadDraft);
  const [bacen, setBacen] = useState<BacenResult | null>(null);
  const [bacenLoading, setBacenLoading] = useState(false);
  const [bacenError, setBacenError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setSettings(loadSettings());
  }, [step, done]);

  const pixPayload = useMemo(
    () =>
      buildPixPayload({
        pixKey: settings.pixKey,
        merchantName: settings.merchantName,
        merchantCity: settings.merchantCity,
        amount: settings.amount,
        txid: `PJ${lead.id.replace(/[^A-Za-z0-9]/g, "").slice(0, 20)}`,
        description: "Pre-laudo Parcela Justa",
      }),
    [lead.id, settings],
  );

  useEffect(() => {
    if (step !== 5 || done) return;
    let active = true;
    import("qrcode").then((QRCode) =>
      QRCode.toDataURL(pixPayload, {
        errorCorrectionLevel: "M",
        margin: 1,
        width: 360,
        color: { dark: "#1b1916", light: "#fbf9f5" },
      }).then((url) => {
        if (active) setQr(url);
      }),
    );
    return () => {
      active = false;
    };
  }, [step, done, pixPayload]);

  async function loadBacen(contractDate: string) {
    setBacenLoading(true);
    setBacenError(null);
    try {
      const result = await fetchBacenRate(contractDate);
      setBacen(result);
      setLead((c) => ({
        ...c,
        bacenMonthly: result.monthlyRate,
        bacenAnnual: result.annualRate,
        bacenPeriod: result.period,
      }));
    } catch (e) {
      setBacenError(e instanceof Error ? e.message : "Falha na consulta Bacen");
    } finally {
      setBacenLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 512, margin: "0 auto", minHeight: "100dvh", padding: "20px 16px 40px", display: "flex", flexDirection: "column" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        {step > 1 && !done ? (
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            aria-label="Voltar"
            style={{
              width: 44,
              height: 44,
              borderRadius: 999,
              border: "none",
              background: "transparent",
              color: "var(--muted)",
              fontSize: 22,
            }}
          >
            ‹
          </button>
        ) : (
          <BrandMark compact />
        )}
        {!done ? (
          <span style={{ fontSize: 12, fontWeight: 500, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--muted)" }}>
            {step} / 5
          </span>
        ) : (
          <span />
        )}
      </header>

      {!done ? <StepProgress step={step} total={5} /> : null}

      <main style={{ marginTop: 24, flex: 1 }}>
        {done ? (
          <Success
            lead={lead}
            specialistWhatsapp={settings.specialistWhatsapp}
            onReset={() => {
              setLead(createLeadDraft());
              setBacen(null);
              setDone(false);
              setStep(1);
            }}
          />
        ) : null}

        {!done && step === 1 ? (
          <StepCapture
            initial={lead}
            onSubmit={(values) => {
              setLead((c) => ({ ...c, ...values }));
              setStep(2);
              void loadBacen(values.contractDate);
            }}
          />
        ) : null}

        {!done && step === 2 ? (
          <StepBacen
            loading={bacenLoading}
            result={bacen}
            error={bacenError}
            parcela={lead.parcela}
            contractDate={lead.contractDate}
            onContinue={() => setStep(3)}
            onRetry={() => void loadBacen(lead.contractDate)}
          />
        ) : null}

        {!done && step === 3 ? (
          <StepFlags
            value={lead.flags}
            onChange={(flags) => setLead((c) => ({ ...c, flags }))}
            onContinue={() => setStep(4)}
          />
        ) : null}

        {!done && step === 4 ? (
          <StepUpload
            value={lead}
            onChange={(file) => setLead((c) => ({ ...c, ...file }))}
            onContinue={() => setStep(5)}
          />
        ) : null}

        {!done && step === 5 ? (
          <div className="rise-in" style={{ display: "grid", gap: 24 }}>
            <header style={{ display: "grid", gap: 8 }}>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 500, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--forest)" }}>
                Pré-laudo
              </p>
              <h1 className="font-display" style={{ margin: 0, fontSize: 28, lineHeight: 1.15, letterSpacing: "-0.03em" }}>
                Liberar o pré-laudo e falar com um especialista
              </h1>
              <p style={{ margin: 0, fontSize: 14, color: "var(--muted)" }}>
                Valor simbólico de {formatBRL(settings.amount)}. Pix gerado neste aparelho, sem taxa de gateway.
              </p>
            </header>

            {isDemoPixKey(settings.pixKey) ? (
              <p style={{ margin: 0, padding: "8px 12px", borderRadius: 8, background: "var(--alert-soft)", color: "var(--alert)", fontSize: 12 }}>
                Chave Pix de demonstração. Troque pela sua no painel da equipe.
              </p>
            ) : null}

            <div style={{ background: "var(--surface)", borderRadius: "var(--radius-xl)", padding: 20, boxShadow: "var(--shadow)", textAlign: "center" }}>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 500, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--muted)" }}>
                Pix · {formatBRL(settings.amount)}
              </p>
              <div style={{ margin: "16px auto 0", width: 224, height: 224, display: "grid", placeItems: "center", background: "var(--bg)", borderRadius: "var(--radius-lg)" }}>
                {qr ? <img src={qr} alt={`QR Code Pix de ${formatBRL(settings.amount)}`} width={208} height={208} /> : <span className="spin">⏳</span>}
              </div>
              <p style={{ margin: "12px 0 0", fontSize: 14, color: "var(--muted)" }}>{settings.merchantName}</p>
            </div>

            <Button
              type="button"
              variant="secondary"
              size="lg"
              onClick={async () => {
                await navigator.clipboard.writeText(pixPayload);
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1800);
              }}
            >
              {copied ? "Código copiado" : "Copiar código Pix"}
            </Button>
            <p style={{ margin: 0, wordBreak: "break-all", fontFamily: "ui-monospace, monospace", fontSize: 10, color: "var(--muted)", background: "var(--bg)", padding: 12, borderRadius: 8 }}>
              {pixPayload}
            </p>

            <Button
              type="button"
              size="lg"
              onClick={() => {
                const next: Lead = {
                  ...lead,
                  paid: true,
                  paidAt: new Date().toISOString(),
                  pixPayload,
                  id: lead.id || newId(),
                };
                upsertLead(next);
                setLead(next);
                setDone(true);
                void notifyWebhook(settings.webhookUrl, next);
              }}
            >
              Já paguei · liberar pré-laudo
            </Button>
          </div>
        ) : null}
      </main>

      <footer style={{ marginTop: 40, textAlign: "center", fontSize: 11, color: "var(--subtle)", lineHeight: 1.6 }}>
        <p style={{ margin: "0 0 12px" }}>
          Não somos instituição financeira. A consulta usa dados públicos do Banco Central (SGS). O pré-laudo não substitui análise jurídica completa.
        </p>
        
      </footer>
    </div>
  );
}

function StepCapture({
  initial,
  onSubmit,
}: {
  initial: Pick<Lead, "nome" | "whatsapp" | "cpf" | "contractDate" | "parcela">;
  onSubmit: (v: Pick<Lead, "nome" | "whatsapp" | "cpf" | "contractDate" | "parcela">) => void;
}) {
  const [nome, setNome] = useState(initial.nome);
  const [whatsapp, setWhatsapp] = useState(initial.whatsapp);
  const [cpf, setCpf] = useState(initial.cpf);
  const [contractDate, setContractDate] = useState(initial.contractDate);
  const [parcelaRaw, setParcelaRaw] = useState(initial.parcela ? maskParcela(String(Math.round(initial.parcela * 100))) : "");
  const [errors, setErrors] = useState<Record<string, string>>({});

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const parcela = parseParcelaInput(parcelaRaw);
    const next: Record<string, string> = {};
    if (nome.trim().split(" ").length < 2) next.nome = "Informe nome e sobrenome";
    if (!isValidPhone(whatsapp)) next.whatsapp = "WhatsApp com DDD, 10 ou 11 dígitos";
    if (!isValidCpf(cpf)) next.cpf = "CPF inválido";
    if (!contractDate) next.contractDate = "Informe o mês de assinatura";
    if (parcela < 50) next.parcela = "Informe o valor da parcela";
    setErrors(next);
    if (Object.keys(next).length) return;
    onSubmit({ nome: nome.trim(), whatsapp, cpf, contractDate, parcela });
  }

  return (
    <form onSubmit={handleSubmit} className="rise-in" style={{ display: "grid", gap: 24 }}>
      <header style={{ display: "grid", gap: 12 }}>
        <p style={{ margin: 0, fontSize: 12, fontWeight: 500, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--forest)" }}>
          Consulta oficial Bacen
        </p>
        <h1 className="font-display" style={{ margin: 0, fontSize: 30, lineHeight: 1.15, letterSpacing: "-0.03em" }}>
          Seu financiamento pode estar acima da média do Banco Central.
        </h1>
        <p style={{ margin: 0, color: "var(--muted)", maxWidth: "38ch" }}>
          Em poucos minutos comparamos a data do seu contrato com a taxa média oficial de veículos.
        </p>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
        {[
          ["01", "Informe"],
          ["02", "Compare"],
          ["03", "Pré-laudo"],
        ].map(([n, t]) => (
          <div key={n} style={{ background: "var(--surface)", borderRadius: "var(--radius-lg)", padding: 12, boxShadow: "var(--shadow)" }}>
            <p style={{ margin: 0, fontFamily: "ui-monospace, monospace", fontSize: 11, color: "var(--subtle)" }}>{n}</p>
            <p style={{ margin: "4px 0 0", fontSize: 14, fontWeight: 500 }}>{t}</p>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gap: 16 }}>
        <Field label="Nome completo" htmlFor="nome" error={errors.nome}>
          <Input id="nome" value={nome} invalid={!!errors.nome} onChange={(e) => setNome(e.target.value)} placeholder="Como no contrato" autoComplete="name" />
        </Field>
        <Field label="WhatsApp" htmlFor="whatsapp" error={errors.whatsapp}>
          <Input id="whatsapp" inputMode="numeric" value={maskPhone(whatsapp)} invalid={!!errors.whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="(11) 90000-0000" />
        </Field>
        <Field label="CPF" htmlFor="cpf" error={errors.cpf}>
          <Input id="cpf" inputMode="numeric" value={maskCpf(cpf)} invalid={!!errors.cpf} onChange={(e) => setCpf(e.target.value)} placeholder="000.000.000-00" />
        </Field>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Quando assinou o contrato?" htmlFor="contrato-mes" error={errors.contractDate}>
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {quickYearChips().map((y) => {
                  const selected = parseContractYm(contractDate).year === String(y);
                  return (
                    <button
                      key={y}
                      type="button"
                      onClick={() => {
                        const { month } = parseContractYm(contractDate);
                        setContractDate(buildContractYm(String(y), month || "06"));
                      }}
                      style={{
                        border: selected ? "1.5px solid var(--forest)" : "1px solid var(--line)",
                        background: selected ? "var(--ok-soft)" : "var(--surface)",
                        color: "var(--ink)",
                        borderRadius: 999,
                        padding: "8px 12px",
                        fontSize: 13,
                        fontWeight: selected ? 600 : 500,
                        cursor: "pointer",
                      }}
                    >
                      {y}
                    </button>
                  );
                })}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 8 }}>
                <select
                  id="contrato-mes"
                  value={parseContractYm(contractDate).month}
                  onChange={(e) => {
                    const { year } = parseContractYm(contractDate);
                    const y = year || String(new Date().getFullYear());
                    setContractDate(buildContractYm(y, e.target.value));
                  }}
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    borderRadius: 12,
                    border: errors.contractDate ? "1.5px solid var(--alert)" : "1px solid var(--line)",
                    background: "var(--surface)",
                    fontSize: 16,
                    color: "var(--ink)",
                  }}
                >
                  <option value="">Mês</option>
                  {monthOptions().map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
                <select
                  id="contrato-ano"
                  value={parseContractYm(contractDate).year}
                  onChange={(e) => {
                    const { month } = parseContractYm(contractDate);
                    setContractDate(buildContractYm(e.target.value, month || "01"));
                  }}
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    borderRadius: 12,
                    border: errors.contractDate ? "1.5px solid var(--alert)" : "1px solid var(--line)",
                    background: "var(--surface)",
                    fontSize: 16,
                    color: "var(--ink)",
                  }}
                >
                  <option value="">Ano</option>
                  {yearOptions().map((y) => (
                    <option key={y} value={String(y)}>{y}</option>
                  ))}
                </select>
              </div>
              <p style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>
                Não precisa do dia — só o mês e o ano da assinatura. Se não lembrar o mês, escolha o mais próximo.
              </p>
            </div>
          </Field>
          <Field label="Valor da parcela" htmlFor="parcela" error={errors.parcela}>
            <Input id="parcela" inputMode="numeric" value={parcelaRaw} invalid={!!errors.parcela} onChange={(e) => setParcelaRaw(maskParcela(e.target.value))} placeholder="R$ 0,00" />
          </Field>
        </div>
      </div>

      <Button type="submit" size="lg">
        Consultar taxa do Bacen
      </Button>
      <p style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>
        Dados oficiais do Banco Central. Sem consulta ao SPC. Pré-laudo por R$ 4,90.
      </p>
      <p style={{ margin: 0, fontSize: 11, color: "var(--subtle)", lineHeight: 1.5 }}>
        Ao continuar, você autoriza o uso de nome, WhatsApp e CPF apenas para esta análise e contato da equipe (LGPD).
        Os dados ficam neste dispositivo até você solicitar exclusão ou limpar o navegador. Não vendemos dados a terceiros.
      </p>
    </form>
  );
}

function StepBacen({
  loading,
  result,
  error,
  parcela,
  contractDate,
  onContinue,
  onRetry,
}: {
  loading: boolean;
  result: BacenResult | null;
  error: string | null;
  parcela: number;
  contractDate: string;
  onContinue: () => void;
  onRetry: () => void;
}) {
  if (loading) {
    return (
      <div style={{ minHeight: 420, display: "grid", placeItems: "center", textAlign: "center" }}>
        <div>
          <div style={{ position: "relative", width: 96, height: 96, margin: "0 auto 24px", borderRadius: "var(--radius-xl)", background: "var(--surface)", boxShadow: "var(--shadow)", overflow: "hidden" }}>
            <div className="scan-line" style={{ position: "absolute", left: 12, right: 12, top: 0, height: 32, borderRadius: 999, background: "rgba(30,61,50,0.15)" }} />
          </div>
          <p className="font-display" style={{ margin: 0, fontSize: 24 }}>
            Consultando o Banco Central
          </p>
          <p style={{ margin: "8px 0 0", fontSize: 14, color: "var(--muted)" }}>
            Buscando a taxa média de financiamento de veículos em {monthLabel(contractDate)}.
          </p>
        </div>
      </div>
    );
  }

  if (error || !result) {
    return (
      <div style={{ display: "grid", gap: 16 }}>
        <h1 className="font-display" style={{ margin: 0, fontSize: 24 }}>
          Não foi possível consultar agora
        </h1>
        <p style={{ margin: 0, color: "var(--muted)" }}>{error ?? "Tente novamente."}</p>
        <Button type="button" size="lg" onClick={onRetry}>
          Tentar de novo
        </Button>
      </div>
    );
  }

  const chartData = result.history.map((p) => ({
    label: p.month.slice(2).replace("-", "/"),
    taxa: p.monthlyRate,
  }));

  return (
    <div className="rise-in" style={{ display: "grid", gap: 24 }}>
      <div role="status" style={{ background: "var(--alert-soft)", color: "var(--alert)", borderRadius: "var(--radius-xl)", padding: 20, boxShadow: "var(--shadow)" }}>
        <p style={{ margin: 0, fontSize: 12, fontWeight: 500, letterSpacing: "0.14em", textTransform: "uppercase" }}>Atenção</p>
        <p style={{ margin: "8px 0 0", color: "var(--ink)", fontSize: 17, lineHeight: 1.35 }}>
          Identificamos que a taxa média do Bacen na época do seu contrato era{" "}
          <strong style={{ whiteSpace: "nowrap" }}>{formatRate(result.monthlyRate)} a.m.</strong>
          {result.annualRate != null ? (
            <>
              {" "}
              (<strong style={{ whiteSpace: "nowrap" }}>{formatRate(result.annualRate)} a.a.</strong>)
            </>
          ) : null}
          . O seu contrato pode estar acima da média.
        </p>
      </div>

      <div>
        <h1 className="font-display" style={{ margin: 0, fontSize: 28, letterSpacing: "-0.03em" }}>
          Média oficial em {result.period}
        </h1>
        <p style={{ margin: "6px 0 0", fontSize: 14, color: "var(--muted)" }}>
          Série {result.source === "bacen" ? "ao vivo" : "de referência"} · {result.seriesName}
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {[
          ["Taxa média a.m.", formatRate(result.monthlyRate)],
          ["Equivalente a.a.", result.annualRate != null ? formatRate(result.annualRate) : "—"],
          ["Sua parcela", formatBRL(parcela)],
          ["Competência", result.period],
        ].map(([label, value]) => (
          <div key={label} style={{ background: "var(--surface)", borderRadius: "var(--radius-lg)", padding: 12, boxShadow: "var(--shadow)" }}>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>{label}</div>
            <div style={{ marginTop: 4, fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>{value}</div>
          </div>
        ))}
      </div>

      {chartData.length > 2 ? (
        <div style={{ background: "var(--surface)", borderRadius: "var(--radius-xl)", padding: 16, boxShadow: "var(--shadow)" }}>
          <p style={{ margin: "0 0 12px", fontSize: 12, fontWeight: 500, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--muted)" }}>
            Últimos 12 meses · % a.m.
          </p>
          <div style={{ height: 144, color: "var(--forest)" }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="currentColor" strokeOpacity={0.08} vertical={false} />
                <XAxis dataKey="label" tick={{ fill: "currentColor", fontSize: 10 }} axisLine={false} tickLine={false} interval={1} />
                <Tooltip
                  formatter={(value) => [`${formatRate(Number(value))} a.m.`, "Taxa"]}
                  contentStyle={{ background: "var(--surface)", border: "none", borderRadius: 12, boxShadow: "var(--shadow)", fontSize: 12 }}
                />
                <Line type="monotone" dataKey="taxa" stroke="currentColor" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : null}

      {result.monthlyRate != null ? (() => {
        const savings = estimateSavingsVsBacen({
          currentInstallment: parcela,
          bacenMonthlyPercent: result.monthlyRate,
        });
        if (!savings) return null;
        return (
          <div style={{ background: "var(--ok-soft)", borderRadius: "var(--radius-xl)", padding: 16, boxShadow: "var(--shadow)" }}>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 500, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--ok)" }}>
              Se a taxa fosse a média Bacen
            </p>
            <p style={{ margin: "8px 0 0", fontSize: 15, lineHeight: 1.4 }}>
              Parcela estimada: <strong>{formatBRL(savings.bacenInstallment)}</strong>
              {" "}· economia de <strong>{formatBRL(savings.monthlySavings)}/mês</strong>
              {" "}({savings.savingsPercent.toFixed(1).replace(".", ",")}%)
            </p>
            <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--muted)" }}>
              No prazo de {savings.months} meses, cerca de <strong>{formatBRL(savings.totalSavings)}</strong> a menos em juros.
              Simulação orientativa (prazo e principal estimados a partir da sua parcela).
            </p>
          </div>
        );
      })() : null}

      {result.monthlyRate != null ? (
        <p style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>
          Equivalente efetiva aprox.:{" "}
          <strong>{formatCet(result.monthlyRate, annualEffectiveFromMonthly(result.monthlyRate))}</strong>
          {result.ratesConsistent === false ? (
            <span style={{ color: "var(--alert)" }}> · atenção: série anual e mensal divergem</span>
          ) : result.ratesConsistent ? (
            <span> · séries mensal/anual consistentes</span>
          ) : null}
        </p>
      ) : null}

      <p style={{ margin: 0, fontSize: 11, color: "var(--subtle)" }}>
        Séries: {SGS_VEICULOS_PF.mensal.code} (% a.m.) e {SGS_VEICULOS_PF.anual.code} (% a.a.) — {SGS_VEICULOS_PF.mensal.label.split("—")[0].trim()}.
      </p>

      <Button type="button" size="lg" onClick={onContinue}>
        Quero revisar meu contrato
      </Button>
    </div>
  );
}

function StepFlags({
  value,
  onChange,
  onContinue,
}: {
  value: FunnelFlags;
  onChange: (v: FunnelFlags) => void;
  onContinue: () => void;
}) {
  const options: { key: keyof FunnelFlags; title: string; hint: string }[] = [
    { key: "quitacao", title: "Quero quitar o veículo e me livrar da dívida", hint: "Prioridade máxima para a equipe" },
    { key: "prestamista", title: "Me cobraram seguro prestamista no contrato", hint: "Cobrança embutida é um dos pontos mais revisados" },
    { key: "reduzir", title: "A parcela está pesada, quero reduzir", hint: "Revisão de taxa e recálculo da prestação" },
  ];
  const selected = value.quitacao || value.prestamista || value.reduzir;

  return (
    <div className="rise-in" style={{ display: "grid", gap: 24 }}>
      <header style={{ display: "grid", gap: 8 }}>
        <p style={{ margin: 0, fontSize: 12, fontWeight: 500, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--forest)" }}>Qualificação</p>
        <h1 className="font-display" style={{ margin: 0, fontSize: 28, letterSpacing: "-0.03em" }}>
          O que você quer resolver primeiro?
        </h1>
        <p style={{ margin: 0, fontSize: 14, color: "var(--muted)" }}>Pode marcar mais de uma opção.</p>
      </header>
      <div style={{ display: "grid", gap: 10 }}>
        {options.map((opt) => {
          const on = value[opt.key];
          return (
            <button
              key={opt.key}
              type="button"
              role="checkbox"
              aria-checked={on}
              onClick={() => onChange({ ...value, [opt.key]: !on })}
              style={{
                display: "flex",
                gap: 12,
                alignItems: "flex-start",
                textAlign: "left",
                padding: 16,
                borderRadius: "var(--radius-xl)",
                border: "none",
                background: on ? "var(--ok-soft)" : "var(--surface)",
                boxShadow: on ? "0 0 0 1.5px var(--forest)" : "var(--shadow)",
                fontFamily: "inherit",
              }}
            >
              <span style={{ flex: 1 }}>
                <span style={{ display: "block", fontWeight: 500, lineHeight: 1.35 }}>{opt.title}</span>
                <span style={{ display: "block", marginTop: 4, fontSize: 14, color: "var(--muted)" }}>{opt.hint}</span>
              </span>
              <span
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 999,
                  border: on ? "none" : "1px solid var(--line-strong)",
                  background: on ? "var(--forest)" : "var(--surface)",
                  color: "var(--forest-fg)",
                  display: "grid",
                  placeItems: "center",
                  fontSize: 12,
                  flexShrink: 0,
                  marginTop: 2,
                }}
              >
                {on ? "✓" : ""}
              </span>
            </button>
          );
        })}
      </div>
      <Button type="button" size="lg" disabled={!selected} onClick={onContinue}>
        Continuar
      </Button>
    </div>
  );
}

function StepUpload({
  value,
  onChange,
  onContinue,
}: {
  value: Pick<Lead, "fileName" | "fileSize" | "fileDataUrl">;
  onChange: (v: Pick<Lead, "fileName" | "fileSize" | "fileDataUrl">) => void;
  onContinue: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  function takeFile(file?: File) {
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      setError("Arquivo acima de 8 MB.");
      return;
    }
    if (!/pdf|image/.test(file.type)) {
      setError("Envie PDF, JPG, PNG ou WEBP.");
      return;
    }
    setError(null);
    const reader = new FileReader();
    reader.onload = () =>
      onChange({
        fileName: file.name,
        fileSize: file.size,
        fileDataUrl: String(reader.result),
      });
    reader.readAsDataURL(file);
  }

  return (
    <div className="rise-in" style={{ display: "grid", gap: 24 }}>
      <header style={{ display: "grid", gap: 8 }}>
        <p style={{ margin: 0, fontSize: 12, fontWeight: 500, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--forest)" }}>Contrato</p>
        <h1 className="font-display" style={{ margin: 0, fontSize: 28, letterSpacing: "-0.03em" }}>
          Anexe o contrato para o pré-laudo
        </h1>
        <p style={{ margin: 0, fontSize: 14, color: "var(--muted)" }}>PDF ou foto. O arquivo fica neste dispositivo.</p>
      </header>

      <button
        type="button"
        onClick={() => document.getElementById("file-input")?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          takeFile(e.dataTransfer.files[0]);
        }}
        style={{
          minHeight: 176,
          borderRadius: "var(--radius-xl)",
          border: `1px dashed ${dragging ? "var(--forest)" : "var(--line-strong)"}`,
          background: dragging ? "var(--ok-soft)" : "var(--surface)",
          display: "grid",
          placeItems: "center",
          gap: 8,
          padding: 24,
          fontFamily: "inherit",
        }}
      >
        <span style={{ fontWeight: 500, fontSize: 14 }}>Toque para enviar ou solte o arquivo</span>
        <span style={{ fontSize: 12, color: "var(--muted)" }}>PDF, JPG, PNG · até 8 MB</span>
      </button>
      <input
        id="file-input"
        type="file"
        accept="application/pdf,image/jpeg,image/png,image/webp"
        style={{ display: "none" }}
        onChange={(e) => {
          takeFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      {value.fileName ? (
        <div style={{ display: "flex", alignItems: "center", gap: 12, background: "var(--surface)", padding: 12, borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow)" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value.fileName}</p>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--muted)" }}>{value.fileSize ? `${(value.fileSize / 1024).toFixed(0)} KB` : "anexo"}</p>
          </div>
          <button
            type="button"
            onClick={() => onChange({ fileName: null, fileSize: null, fileDataUrl: null })}
            style={{ border: "none", background: "transparent", color: "var(--muted)", width: 36, height: 36 }}
            aria-label="Remover"
          >
            ×
          </button>
        </div>
      ) : null}

      {error ? <p style={{ margin: 0, color: "var(--alert)", fontSize: 14 }}>{error}</p> : null}

      <div style={{ display: "grid", gap: 8 }}>
        <Button type="button" size="lg" onClick={onContinue} disabled={!value.fileName}>
          Enviar contrato e gerar Pix
        </Button>
        <Button type="button" variant="ghost" size="lg" onClick={onContinue}>
          Pular por enquanto
        </Button>
      </div>
    </div>
  );
}

function Success({
  lead,
  specialistWhatsapp,
  onReset,
}: {
  lead: Lead;
  specialistWhatsapp: string;
  onReset: () => void;
}) {
  const savings = lead.bacenMonthly != null
    ? estimateSavingsVsBacen({ currentInstallment: lead.parcela, bacenMonthlyPercent: lead.bacenMonthly })
    : null;
  const score = scoreLead(lead);
  const clientMsg = [
    `Olá! Sou ${lead.nome}.`,
    `Liberei o pré-laudo da Parcela Justa.`,
    `Contrato: ${lead.contractDate} · Parcela: ${formatBRL(lead.parcela)}.`,
    lead.bacenMonthly != null ? `Média Bacen na época: ${formatRate(lead.bacenMonthly)} a.m.` : "",
  ].filter(Boolean).join("\n");
  const href = specialistWhatsapp
    ? clientWaLink(specialistWhatsapp, clientMsg)
    : null;

  return (
    <div className="rise-in" style={{ display: "grid", gap: 24, textAlign: "center", paddingTop: 24 }}>
      <div style={{ width: 64, height: 64, margin: "0 auto", borderRadius: 999, background: "var(--ok-soft)", color: "var(--ok)", display: "grid", placeItems: "center", fontSize: 28 }}>
        ✓
      </div>
      <div>
        <h1 className="font-display" style={{ margin: 0, fontSize: 30, letterSpacing: "-0.03em" }}>
          Pré-laudo liberado
        </h1>
        <p style={{ margin: "8px 0 0", color: "var(--muted)" }}>
          Protocolo {lead.id.slice(0, 8).toUpperCase()} · prioridade interna: {tierLabel(score.tier)} ({score.points} pts).
          Um especialista entra em contato pelo WhatsApp informado.
        </p>
      </div>
      {savings ? (
        <div style={{ textAlign: "left", background: "var(--surface)", borderRadius: "var(--radius-lg)", padding: 16, boxShadow: "var(--shadow)" }}>
          <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>Economia estimada vs média Bacen</p>
          <p style={{ margin: "6px 0 0", fontSize: 18, fontWeight: 600 }}>{formatBRL(savings.totalSavings)} no prazo simulado</p>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--muted)" }}>
            {formatBRL(savings.monthlySavings)}/mês ({savings.savingsPercent.toFixed(1).replace(".", ",")}%)
          </p>
        </div>
      ) : null}
      <Button type="button" size="lg" onClick={() => openPrelaudoPrint(lead, savings)}>
        Baixar pré-laudo (PDF)
      </Button>
      {href ? (
        <a href={href} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
          <Button type="button" variant="secondary" size="lg" style={{ width: "100%" }}>
            Falar com o especialista
          </Button>
        </a>
      ) : null}
      <Button type="button" variant="ghost" size="lg" onClick={onReset}>
        Nova consulta
      </Button>
      <p style={{ margin: 0, fontSize: 11, color: "var(--subtle)" }}>
        Seus dados ficam neste aparelho. Para apagar, limpe o site no navegador ou peça exclusão à equipe (LGPD).
      </p>
    </div>
  );
}

function Backoffice({ onHome }: { onHome: () => void }) {
  const [authed, setAuthed] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [filter, setFilter] = useState<"todos" | "quitacao" | "prestamista" | "reduzir" | "pagos">("todos");
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!hasLocalSession()) {
        if (!cancelled) {
          setAuthed(false);
          setAuthChecking(false);
        }
        return;
      }
      const ok = await verifyBackofficeSession();
      if (!cancelled) {
        setAuthed(ok);
        setAuthChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!authed) return;
    setLeads(loadLeads());
    setSettings(loadSettings());
  }, [authed]);

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setAuthError(null);
    setAuthLoading(true);
    try {
      await loginBackofficeSmart(password);
      setAuthed(true);
      setPassword("");
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "Falha no login");
      setAuthed(false);
    } finally {
      setAuthLoading(false);
    }
  }

  function handleLogout() {
    clearBackofficeSession();
    setAuthed(false);
  }

  if (authChecking) {
    return (
      <div style={{ maxWidth: 420, margin: "48px auto", padding: 16, textAlign: "center" }}>
        <p style={{ color: "var(--muted)" }}>Verificando acesso…</p>
      </div>
    );
  }

  if (!authed) {
    return (
      <div style={{ maxWidth: 420, margin: "0 auto", padding: "48px 16px" }}>
        <button
          type="button"
          onClick={onHome}
          style={{ background: "none", border: "none", color: "var(--muted)", textDecoration: "underline", textUnderlineOffset: 4, fontSize: 14, marginBottom: 24, cursor: "pointer" }}
        >
          ← Voltar ao funil
        </button>
        <h1 className="font-display" style={{ margin: "0 0 8px", fontSize: 28 }}>
          Área da equipe
        </h1>
        <p style={{ margin: "0 0 20px", color: "var(--muted)", fontSize: 14, lineHeight: 1.5 }}>
          Acesso restrito. A senha é validada no servidor (variável de ambiente{" "}
          <code>BACKOFFICE_PASSWORD</code>) e não fica embutida no JavaScript público do funil.
        </p>
        <form onSubmit={handleLogin} style={{ display: "grid", gap: 14 }}>
          <Field label="Senha do painel">
            <Input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </Field>
          {authError ? (
            <p style={{ margin: 0, fontSize: 13, color: "var(--alert)" }}>{authError}</p>
          ) : null}
          <Button type="submit" size="lg" disabled={authLoading || !password}>
            {authLoading ? "Entrando…" : "Entrar"}
          </Button>
        </form>
        <p style={{ marginTop: 16, fontSize: 11, color: "var(--subtle)", lineHeight: 1.5 }}>
          Vercel → Project → Settings → Environment Variables → BACKOFFICE_PASSWORD
        </p>
      </div>
    );
  }


  const filtered = leads.filter((lead) => {
    if (filter === "quitacao") return lead.flags.quitacao;
    if (filter === "prestamista") return lead.flags.prestamista;
    if (filter === "reduzir") return lead.flags.reduzir;
    if (filter === "pagos") return lead.paid;
    return true;
  });

  function updateSettings<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    const next = { ...settings, [key]: value };
    setSettings(next);
    saveSettings(next);
  }

  function exportCsv() {
    const csv = leadsToCsv(leads);
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "leads-parcela-justa.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "24px 16px 48px" }}>
      <header style={{ display: "flex", flexWrap: "wrap", alignItems: "end", justifyContent: "space-between", gap: 16, marginBottom: 32 }}>
        <div>
          <BrandMark />
          <p style={{ margin: "8px 0 0", fontSize: 14, color: "var(--muted)" }}>Painel da equipe · leads neste aparelho · exportação CSV</p>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <button type="button" onClick={handleLogout} style={{ background: "none", border: "none", color: "var(--alert)", textDecoration: "underline", textUnderlineOffset: 4, fontSize: 14, cursor: "pointer" }}>
            Sair
          </button>
          <button type="button" onClick={onHome} style={{ background: "none", border: "none", color: "var(--muted)", textDecoration: "underline", textUnderlineOffset: 4, fontSize: 14, cursor: "pointer" }}>
            Voltar ao funil
          </button>
        </div>
      </header>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 32 }}>
        {[
          ["Leads", String(leads.length)],
          ["Pagos", String(leads.filter((l) => l.paid).length)],
          ["Quitação", String(leads.filter((l) => l.flags.quitacao).length)],
        ].map(([label, value]) => (
          <div key={label} style={{ background: "var(--surface)", borderRadius: "var(--radius-lg)", padding: 16, boxShadow: "var(--shadow)" }}>
            <p style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>{label}</p>
            <p className="font-display" style={{ margin: "4px 0 0", fontSize: 28, fontVariantNumeric: "tabular-nums" }}>
              {value}
            </p>
          </div>
        ))}
      </section>

      {(() => {
        const queue = unpaidContactQueue(leads);
        if (!queue.length) return null;
        return (
          <section style={{ background: "var(--alert-soft)", borderRadius: "var(--radius-xl)", padding: 20, marginBottom: 24, boxShadow: "var(--shadow)" }}>
            <h2 className="font-display" style={{ margin: 0, fontSize: 20, color: "var(--alert)" }}>
              Fila do dia · {queue.length} pago(s) sem contato
            </h2>
            <p style={{ margin: "6px 0 14px", fontSize: 13, color: "var(--muted)" }}>
              Leads que pagaram o pré-laudo e ainda não foram marcados como contactados.
            </p>
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
              {queue.map((lead) => {
                const sc = scoreLead(lead);
                const msg = buildSpecialistMessage(lead);
                const wa = clientWaLink(lead.whatsapp, msg);
                return (
                  <li key={lead.id} style={{ background: "var(--surface)", borderRadius: 12, padding: 12, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                      <strong>{lead.nome}</strong>
                      <span style={{ marginLeft: 8, fontSize: 12, color: "var(--muted)" }}>{tierLabel(sc.tier)} · {sc.points} pts</span>
                      <div style={{ fontSize: 13, color: "var(--muted)" }}>{lead.whatsapp} · {formatBRL(lead.parcela)}</div>
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {wa ? (
                        <a href={wa} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
                          <Button type="button" size="sm">WhatsApp</Button>
                        </a>
                      ) : null}
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => setLeads(markContacted(lead.id))}
                      >
                        Já falei
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })()}

      <section style={{ background: "var(--surface)", borderRadius: "var(--radius-xl)", padding: 20, boxShadow: "var(--shadow)", marginBottom: 32 }}>
        <h2 className="font-display" style={{ margin: 0, fontSize: 22 }}>
          Pix e atendimento · zero custo
        </h2>
        <p style={{ margin: "6px 0 16px", fontSize: 14, color: "var(--muted)" }}>
          Sem Mercado Pago. O QR é um Pix estático da sua chave. Leads ficam neste navegador.
        </p>
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          <Field label="Chave Pix">
            <Input value={settings.pixKey} onChange={(e) => updateSettings("pixKey", e.target.value)} />
          </Field>
          <Field label="Nome do recebedor">
            <Input value={settings.merchantName} onChange={(e) => updateSettings("merchantName", e.target.value)} />
          </Field>
          <Field label="Cidade">
            <Input value={settings.merchantCity} onChange={(e) => updateSettings("merchantCity", e.target.value)} />
          </Field>
          <Field label="Valor do pré-laudo (R$)">
            <Input inputMode="decimal" value={String(settings.amount)} onChange={(e) => updateSettings("amount", Number(e.target.value.replace(",", ".")) || 0)} />
          </Field>
          <Field label="WhatsApp do especialista">
            <Input inputMode="numeric" value={settings.specialistWhatsapp} onChange={(e) => updateSettings("specialistWhatsapp", e.target.value)} placeholder="11999999999" />
          </Field>
          <Field label="Webhook (opcional — n8n / Make / Apps Script)">
            <Input
              value={settings.webhookUrl}
              onChange={(e) => updateSettings("webhookUrl", e.target.value)}
              placeholder="https://hooks.exemplo.com/..."
            />
          </Field>
          <p style={{ margin: "-8px 0 0", fontSize: 12, color: "var(--muted)" }}>
            Ao clicar em “Já paguei”, enviamos JSON do lead para esta URL (CORS liberado no seu fluxo).
          </p>
        </div>
      </section>

      <section style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
          <h2 className="font-display" style={{ margin: 0, fontSize: 22 }}>
            Leads
          </h2>
          <div style={{ display: "flex", gap: 8 }}>
            <Button type="button" variant="secondary" size="sm" onClick={exportCsv} disabled={!leads.length}>
              CSV para Sheets
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                saveLeads([]);
                setLeads([]);
              }}
              disabled={!leads.length}
            >
              Limpar
            </Button>
          </div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
          {(
            [
              ["todos", "Todos"],
              ["quitacao", "Quitação"],
              ["prestamista", "Prestamista"],
              ["reduzir", "Reduzir"],
              ["pagos", "Pagos"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(id)}
              style={{
                height: 36,
                borderRadius: 999,
                border: "none",
                padding: "0 12px",
                fontSize: 13,
                fontFamily: "inherit",
                background: filter === id ? "var(--forest)" : "var(--surface)",
                color: filter === id ? "var(--forest-fg)" : "var(--muted)",
                boxShadow: filter === id ? "none" : "var(--shadow)",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <p style={{ margin: 0, textAlign: "center", padding: 32, background: "var(--surface)", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow)", color: "var(--muted)", fontSize: 14 }}>
            Nenhum lead neste filtro.
          </p>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
            {filtered.map((lead) => {
              const priority = leadPriority(lead);
              return (
                <li key={lead.id} style={{ background: "var(--surface)", borderRadius: "var(--radius-lg)", padding: 16, boxShadow: "var(--shadow)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                    <div>
                      <p style={{ margin: 0, fontWeight: 500 }}>{lead.nome}</p>
                      <p style={{ margin: "2px 0 0", fontSize: 14, color: "var(--muted)" }}>
                        {maskPhone(lead.whatsapp)} · {maskCpfHidden(lead.cpf)}
                      </p>
                    </div>
                    <span
                      style={{
                        borderRadius: 999,
                        padding: "4px 10px",
                        fontSize: 12,
                        fontWeight: 500,
                        background: priority === "maxima" ? "var(--alert-soft)" : priority === "alta" ? "var(--ok-soft)" : "var(--bg)",
                        color: priority === "maxima" ? "var(--alert)" : priority === "alta" ? "var(--ok)" : "var(--muted)",
                      }}
                    >
                      {priorityLabel(priority)}
                    </span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8, marginTop: 12, fontSize: 14 }}>
                    <div>
                      <div style={{ fontSize: 12, color: "var(--muted)" }}>Contrato</div>
                      <div style={{ fontVariantNumeric: "tabular-nums" }}>{monthLabel(lead.contractDate)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: "var(--muted)" }}>Parcela</div>
                      <div style={{ fontVariantNumeric: "tabular-nums" }}>{formatBRL(lead.parcela)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: "var(--muted)" }}>Bacen</div>
                      <div style={{ fontVariantNumeric: "tabular-nums" }}>{lead.bacenMonthly != null ? `${formatRate(lead.bacenMonthly)} a.m.` : "—"}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: "var(--muted)" }}>Pago / contato</div>
                      <div>{lead.paid ? "Pago" : "Não"}{lead.contactedAt ? " · falado" : lead.paid ? " · pendente" : ""}</div>
                    </div>
                  </div>
                  {(() => {
                    const sc = scoreLead(lead);
                    const savings = lead.bacenMonthly != null
                      ? estimateSavingsVsBacen({ currentInstallment: lead.parcela, bacenMonthlyPercent: lead.bacenMonthly })
                      : null;
                    const msg = buildSpecialistMessage(lead);
                    const wa = clientWaLink(lead.whatsapp, msg);
                    return (
                      <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                        <span style={{ fontSize: 12, color: "var(--muted)" }}>
                          Score {sc.points} · {tierLabel(sc.tier)}
                          {savings ? ` · econ. ~${formatBRL(savings.monthlySavings)}/mês` : ""}
                        </span>
                        <div style={{ flex: 1 }} />
                        {wa ? (
                          <a href={wa} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
                            <Button type="button" size="sm">WhatsApp (template)</Button>
                          </a>
                        ) : null}
                        <Button type="button" variant="secondary" size="sm" onClick={() => openPrelaudoPrint(lead, savings)}>
                          Pré-laudo PDF
                        </Button>
                        {lead.paid && !lead.contactedAt ? (
                          <Button type="button" variant="ghost" size="sm" onClick={() => setLeads(markContacted(lead.id))}>
                            Já falei
                          </Button>
                        ) : null}
                      </div>
                    );
                  })()}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section style={{ background: "var(--surface)", borderRadius: "var(--radius-xl)", padding: 20, boxShadow: "var(--shadow)" }}>
        <h2 className="font-display" style={{ margin: 0, fontSize: 22 }}>
          Fórmulas do Google Sheets
        </h2>
        <p style={{ margin: "6px 0 16px", fontSize: 14, color: "var(--muted)" }}>
          Importe o CSV para uma aba chamada <strong>Leads</strong>. Separador brasileiro (;).
        </p>
        {(
          [
            ["prioridade", "Coluna N · Prioridade", SHEETS_FORMULAS.prioridade],
            ["quitacao", "Aba Prioridade máxima (Quitação)", SHEETS_FORMULAS.abaQuitacao],
            ["prestamista", "Aba Prestamista", SHEETS_FORMULAS.abaPrestamista],
            ["pagos", "Aba Pagos", SHEETS_FORMULAS.abaPagos],
          ] as const
        ).map(([key, title, value]) => (
          <div key={key} style={{ background: "var(--bg)", borderRadius: 8, padding: 12, marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 500 }}>{title}</p>
              <button
                type="button"
                onClick={async () => {
                  await navigator.clipboard.writeText(value);
                  setCopied(key);
                  window.setTimeout(() => setCopied(null), 1500);
                }}
                style={{ border: "none", background: "none", color: "var(--muted)", fontSize: 12 }}
              >
                {copied === key ? "Copiado" : "Copiar"}
              </button>
            </div>
            <pre style={{ margin: 0, overflowX: "auto", fontFamily: "ui-monospace, monospace", fontSize: 11, color: "var(--muted)", whiteSpace: "pre-wrap" }}>{value}</pre>
          </div>
        ))}
      </section>
    </div>
  );
}
