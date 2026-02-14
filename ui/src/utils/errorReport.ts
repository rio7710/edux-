export type ClientErrorPhase =
  | "connect"
  | "request_timeout"
  | "jsonrpc_error"
  | "tool_result_error"
  | "http_error"
  | "network_error"
  | "message_parse";

export type ClientErrorReport = {
  id: string;
  createdAt: string;
  phase: ClientErrorPhase;
  toolName: string;
  pagePath: string;
  pageUrl: string;
  requestId?: number;
  sessionId?: string | null;
  baseUrl?: string;
  httpStatus?: number;
  responseBody?: string;
  args?: unknown;
  message: string;
  stack?: string;
  extra?: Record<string, unknown>;
};

type RecordClientErrorInput = {
  phase: ClientErrorPhase;
  toolName: string;
  args?: unknown;
  requestId?: number;
  sessionId?: string | null;
  baseUrl?: string;
  httpStatus?: number;
  responseBody?: string;
  error: unknown;
  extra?: Record<string, unknown>;
};

const STORAGE_KEY = "edux_client_error_reports";
const MAX_REPORTS = 200;
const MAX_STRING_LENGTH = 1000;
const SENSITIVE_KEY_REGEX = /(token|password|secret|authorization|cookie|key)/i;

const toError = (error: unknown): Error => {
  if (error instanceof Error) return error;
  if (typeof error === "string") return new Error(error);
  return new Error("Unknown error");
};

const truncate = (value: string) =>
  value.length > MAX_STRING_LENGTH ? `${value.slice(0, MAX_STRING_LENGTH)}...[truncated]` : value;

const sanitizeValue = (value: unknown, depth = 0): unknown => {
  if (depth > 6) return "[depth_limit]";
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return truncate(value);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.map((item) => sanitizeValue(item, depth + 1));
  if (typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEY_REGEX.test(key)) {
        output[key] = "[REDACTED]";
      } else {
        output[key] = sanitizeValue(raw, depth + 1);
      }
    }
    return output;
  }
  return String(value);
};

const readReports = (): ClientErrorReport[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as ClientErrorReport[]) : [];
  } catch {
    return [];
  }
};

const writeReports = (reports: ClientErrorReport[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(reports));
  } catch {
    // Ignore storage failures to avoid breaking UX
  }
};

export const getClientErrorReports = (): ClientErrorReport[] => readReports();

export const clearClientErrorReports = () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage failures to avoid breaking UX
  }
};

export const downloadClientErrorReports = (reports?: ClientErrorReport[]): string | null => {
  const target = reports ?? readReports();
  if (target.length === 0) return null;
  const filename = `edux-client-error-reports-${new Date()
    .toISOString()
    .replace(/[:.]/g, "-")}.json`;
  const blob = new Blob([JSON.stringify(target, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(objectUrl);
  return filename;
};

export const recordClientErrorReport = (input: RecordClientErrorInput): ClientErrorReport => {
  const normalizedError = toError(input.error);
  const report: ClientErrorReport = {
    id: `cer_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    phase: input.phase,
    toolName: input.toolName,
    pagePath: window.location.pathname,
    pageUrl: window.location.href,
    requestId: input.requestId,
    sessionId: input.sessionId ?? null,
    baseUrl: input.baseUrl,
    httpStatus: input.httpStatus,
    responseBody: input.responseBody ? truncate(input.responseBody) : undefined,
    args: sanitizeValue(input.args),
    message: normalizedError.message,
    stack: normalizedError.stack ? truncate(normalizedError.stack) : undefined,
    extra: input.extra ? (sanitizeValue(input.extra) as Record<string, unknown>) : undefined,
  };

  const reports = readReports();
  writeReports([report, ...reports].slice(0, MAX_REPORTS));
  return report;
};

export const attachErrorReportId = (error: Error, reportId: string): Error => {
  (error as Error & { reportId?: string }).reportId = reportId;
  return error;
};

export const getErrorReportId = (error: unknown): string | null => {
  if (!error || typeof error !== "object") return null;
  const reportId = (error as { reportId?: unknown }).reportId;
  return typeof reportId === "string" ? reportId : null;
};

export const withErrorReportId = (baseMessage: string, error: unknown): string => {
  const reportId = getErrorReportId(error);
  return reportId ? `${baseMessage} (오류ID: ${reportId})` : baseMessage;
};

