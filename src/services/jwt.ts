import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'edux-dev-secret-change-in-production';
const ACCESS_TOKEN_EXPIRES = '1h';
const REFRESH_TOKEN_EXPIRES = '7d';

export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
}

export function signAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRES });
}

export function signAccessTokenWithExpiry(
  payload: JwtPayload,
  expiresIn: string,
): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

export function signRefreshToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRES });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}

export function decodeToken(token: string): JwtPayload | null {
  try {
    return jwt.decode(token) as JwtPayload | null;
  } catch {
    return null;
  }
}

export function decodeTokenWithExp(
  token: string,
): (JwtPayload & { exp?: number }) | null {
  try {
    return jwt.decode(token) as (JwtPayload & { exp?: number }) | null;
  } catch {
    return null;
  }
}
