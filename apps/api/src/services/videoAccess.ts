import {
  db, platformSubscriptions, freeViewsTracker,
} from '@nutrilearn/db'
import { and, eq, gte } from 'drizzle-orm'
import type { AccessError } from '@nutrilearn/types'

export const FREE_VIEWS_LIMIT = 5

export async function checkVideoAccess(params: {
  isPremium: boolean
  userId?: string
  ipAddress?: string
}): Promise<{ allowed: boolean; reason?: AccessError }> {
  const { isPremium, userId, ipAddress } = params

  if (userId) {
    const [sub] = await db
      .select({ id: platformSubscriptions.id })
      .from(platformSubscriptions)
      .where(
        and(
          eq(platformSubscriptions.userId, userId),
          eq(platformSubscriptions.status, 'active'),
          gte(platformSubscriptions.currentPeriodEnd, new Date()),
        ),
      )
      .limit(1)

    if (sub) return { allowed: true }
  }

  if (isPremium) {
    return { allowed: false, reason: 'SUBSCRIPTION_REQUIRED' }
  }

  const month = new Date().toISOString().slice(0, 7)
  const conditions = userId
    ? and(eq(freeViewsTracker.userId, userId), eq(freeViewsTracker.month, month))
    : ipAddress
      ? and(eq(freeViewsTracker.ipAddress, ipAddress), eq(freeViewsTracker.month, month))
      : undefined

  const [tracker] = conditions
    ? await db
        .select({ id: freeViewsTracker.id, viewsUsed: freeViewsTracker.viewsUsed })
        .from(freeViewsTracker)
        .where(conditions)
        .limit(1)
    : []

  const viewsUsed = tracker?.viewsUsed ?? 0

  if (viewsUsed >= FREE_VIEWS_LIMIT) {
    return { allowed: false, reason: 'FREE_LIMIT_REACHED' }
  }

  if (tracker) {
    await db
      .update(freeViewsTracker)
      .set({ viewsUsed: viewsUsed + 1, updatedAt: new Date() })
      .where(eq(freeViewsTracker.id, tracker.id))
  } else {
    await db.insert(freeViewsTracker).values({
      userId: userId ?? null,
      ipAddress: ipAddress ?? null,
      month,
      viewsUsed: 1,
    })
  }

  return { allowed: true }
}
