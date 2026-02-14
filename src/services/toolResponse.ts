export function textResult(payload: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(payload) }],
  };
}

function detectErrorCode(error: unknown): "PERMISSION_DENIED" | "AUTH_FAILED" | "TOOL_ERROR" {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const lowered = message.toLowerCase();
  if (lowered.includes("permission") || message.includes("권한")) {
    return "PERMISSION_DENIED";
  }
  if (
    lowered.includes("token") ||
    lowered.includes("jwt") ||
    message.includes("인증") ||
    message.includes("로그인")
  ) {
    return "AUTH_FAILED";
  }
  return "TOOL_ERROR";
}

export function errorResult(prefix: string, error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown error";
  const code = detectErrorCode(error);
  return {
    content: [{ type: "text" as const, text: `[${code}] ${prefix}: ${message}` }],
    isError: true,
  };
}

