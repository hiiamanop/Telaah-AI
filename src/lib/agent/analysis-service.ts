import { classifyInputAndExtractClaims } from "./classifier";
import { executeEvidencePlan } from "./coordinator";
import { synthesizeIntelligenceReport } from "./synthesizer";
import { AnalysisMode, CompanyIntelligenceReport } from "./types";
import {
  INJECTION_REFUSAL,
  NO_SYMBOL_MESSAGE,
  conversationalReply,
  detectConversationalIntent,
  detectSectorRequest,
  looksLikePromptInjection,
  sanitizeUserPrompt,
} from "./conversation";
import { buildBankShortlistMessage } from "@/lib/screener/bank-screener";
import { getMarketProvider } from "@/lib/market";
import {
  searchSemanticReportCache,
  upsertReportToVectorCache,
} from "@/lib/vector/qdrant";

export type AnalysisResult =
  | { type: "error"; status: number; message: string }
  | { type: "message"; message: string }
  | {
      type: "confirmation";
      candidateSymbol: string;
      message: string;
      classification: unknown;
    }
  | { type: "report"; report: CompanyIntelligenceReport };

export interface AnalysisInput {
  prompt: unknown;
  mode?: AnalysisMode | string;
  confirmedSymbol?: unknown;
}

export async function runAnalysis(input: AnalysisInput): Promise<AnalysisResult> {
  const { text: prompt, tooLong } = sanitizeUserPrompt(input.prompt);
  const mode: AnalysisMode = input.mode === "quick" ? "quick" : "full";
  const confirmedSymbol = String(input.confirmedSymbol || "")
    .trim()
    .toUpperCase()
    .replace(".JK", "");

  if (!prompt) {
    return {
      type: "error",
      status: 400,
      message: "Prompt atau teks analisis tidak boleh kosong.",
    };
  }
  if (tooLong) {
    return {
      type: "error",
      status: 400,
      message: "Prompt terlalu panjang (maksimal 4000 karakter).",
    };
  }
  if (looksLikePromptInjection(prompt)) {
    return { type: "message", message: INJECTION_REFUSAL };
  }

  const sectorRequest = detectSectorRequest(prompt);
  if (sectorRequest) {
    return { type: "message", message: await buildBankShortlistMessage() };
  }

  const conversationalIntent = detectConversationalIntent(prompt);
  if (conversationalIntent) {
    return { type: "message", message: conversationalReply(conversationalIntent) };
  }

  // Fast-path: Check semantic cache if confirmedSymbol is passed
  if (confirmedSymbol && /^[A-Z]{4}$/.test(confirmedSymbol)) {
    const cacheCheck = await searchSemanticReportCache(prompt, confirmedSymbol, 0.88, mode);
    if (cacheCheck.isMatch && cacheCheck.isFresh && cacheCheck.payload?.report) {
      return {
        type: "report",
        report: {
          ...cacheCheck.payload.report,
          fromVectorCache: true,
          cacheScore: Number(cacheCheck.score.toFixed(3)),
          cacheDate: cacheCheck.payload.capturedDate,
        },
      };
    }
  }

  // Step 1: Input Classification & Claim Extraction
  // Fast-path: Jika confirmedSymbol sudah valid dan prompt hanya berupa lookup emiten standar, bypass LLM classifier
  let classification: any;
  const isDirectLookup =
    confirmedSymbol &&
    /^[A-Z]{4}$/.test(confirmedSymbol) &&
    (prompt.includes("Analisis komprehensif emiten") || prompt.trim() === confirmedSymbol);

  if (isDirectLookup) {
    classification = {
      symbol: confirmedSymbol,
      intent: "company_overview",
      isAmbiguous: false,
      claims: [],
      explanation: `Direct lookup for ${confirmedSymbol}`,
    };
  } else {
    classification = await classifyInputAndExtractClaims(prompt);
  }

  const targetSymbol = confirmedSymbol || classification.symbol;

  if (!targetSymbol || !/^[A-Z]{4}$/.test(targetSymbol)) {
    const candidateSymbol = String(classification.symbol || "")
      .toUpperCase()
      .replace(".JK", "");
    if (/^[A-Z]{4}$/.test(candidateSymbol)) {
      return {
        type: "confirmation",
        candidateSymbol,
        message:
          "Tidak dapat mendeteksi kode saham IDX 4 huruf secara pasti. Silakan konfirmasi kode saham.",
        classification,
      };
    }
    return { type: "message", message: NO_SYMBOL_MESSAGE };
  }

  // Step 1b: Semantic Vector Cache Check with targetSymbol
  const cacheHit = await searchSemanticReportCache(prompt, targetSymbol, 0.88, mode);
  if (cacheHit.isMatch && cacheHit.isFresh && cacheHit.payload?.report) {
    return {
      type: "report",
      report: {
        ...cacheHit.payload.report,
        fromVectorCache: true,
        cacheScore: Number(cacheHit.score.toFixed(3)),
        cacheDate: cacheHit.payload.capturedDate,
      },
    };
  }

  // Step 2: Coordinator & Evidence Collection (Cache Miss / Stale Day)
  const provider = getMarketProvider();
  const evidence = await executeEvidencePlan(
    provider,
    targetSymbol,
    mode,
    classification.intent,
    classification.claims
  );

  // Step 3: Synthesis Guard & Final Report Generation
  const report = await synthesizeIntelligenceReport(
    evidence,
    prompt,
    mode,
    classification.intent,
    classification.claims
  );

  // Step 4: Asynchronously update Qdrant Vector Cache with today's capturedDate
  upsertReportToVectorCache(prompt, targetSymbol, report, mode).catch((err) => {
    console.warn("Failed to async upsert report to Qdrant:", err);
  });

  return { type: "report", report };
}
