import type { FunnelFlags, Lead } from "./leads";

export type LeadScore = {
  points: number;
  tier: "quente" | "morno" | "frio";
  reasons: string[];
};

export function scoreFlags(flags: FunnelFlags) {
  let points = 0;
  const reasons: string[] = [];
  if (flags.quitacao) {
    points += 100;
    reasons.push("Quitação (+100)");
  }
  if (flags.prestamista) {
    points += 70;
    reasons.push("Prestamista (+70)");
  }
  if (flags.reduzir) {
    points += 40;
    reasons.push("Reduzir parcela (+40)");
  }
  return { points, reasons };
}

export function scoreLead(lead: Lead): LeadScore {
  const { points: flagPoints, reasons } = scoreFlags(lead.flags);
  let points = flagPoints;

  if (lead.parcela >= 1500) {
    points += 25;
    reasons.push("Parcela alta (+25)");
  } else if (lead.parcela >= 800) {
    points += 10;
    reasons.push("Parcela média (+10)");
  }

  if (lead.paid) {
    points += 30;
    reasons.push("Pago (+30)");
  }

  if (lead.fileName) {
    points += 15;
    reasons.push("Contrato anexado (+15)");
  }

  if (lead.bacenMonthly != null && lead.bacenMonthly >= 2) {
    points += 10;
    reasons.push("Taxa média Bacen elevada (+10)");
  }

  let tier: LeadScore["tier"] = "frio";
  if (points >= 130) tier = "quente";
  else if (points >= 70) tier = "morno";

  return { points, tier, reasons };
}

export function tierLabel(tier: LeadScore["tier"]) {
  if (tier === "quente") return "Quente";
  if (tier === "morno") return "Morno";
  return "Frio";
}
