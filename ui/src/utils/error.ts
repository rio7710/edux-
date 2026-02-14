export function parseMcpError(errorMessage: string): string {
  if (errorMessage.includes("MCP error")) {
    const match = errorMessage.match(/MCP error -?\d+: (.+)/);
    if (match) return match[1];
  }
  return errorMessage;
}

export function isAuthErrorMessage(messageText: string): boolean {
  return /인증|토큰|로그인|권한|세션|MCP 연결 시간이 초과되었습니다|요청 시간이 초과되었습니다/.test(
    messageText,
  );
}
