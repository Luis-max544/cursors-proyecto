import jwt from 'jsonwebtoken'
import { env } from '@nutrilearn/config'
import type { UserRole } from '@nutrilearn/types'

interface AccessTokenPayload {
  sub: string
  role: UserRole
}

interface RefreshTokenPayload {
  sub: string
}

export function signAccessToken(userId: string, role: UserRole): string {
  return jwt.sign({ sub: userId, role }, env.JWT_ACCESS_SECRET, { expiresIn: '15m' })
}

export function signRefreshToken(userId: string): string {
  return jwt.sign({ sub: userId }, env.JWT_REFRESH_SECRET, { expiresIn: '30d' })
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshTokenPayload
}
