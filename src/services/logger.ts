import winston from "winston";
import DailyRotateFile from "winston-daily-rotate-file";

const REDACT_KEYS = new Set([
  "password",
  "newPassword",
  "currentPassword",
  "token",
  "accessToken",
  "refreshToken",
  "authorization",
]);

function redactValue(value: unknown, depth = 0): unknown {
  if (depth > 4) return "[truncated]";
  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item, depth + 1));
  }
  if (value && typeof value === "object") {
    const input = value as Record<string, unknown>;
    const next: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(input)) {
      if (REDACT_KEYS.has(key)) {
        next[key] = "[REDACTED]";
      } else {
        next[key] = redactValue(nested, depth + 1);
      }
    }
    return next;
  }
  return value;
}

const redactFormat = winston.format(
  (info) => redactValue(info) as winston.Logform.TransformableInfo,
);
const enableFileLogging = process.env.LOG_TO_FILE !== "false";

const consoleTransport = new winston.transports.Console();
const transports: winston.transport[] = [consoleTransport];
const exceptionHandlers: winston.transport[] = [new winston.transports.Console()];
const rejectionHandlers: winston.transport[] = [new winston.transports.Console()];

if (enableFileLogging) {
  const baseRotateOptions = {
    dirname: "logs",
    datePattern: "YYYY-MM-DD",
    zippedArchive: true,
    maxSize: "20m",
    maxFiles: "14d",
  } as const;
  transports.push(
    new DailyRotateFile({
      ...baseRotateOptions,
      filename: "backend-%DATE%.log",
      level: process.env.LOG_FILE_LEVEL || "info",
    }),
  );
  exceptionHandlers.push(
    new DailyRotateFile({
      ...baseRotateOptions,
      filename: "backend-exception-%DATE%.log",
    }),
  );
  rejectionHandlers.push(
    new DailyRotateFile({
      ...baseRotateOptions,
      filename: "backend-rejection-%DATE%.log",
    }),
  );
}

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === "production" ? "info" : "debug"),
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    redactFormat(),
    winston.format.json(),
  ),
  defaultMeta: { service: "edux-backend" },
  transports,
  exceptionHandlers,
  rejectionHandlers,
  exitOnError: false,
});
