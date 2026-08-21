import { stripAccents } from "./br";

function emv(id: string, value: string) {
  const len = value.length.toString().padStart(2, "0");
  return `${id}${len}${value}`;
}

function crc16(payload: string) {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export type PixInput = {
  pixKey: string;
  merchantName: string;
  merchantCity: string;
  amount: number;
  txid: string;
  description?: string;
};

export function buildPixPayload(input: PixInput) {
  const key = input.pixKey.trim();
  const name = stripAccents(input.merchantName).toUpperCase().slice(0, 25);
  const city = stripAccents(input.merchantCity).toUpperCase().slice(0, 15);
  const amount = input.amount.toFixed(2);
  const txid = input.txid.replace(/[^A-Za-z0-9]/g, "").slice(0, 25) || "***";
  const description = input.description ? stripAccents(input.description).slice(0, 25) : "";

  const merchantAccount = emv(
    "26",
    emv("00", "br.gov.bcb.pix") + emv("01", key) + (description ? emv("02", description) : ""),
  );

  const payload =
    emv("00", "01") +
    emv("01", "11") +
    merchantAccount +
    emv("52", "0000") +
    emv("53", "986") +
    emv("54", amount) +
    emv("58", "BR") +
    emv("59", name) +
    emv("60", city) +
    emv("62", emv("05", txid)) +
    "6304";

  return payload + crc16(payload);
}
