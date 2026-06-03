import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Hoisted mock state ───────────────────────────────────────────────────────

const { selectQueue, mockInsert, mockUpdate } = vi.hoisted(() => {
  const selectQueue: unknown[][] = []
  const mockInsert = vi.fn()
  const mockUpdate = vi.fn()
  return { selectQueue, mockInsert, mockUpdate }
})

// ─── Module mocks ──────────────────────────────────────────────────────────────

vi.mock('@nutrilearn/config', () => ({ env: { NODE_ENV: 'test' } }))

vi.mock('@nutrilearn/db', () => {
  const makeSelectChain = (result: unknown[]): unknown => ({
    from: () => makeSelectChain(result),
    where: () => makeSelectChain(result),
    limit: () => Promise.resolve(result),
  })

  return {
    db: {
      select: () => makeSelectChain(selectQueue.shift() ?? []),
      insert: mockInsert,
      update: mockUpdate,
    },
    platformSubscriptions: {
      id: 'id', userId: 'userId', status: 'status', currentPeriodEnd: 'currentPeriodEnd',
    },
    freeViewsTracker: {
      id: 'id', userId: 'userId', ipAddress: 'ipAddress',
      month: 'month', viewsUsed: 'viewsUsed', updatedAt: 'updatedAt',
    },
    eq: vi.fn(),
    and: vi.fn(),
    gte: vi.fn(),
  }
})

// ─── Tests ────────────────────────────────────────────────────────────────────

import { checkVideoAccess, FREE_VIEWS_LIMIT } from './videoAccess'

beforeEach(() => {
  selectQueue.length = 0
  mockInsert.mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) })
  mockUpdate.mockReturnValue({
    set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
  })
})

describe('subscriber — always allowed', () => {
  // Only 1 select: subscription check returns a row → early return
  it('allows premium video for active subscriber', async () => {
    selectQueue.push([{ id: 'sub-id' }])

    expect(await checkVideoAccess({ isPremium: true, userId: 'user-1' }))
      .toEqual({ allowed: true })
  })

  it('allows free video for active subscriber', async () => {
    selectQueue.push([{ id: 'sub-id' }])

    expect(await checkVideoAccess({ isPremium: false, userId: 'user-1' }))
      .toEqual({ allowed: true })
  })
})

describe('non-subscriber — premium video', () => {
  // Only 1 select: subscription check returns empty → premium check blocks
  it('returns SUBSCRIPTION_REQUIRED', async () => {
    selectQueue.push([]) // no active sub

    expect(await checkVideoAccess({ isPremium: true, userId: 'user-1' }))
      .toEqual({ allowed: false, reason: 'SUBSCRIPTION_REQUIRED' })
  })
})

describe('non-subscriber — free video', () => {
  // 2 selects: sub check (empty) + tracker check

  it('allows access and increments existing tracker when under limit', async () => {
    selectQueue.push([])                                         // sub: none
    selectQueue.push([{ id: 'tracker-id', viewsUsed: 3 }])     // tracker: 3 used

    const result = await checkVideoAccess({ isPremium: false, userId: 'user-1' })

    expect(result).toEqual({ allowed: true })
    expect(mockUpdate).toHaveBeenCalled()
    expect(mockInsert).not.toHaveBeenCalled()
  })

  it('allows access and creates tracker when none exists', async () => {
    selectQueue.push([]) // sub: none
    selectQueue.push([]) // tracker: no row yet

    const result = await checkVideoAccess({ isPremium: false, userId: 'user-1' })

    expect(result).toEqual({ allowed: true })
    expect(mockInsert).toHaveBeenCalled()
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('blocks when free limit is reached', async () => {
    selectQueue.push([])
    selectQueue.push([{ id: 'tracker-id', viewsUsed: FREE_VIEWS_LIMIT }])

    const result = await checkVideoAccess({ isPremium: false, userId: 'user-1' })

    expect(result).toEqual({ allowed: false, reason: 'FREE_LIMIT_REACHED' })
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('enforces limit for anonymous users via IP address (1 select: tracker only)', async () => {
    // No userId → subscription block is skipped → only 1 select (tracker)
    selectQueue.push([{ id: 'tracker-id', viewsUsed: FREE_VIEWS_LIMIT }])

    const result = await checkVideoAccess({ isPremium: false, ipAddress: '1.2.3.4' })
    expect(result).toEqual({ allowed: false, reason: 'FREE_LIMIT_REACHED' })
  })
})
