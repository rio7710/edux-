import "./env.js";
import jwt from "jsonwebtoken";
import type {
  JwtPayload as JsonWebTokenPayload,
  SignOptions,
} from "jsonwebtoken";

function readJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET environment variable is required.");
  }
  return secret;
}

const JWT_SECRET: string = readJwtSecret();

const ACCESS_TOKEN_EXPIRES: SignOptions["expiresIn"] = "1h";
const REFRESH_TOKEN_EXPIRES: SignOptions["expiresIn"] = "7d";

export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
}

type JwtTokenPayload = JwtPayload & {
  tokenType?: "access" | "refresh";
};

export function signAccessToken(payload: JwtPayload): string {
  return jwt.sign({ ...payload, tokenType: "access" }, JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRES,
  });
}

export function signAccessTokenWithExpiry(
  payload: JwtPayload,
  expiresIn: SignOptions["expiresIn"],
): string {
  return jwt.sign({ ...payload, tokenType: "access" }, JWT_SECRET, {
    expiresIn,
  });
}

export function signRefreshToken(payload: JwtPayload): string {
  return jwt.sign({ ...payload, tokenType: "refresh" }, JWT_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRES,
  });
}

export function verifyToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, JWT_SECRET) as
    | JsonWebTokenPayload
    | string;
  if (typeof decoded === "string") {
    throw new Error("Invalid access token payload");
  }
  const payload = decoded as JwtTokenPayload;
  if (payload.tokenType && payload.tokenType !== "access") {
    throw new Error("Invalid access token type");
  }
  return {
    userId: payload.userId,
    email: payload.email,
    role: payload.role,
  };
}

export function verifyRefreshToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, JWT_SECRET) as
    | JsonWebTokenPayload
    | string;
  if (typeof decoded === "string") {
    throw new Error("Invalid refresh token payload");
  }
  const payload = decoded as JwtTokenPayload;
  if (payload.tokenType !== "refresh") {
    throw new Error("Invalid refresh token type");
  }
  return {
    userId: payload.userId,
    email: payload.email,
    role: payload.role,
  };
}

export function decodeToken(token: string): JwtPayload | null {
  try {
    const payload = jwt.decode(token) as JwtTokenPayload | null;
    if (!payload) return null;
    return {
      userId: payload.userId,
      email: payload.email,
      role: payload.role,
    };
  } catch {
    return null;
  }
}

export function decodeTokenWithExp(
  token: string,
): (JwtPayload & { exp?: number }) | null {
  try {
    const payload = jwt.decode(token) as (JwtTokenPayload & {
      exp?: number;
    }) | null;
    if (!payload) return null;
    return {
      userId: payload.userId,
      email: payload.email,
      role: payload.role,
      exp: payload.exp,
    };
  } catch {
    return null;
  }
}
