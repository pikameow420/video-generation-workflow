export function muapiV1Root(baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/api/v1`;
}

export function extractMuapiRequestId(
  json: Record<string, unknown>,
  context = "MuAPI job",
): string {
  const id =
    json.request_id ??
    json.requestId ??
    json.id ??
    (typeof json.data === "object" &&
    json.data !== null &&
    "request_id" in json.data
      ? (json.data as { request_id?: string }).request_id
      : undefined);
  if (!id || typeof id !== "string") {
    throw new Error(
      `${context}: missing request_id (${JSON.stringify(json).slice(0, 500)})`,
    );
  }
  return id;
}

export function throwMuapiHttpError(path: string, status: number, text: string): never {
  if (status === 402) {
    throw new Error("MuAPI: insufficient credits.");
  }
  if (status === 429) {
    throw new Error("MuAPI: rate limited. Retry later.");
  }
  throw new Error(`MuAPI ${path} failed (${status}): ${text || "request failed"}`);
}

export async function postMuapiJson(params: {
  apiKey: string;
  baseUrl: string;
  path: string;
  body: Record<string, unknown>;
  context?: string;
}): Promise<{ requestId: string; json: Record<string, unknown> }> {
  const root = muapiV1Root(params.baseUrl);
  const path = params.path.replace(/^\/+/, "");
  const res = await fetch(`${root}/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": params.apiKey,
    },
    body: JSON.stringify(params.body),
  });

  const text = await res.text();
  let json: Record<string, unknown> = {};
  try {
    json = JSON.parse(text) as Record<string, unknown>;
  } catch {
    json = {};
  }

  if (!res.ok) {
    throwMuapiHttpError(path, res.status, text);
  }

  return {
    requestId: extractMuapiRequestId(json, params.context ?? "MuAPI job"),
    json,
  };
}
