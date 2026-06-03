import { db, users, platformSubscriptions, freeViewsTracker } from '@nutrilearn/db'
import { and, eq, gte } from 'drizzle-orm'
import type { UserMeDto } from '@nutrilearn/types'
import { AppError } from '../middleware/error'

export async function getMe(userId: string): Promise<UserMeDto> {
  const month = new Date().toISOString().slice(0, 7)

  const [[user], [sub], [tracker]] = await Promise.all([
    db.select().from(users).where(eq(users.id, userId)).limit(1),
    db
      .select()
      .from(platformSubscriptions)
      .where(
        and(
          eq(platformSubscriptions.userId, userId),
          eq(platformSubscriptions.status, 'active'),
          gte(platformSubscriptions.currentPeriodEnd, new Date()),
        ),
      )
      .limit(1),
    db
      .select({ viewsUsed: freeViewsTracker.viewsUsed })
      .from(freeViewsTracker)
      .where(and(eq(freeViewsTracker.userId, userId), eq(freeViewsTracker.month, month)))
      .limit(1),
  ])

  if (!user) throw new AppError(404, 'NOT_FOUND', 'User not found')

  return {
    id: user.id,
    email: user.email,
    username: user.username,
    role: user.role,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    subscription: {
      active: !!sub,
      status: sub?.status ?? null,
      currentPeriodEnd: sub?.currentPeriodEnd?.toISOString() ?? null,
    },
    freeViewsUsed: tracker?.viewsUsed ?? 0,
    freeViewsLimit: 5,
  }
}
