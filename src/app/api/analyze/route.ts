import { NextRequest, NextResponse } from "next/server";
import { classifyInputAndExtractClaims } from "@/lib/agent/classifier";
import { executeEvidencePlan } from "@/lib/agent/coordinator";
import { synthesizeIntelligenceReport } from "@/lib/agent/synthesizer";
import { AnalysisMode } from "@/lib/agent/types";
import {
  INJECTION_REFUSAL,
  NO_SYMBOL_MESSAGE,
  conversationalReply,
  detectConversationalIntent,
  looksLikePromptInjection,
  sanitizeUserPrompt,
} from "@/lib/agent/conversation";
import { marketDataErrorMessage } from "@/lib/market/errors";
import { getMarketProvider } from "@/lib/market";
import {
  searchSemanticReportCache,
  upsertReportToVectorCache,
  getTodayWIB,
} from "@/lib/vector/qdrant";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text: prompt, tooLong } = sanitizeUserPrompt(body.prompt);
    const mode: AnalysisMode = body.mode === "quick" ? "quick" : "full";
    const confirmedSymbol = String(body.confirmedSymbol || "")
      .trim()
      .toUpperCase()
      .replace(".JK", "");

    if (!prompt) {
      return NextResponse.json(
        { error: "Prompt atau teks analisis tidak boleh kosong." },
        { status: 400 }
      );
    }
    if (tooLong) {
      return NextResponse.json(
        { error: `Prompt terlalu panjang (maksimal 4000 karakter).` },
        { status: 400 }
      );
    }
    if (looksLikePromptInjection(prompt)) {
      return NextResponse.json({
        success: true,
        assistantMessage: INJECTION_REFUSAL,
        conversation: true,
      });
    }

    const conversationalIntent = detectConversationalIntent(prompt);
    if (conversationalIntent) {
      return NextResponse.json({
        success: true,
        assistantMessage: conversationalReply(conversationalIntent),
        conversation: true,
      });
    }

    // Fast-path: Check semantic cache if confirmedSymbol is passed
    if (confirmedSymbol && /^[A-Z]{4}$/.test(confirmedSymbol)) {
      const cacheCheck = await searchSemanticReportCache(prompt, confirmedSymbol, 0.88, mode);
      if (cacheCheck.isMatch && cacheCheck.isFresh && cacheCheck.payload?.report) {
        return NextResponse.json({
          success: true,
          report: {
            ...cacheCheck.payload.report,
            fromVectorCache: true,
            cacheScore: Number(cacheCheck.score.toFixed(3)),
            cacheDate: cacheCheck.payload.capturedDate,
          },
        });
      }
    }

    // Step 1: Input Classification & Claim Extraction
    // Fast-path: Jika confirmedSymbol sudah valid dan prompt hanya berupa lookup emiten standar, bypass LLM classifier
    let classification: any;
    const isDirectLookup = confirmedSymbol && /^[A-Z]{4}$/.test(confirmedSymbol) && 
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
        return NextResponse.json(
          {
            needsConfirmation: true,
            candidateSymbol,
            message: "Tidak dapat mendeteksi kode saham IDX 4 huruf secara pasti. Silakan konfirmasi kode saham.",
            classification,
          },
          { status: 200 }
        );
      }
      return NextResponse.json({
        success: true,
        assistantMessage: NO_SYMBOL_MESSAGE,
        conversation: true,
        classification,
      });
    }

    // Step 1b: Semantic Vector Cache Check with targetSymbol
    const cacheHit = await searchSemanticReportCache(prompt, targetSymbol, 0.88, mode);
    if (cacheHit.isMatch && cacheHit.isFresh && cacheHit.payload?.report) {
      return NextResponse.json({
        success: true,
        report: {
          ...cacheHit.payload.report,
          fromVectorCache: true,
          cacheScore: Number(cacheHit.score.toFixed(3)),
          cacheDate: cacheHit.payload.capturedDate,
        },
      });
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

    return NextResponse.json({ success: true, report });
  } catch (error: any) {
    console.error("Error in /api/analyze:", error);
    return NextResponse.json(
      {
        error: marketDataErrorMessage(error),
        code: error?.kind || "analysis_error",
      },
      { status: 500 }
    );
  }
}
