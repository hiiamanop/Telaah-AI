import { NextRequest, NextResponse } from "next/server";
import { runAnalysis } from "@/lib/agent/analysis-service";
import { marketDataErrorMessage } from "@/lib/market/errors";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = await runAnalysis({
      prompt: body.prompt,
      mode: body.mode,
      confirmedSymbol: body.confirmedSymbol,
    });

    if (result.type === "error") {
      return NextResponse.json({ error: result.message }, { status: result.status });
    }

    if (result.type === "message") {
      return NextResponse.json({
        success: true,
        assistantMessage: result.message,
        conversation: true,
      });
    }

    if (result.type === "confirmation") {
      return NextResponse.json(
        {
          needsConfirmation: true,
          candidateSymbol: result.candidateSymbol,
          message: result.message,
          classification: result.classification,
        },
        { status: 200 }
      );
    }

    return NextResponse.json({ success: true, report: result.report });
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
