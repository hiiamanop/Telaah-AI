export const MAX_PROMPT_CHARS = 4000;

const INJECTION_PATTERNS = [
  /ignore (all )?previous instructions/i,
  /abaikan (semua )?instruksi (sebelumnya|di atas)/i,
  /system prompt/i,
  /reveal (your |the )?(prompt|instructions)/i,
  /bocorkan (prompt|instruksi)/i,
  /jailbreak/i,
  /developer mode/i,
  /act as (a )?different/i,
  /you are now (a )?/i,
];

export function sanitizeUserPrompt(raw: unknown): { text: string; tooLong: boolean } {
  if (typeof raw !== "string") return { text: "", tooLong: false };
  const tooLong = raw.length > MAX_PROMPT_CHARS;
  const text = raw
    .normalize("NFKC")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_PROMPT_CHARS);
  return { text, tooLong };
}

export function looksLikePromptInjection(text: string): boolean {
  return INJECTION_PATTERNS.some((pattern) => pattern.test(text));
}

export type ConversationalIntent = "greeting" | "thanks" | "capabilities";

export function detectConversationalIntent(text: string): ConversationalIntent | null {
  const value = text.trim().toLowerCase();
  if (!value) return null;

  const hasExplicitTicker =
    /\b[A-Z]{4}\b/.test(text) || /(?:saham|emiten|kode)\s+[a-z]{4}\b/i.test(text);
  const isShort = value.split(/\s+/).filter(Boolean).length <= 3;

  if (
    isShort &&
    !hasExplicitTicker &&
    /^(halo|hallo|hai|hi|hello|hey|pagi|siang|sore|malam|selamat (pagi|siang|sore|malam)|assalamualaikum|salam)\b/.test(
      value
    )
  ) {
    return "greeting";
  }
  if (/^(makasih|terima kasih|thanks|thank you|thx)\b/.test(value)) {
    return "thanks";
  }
  if (
    /^(apa (yang )?bisa kamu|lakukan|fitur|siapa kamu|kamu siapa|bantuan|help|bisa bantu apa)\b/.test(
      value
    )
  ) {
    return "capabilities";
  }
  return null;
}

export function conversationalReply(intent: ConversationalIntent): string {
  if (intent === "thanks") {
    return "Sama-sama. Kalau mau lanjut, sebutkan kode saham IDX (contoh: **BBCA**, **TLKM**, **ANTM**) atau nama perusahaannya.";
  }
  if (intent === "capabilities") {
    return [
      "Saya **Telaah 360**, asisten riset emiten IDX berbasis data pasar publik.",
      "",
      "Yang bisa saya bantu:",
      "- ringkasan fundamental & laporan kuartalan",
      "- valuasi (PER/PBV), peers, dan profil emiten",
      "- teknikal (tren, RSI, SMA, support/resistance)",
      "- foreign flow dan insider filings bila tersedia",
      "- trading plan probabilistik dan audit bukti",
      "",
      "Sebutkan kode saham atau nama perusahaan untuk mulai, misalnya: **Analisis BBCA**.",
    ].join("\n");
  }
  return [
    "Halo! Saya **Telaah 360**, asisten riset emiten IDX.",
    "",
    "Sebutkan kode saham atau nama perusahaan yang ingin ditelaah — misalnya **BBCA**, **TLKM**, atau **ANTM**.",
    "Saya bisa bantu fundamental, valuasi, teknikal, flow, insider, dan trading plan. Bukan rekomendasi beli/jual.",
  ].join("\n");
}

export const NO_SYMBOL_MESSAGE = [
  "Saya belum menemukan kode saham IDX yang valid dalam pesan itu.",
  "",
  "Coba sebutkan **kode 4 huruf** atau nama perusahaannya, contoh:",
  "- `Analisis BBCA`",
  "- `Bagaimana valuasi TLKM?`",
  "- `Bandingkan ANTM vs INCO`",
  "",
  "Kalau kamu bertanya tentang sektor, sebutkan emiten yang ingin dibandingkan agar saya bisa mengambil data yang tepat.",
].join("\n");

export const INJECTION_REFUSAL =
  "Saya tidak bisa mengikuti instruksi yang mencoba mengubah aturan sistem atau membocorkan prompt. " +
  "Saya tetap bisa membantu riset emiten IDX — sebutkan kode saham atau pertanyaan pasar yang konkret.";
