import { getEnv } from "@/lib/env";
import { getMuapiPredictionResult, type MuapiPredictionResult } from "@/lib/muapi/client";

export function extractMuapiOutputUrl(result: MuapiPredictionResult): string | undefined {
  const outs = result.outputs ?? result.output;
  if (Array.isArray(outs) && outs.length && typeof outs[0] === "string") {
    return outs[0];
  }
  if (typeof outs === "string") return outs;
  if (result.url && typeof result.url === "string") return result.url;
  return undefined;
}

function extractErrorMessage(error: unknown): string {
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) {
    const m = (error as { message?: unknown }).message;
    if (typeof m === "string") return m;
  }
  return "MuAPI job failed";
}

export async function waitForMuapiJobOutput(requestId: string): Promise<string> {
  const env = getEnv();
  const apiKey = env.MUAPI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("MUAPI_API_KEY is required");
  }

  const deadline = Date.now() + env.MUAPI_POLL_MAX_MS;
  while (Date.now() < deadline) {
    const { ok, data } = await getMuapiPredictionResult({
      apiKey,
      baseUrl: env.MUAPI_BASE_URL,
      requestId,
    });

    if (!ok) {
      throw new Error(extractErrorMessage(data.error));
    }

    const status = String(data.status ?? "").toLowerCase();
    if (status === "completed" || status === "succeeded") {
      const url = extractMuapiOutputUrl(data);
      if (!url) {
        throw new Error("MuAPI returned success but no output URL was found");
      }
      return url;
    }

    if (status === "failed") {
      throw new Error(extractErrorMessage(data.error));
    }

    await new Promise((r) => setTimeout(r, env.MUAPI_POLL_INTERVAL_MS));
  }

  throw new Error("Timed out waiting for MuAPI job");
}
