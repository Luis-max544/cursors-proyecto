import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Hoisted mock state ───────────────────────────────────────────────────────
// vi.mock factories are hoisted — use vi.hoisted for shared mutable state

const { dbQueue, mockRedis } = vi.hoisted(() => {
  const dbQueue: unknown[][] = []
  const mockRedis = {
    setex: vi.fn().mockResolvedValue('OK'),
    get: vi.fn().mockResolvedValue(null),
    del: vi.fn().mockResolvedValue(1),
  }
  return { dbQueue, mockRedis }
})

// ─── Module mocks ──────────────────────────────────────────────────────────────

vi.mock('@nutrilearn/config', () => ({
  env: {
    JWT_ACCESS_SECRET: 'test-access-secret-that-is-at-least-32-chars',
    JWT_REFRESH_SECRET: 'test-refresh-secret-that-is-at-least-32-chars',
    NODE_ENV: 'test',
  },
}))

vi.mock('@nutrilearn/db', () => {
  const makeChain = (): unknown => ({
    from: () => makeChain(),
    where: () => makeChain(),
    limit: () => Promise.resolve(dbQueue.shift() ?? []),
    set: () => makeChain(),
    values: () => ({
      returning: () => Promise.resolve(dbQueue.shift() ?? []),
      onConflictDoNothing: () => Promise.resolve(),
    }),
  })
  return {
    db: {
      select: () => makeChain(),
      insert: () => makeChain(),
      update: () => makeChain(),
    },
    users: {},
    eq: vi.fn(),
  }
})

vi.mock('../lib/redis', () => ({ redis: mockRedis }))

vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('$2b$12$hashedpassword'),
    compare: vi.fn().mockResolvedValue(true),
  },
}))

vi.mock('../lib/jwt', () => ({
  signAccessToken: vi.fn().mockReturnValue('mock-access-token'),
  signRefreshToken: vi.fn().mockReturnValue('mock-refresh-token'),
  verifyRefreshToken: vi.fn().mockReturnValue({ sub: 'user-uuid' }),
}))

// ─── Tests ────────────────────────────────────────────────────────────────────

import * as AuthService from './auth'
import bcrypt from 'bcryptjs'

const mockBcrypt = vi.mocked(bcrypt)

beforeEach(() => {
  dbQueue.length = 0
  mockRedis.setex.mockClear()
  mockRedis.get.mockClear()
  mockRedis.del.mockClear()
})

const makeUser = () => ({
  id: 'user-uuid',
  email: 'test@example.com',
  username: 'testuser',
  role: 'viewer' as const,
  avatarUrl: null,
  bio: null,
})

describe('register', () => {
  it('creates user and returns tokens when email is not taken', async () => {
    dbQueue.push([])              // select: no existing user
    dbQueue.push([makeUser()])    // insert.returning: new user

    const result = await AuthService.register({
      email: 'test@example.com',
      username: 'testuser',
      password: 'password123',
    })

    expect(result.accessToken).toBe('mock-access-token')
    expect(result.refreshToken).toBe('mock-refresh-token')
    expect(result.user.email).toBe('test@example.com')
    expect(mockBcrypt.hash).toHaveBeenCalledWith('password123', 12)
    expect(mockRedis.setex).toHaveBeenCalled()
  })

  it('throws CONFLICT when email already exists', async () => {
    dbQueue.push([{ id: 'existing' }]) // select: email taken

    await expect(
      AuthService.register({ email: 'taken@example.com', username: 'user', password: 'pass1234' }),
    ).rejects.toMatchObject({ code: 'CONFLICT', statusCode: 409 })
  })
})

describe('login', () => {
  it('returns tokens for valid credentials', async () => {
    dbQueue.push([{ ...makeUser(), passwordHash: '$2b$12$hash' }])
    mockBcrypt.compare.mockResolvedValueOnce(true as never)

    const result = await AuthService.login({ email: 'test@example.com', password: 'password123' })

    expect(result.accessToken).toBe('mock-access-token')
    expect(result.refreshToken).toBe('mock-refresh-token')
  })

  it('throws UNAUTHORIZED for wrong password', async () => {
    dbQueue.push([{ ...makeUser(), passwordHash: '$2b$12$hash' }])
    mockBcrypt.compare.mockResolvedValueOnce(false as never)

    await expect(
      AuthService.login({ email: 'test@example.com', password: 'wrong' }),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED', statusCode: 401 })
  })

  it('throws UNAUTHORIZED for unknown email', async () => {
    dbQueue.push([]) // no user found
    mockBcrypt.compare.mockResolvedValueOnce(false as never)

    await expect(
      AuthService.login({ email: 'nobody@example.com', password: 'pass' }),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED', statusCode: 401 })
  })
})

describe('refresh', () => {
  it('rotates token and returns new access + refresh tokens', async () => {
    mockRedis.get.mockResolvedValueOnce('user-uuid')
    dbQueue.push([{ id: 'user-uuid', role: 'viewer' as const }])

    const result = await AuthService.refresh('valid-refresh-token')

    expect(result.accessToken).toBe('mock-access-token')
    expect(result.refreshToken).toBe('mock-refresh-token')
    expect(mockRedis.del).toHaveBeenCalled()
    expect(mockRedis.setex).toHaveBeenCalled()
  })

  it('throws UNAUTHORIZED when token not in Redis', async () => {
    mockRedis.get.mockResolvedValueOnce(null)

    await expect(AuthService.refresh('revoked-token')).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    })
  })
})

describe('logout', () => {
  it('removes refresh token from Redis', async () => {
    await AuthService.logout('valid-refresh-token')
    expect(mockRedis.del).toHaveBeenCalled()
  })

  it('does not throw for already-invalid tokens', async () => {
    const { verifyRefreshToken } = await import('../lib/jwt')
    vi.mocked(verifyRefreshToken).mockImplementationOnce(() => {
      throw new Error('invalid token')
    })

    await expect(AuthService.logout('bad-token')).resolves.toBeUndefined()
  })
})
