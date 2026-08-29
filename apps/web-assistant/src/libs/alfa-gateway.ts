import { getAlfaGatewayUrl, isAlfaSecureMode } from "@/services/alfa"

export type AlfaDecision = "ALLOW" | "SANITIZE" | "HOLD" | "BLOCK"

export type BrowserScanResponse = {
  decision: AlfaDecision
  content?: string
  riskScore: number
  signals: string[]
  requestId: string
}

export class AlfaHoldError extends Error {
  verdict: BrowserScanResponse
  constructor(verdict: BrowserScanResponse) {
    super(
      `ALFA HOLD ${verdict.requestId} risk=${verdict.riskScore} ${verdict.signals.join(", ")}`
    )
    this.name = "AlfaHoldError"
    this.verdict = verdict
  }
}

export class AlfaBlockError extends Error {
  verdict: BrowserScanResponse
  constructor(verdict: BrowserScanResponse) {
    super(
      `ALFA BLOCK ${verdict.requestId} risk=${verdict.riskScore} ${verdict.signals.join(", ")}`
    )
    this.name = "AlfaBlockError"
    this.verdict = verdict
  }
}

export async function scanTabContent(input: {
  url: string
  title?: string
  content: string
}): Promise<string> {
  const secure = await isAlfaSecureMode()
  if (!secure) {
    return input.content
  }

  const base = await getAlfaGatewayUrl()
  let verdict: BrowserScanResponse

  try {
    const response = await fetch(`${base}/api/browser/scan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: input.url,
        title: input.title,
        content: input.content,
        source: "page-assist"
      })
    })
    verdict = (await response.json()) as BrowserScanResponse
  } catch (e) {
    throw new AlfaHoldError({
      decision: "HOLD",
      riskScore: 1,
      signals: ["gateway_unreachable"],
      requestId: "local-unreachable"
    })
  }

  switch (verdict.decision) {
    case "ALLOW":
      return input.content
    case "SANITIZE":
      return verdict.content ?? ""
    case "HOLD":
      throw new AlfaHoldError(verdict)
    case "BLOCK":
      throw new AlfaBlockError(verdict)
    default:
      throw new AlfaHoldError({
        decision: "HOLD",
        riskScore: 1,
        signals: ["unknown_decision"],
        requestId: verdict.requestId || "unknown"
      })
  }
}

export function formatAlfaGateMessage(err: unknown): string | null {
  if (err instanceof AlfaHoldError) {
    return [
      "ALFA HOLD — treść strony nie poszła do modelu.",
      `requestId: ${err.verdict.requestId}`,
      `signals: ${err.verdict.signals.join(", ") || "none"}`,
      "Zatwierdź w dashboardzie AlfaBrowserautomation (HOLD queue)."
    ].join("\n")
  }
  if (err instanceof AlfaBlockError) {
    return [
      "ALFA BLOCK — treść strony zablokowana.",
      `requestId: ${err.verdict.requestId}`,
      `signals: ${err.verdict.signals.join(", ") || "none"}`
    ].join("\n")
  }
  return null
}
