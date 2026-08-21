export type AppSettings = {
  pixKey: string;
  merchantName: string;
  merchantCity: string;
  amount: number;
  specialistWhatsapp: string;
  /** URL opcional (n8n / Make / Apps Script) ao confirmar pagamento */
  webhookUrl: string;
};

export const DEFAULT_SETTINGS: AppSettings = {
  pixKey: "parcela.justa@demo.com",
  merchantName: "Parcela Justa",
  merchantCity: "SAO PAULO",
  amount: 4.9,
  specialistWhatsapp: "",
  webhookUrl: "",
};

export const SETTINGS_KEY = "parcela-justa-settings";

export function isDemoPixKey(key: string) {
  return key.trim().toLowerCase() === DEFAULT_SETTINGS.pixKey;
}

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      amount: Number(parsed.amount) > 0 ? Number(parsed.amount) : DEFAULT_SETTINGS.amount,
      webhookUrl: typeof parsed.webhookUrl === "string" ? parsed.webhookUrl : "",
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: AppSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}
