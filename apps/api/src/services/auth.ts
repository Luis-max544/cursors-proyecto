import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { db, users } from '@nutrilearn/db'
import { eq } from 'drizzle-orm'
import { AppError } from '../middleware/error'
import { redis } from '../lib/redis'
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../lib/jwt'
import type { AuthResponseDto } from '@nutrilearn/types'

const SALT_ROUNDS = 12
const REFRESH_TTL_SECS = 30 * 24 * 60 * 60 // 30 days

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

async function storeRefreshToken(userId: string, token: string): Promise<void> {
  await redis.setex(`refresh:${hashToken(token)}`, REFRESH_TTL_SECS, userId)
}

async function revokeRefreshToken(token: string): Promise<void> {
  await redis.del(`refresh:${hashToken(token)}`)
}

export async function register(dto: {
  email: string
  username: string
  password: string
}): Promise<AuthResponseDto> {
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, dto.email))
    .limit(1)

  if (existing.length > 0) {
    throw new AppError(409, 'CONFLICT', 'Email already in use')
  }

  const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS)

  const [user] = await db
    .insert(users)
    .values({ email: dto.email, username: dto.username, passwordHash })
    .returning({
      id: users.id,
      email: users.email,
      username: users.username,
      role: users.role,
      avatarUrl: users.avatarUrl,
      bio: users.bio,
    })

  const accessToken = signAccessToken(user.id, user.role)
  const refreshToken = signRefreshToken(user.id)
  await storeRefreshToken(user.id, refreshToken)

  return {
    user: { id: user.id, email: user.email, username: user.username, role: user.role, avatarUrl: user.avatarUrl, bio: user.bio },
    accessToken,
    refreshToken,
  }
}

export async function login(dto: {
  email: string
  password: string
}): Promise<AuthResponseDto> {
  const [user] = await db.select().from(users).where(eq(users.email, dto.email)).limit(1)

  // Use constant-time comparison to avoid timing attacks: compare even if user not found
  const dummyHash = '$2b$12$invalidhashfortimingprotection000000000000000000000000'
  const valid = user
    ? await bcrypt.compare(dto.password, user.passwordHash)
    : await bcrypt.compare(dto.password, dummyHash).then(() => false)

  if (!user || !valid) {
    throw new AppError(401, 'UNAUTHORIZED', 'Invalid credentials')
  }

  const accessToken = signAccessToken(user.id, user.role)
  const refreshToken = signRefreshToken(user.id)
  await storeRefreshToken(user.id, refreshToken)

  return {
    user: { id: user.id, email: user.email, username: user.username, role: user.role, avatarUrl: user.avatarUrl, bio: user.bio },
    accessToken,
    refreshToken,
  }
}

export async function refresh(token: string): Promise<{ accessToken: string; refreshToken: string }> {
  let payload: { sub: string }
  try {
    payload = verifyRefreshToken(token)
  } catch {
    throw new AppError(401, 'UNAUTHORIZED', 'Invalid refresh token')
  }

  const stored = await redis.get(`refresh:${hashToken(token)}`)
  if (!stored || stored !== payload.sub) {
    throw new AppError(401, 'UNAUTHORIZED', 'Refresh token revoked or not found')
  }

  const [user] = await db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(eq(users.id, payload.sub))
    .limit(1)

  if (!user) {
    throw new AppError(401, 'UNAUTHORIZED', 'User not found')
  }

  await revokeRefreshToken(token)
  const accessToken = signAccessToken(user.id, user.role)
  const newRefreshToken = signRefreshToken(user.id)
  await storeRefreshToken(user.id, newRefreshToken)

  return { accessToken, refreshToken: newRefreshToken }
}

export async function logout(token: string): Promise<void> {
  try {
    verifyRefreshToken(token)
    await revokeRefreshToken(token)
  } catch {
    // Token already invalid — nothing to revoke
  }
}
