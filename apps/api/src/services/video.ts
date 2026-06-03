import {
  db, videos, users, creatorProfiles,
  channelSubscriptions, videoViews,
} from '@nutrilearn/db'
import { and, desc, eq, sql } from 'drizzle-orm'
import type { VideoCategory, VideoDetailDto, VideoDto } from '@nutrilearn/types'
import { AppError } from '../middleware/error'
import { redis } from '../lib/redis'
import { generatePresignedGetUrl } from '../lib/s3'
import { checkVideoAccess } from './videoAccess'

const HLS_TTL_SECS = 4 * 60 * 60 // 4 hours

// ─── List videos ──────────────────────────────────────────────────────────────

export async function listVideos(params: {
  category?: VideoCategory
  sort?: 'recent' | 'popular'
  page?: number
  limit?: number
}): Promise<{ data: VideoDto[]; meta: { total: number; page: number; pages: number } }> {
  const { category, sort = 'recent', page = 1, limit = 20 } = params
  const offset = (page - 1) * limit

  const baseConditions = [eq(videos.status, 'ready')]
  if (category) baseConditions.push(eq(videos.category, category))
  const where = and(...baseConditions)

  const orderBy = sort === 'popular' ? desc(videos.viewsCount) : desc(videos.publishedAt)

  const [rows, [countRow]] = await Promise.all([
    db
      .select({
        id: videos.id,
        title: videos.title,
        description: videos.description,
        category: videos.category,
        thumbnailUrl: videos.thumbnailUrl,
        durationSeconds: videos.durationSeconds,
        viewsCount: videos.viewsCount,
        publishedAt: videos.publishedAt,
        isPremium: videos.isPremium,
        creatorId: videos.creatorId,
        channelName: creatorProfiles.channelName,
        channelSlug: creatorProfiles.channelSlug,
        avatarUrl: users.avatarUrl,
      })
      .from(videos)
      .innerJoin(creatorProfiles, eq(videos.creatorId, creatorProfiles.userId))
      .innerJoin(users, eq(videos.creatorId, users.id))
      .where(where)
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(videos)
      .where(where),
  ])

  const total = countRow?.count ?? 0

  return {
    data: rows.map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      category: r.category,
      thumbnailUrl: r.thumbnailUrl,
      durationSeconds: r.durationSeconds,
      viewsCount: r.viewsCount,
      publishedAt: r.publishedAt?.toISOString() ?? null,
      isPremium: r.isPremium,
      creator: { id: r.creatorId, channelName: r.channelName, channelSlug: r.channelSlug, avatarUrl: r.avatarUrl },
    })),
    meta: { total, page, pages: Math.ceil(total / limit) },
  }
}

// ─── Get video detail (with paywall) ─────────────────────────────────────────

export async function getVideo(
  videoId: string,
  userId?: string,
  ipAddress?: string,
): Promise<VideoDetailDto> {
  const [row] = await db
    .select({
      id: videos.id,
      title: videos.title,
      description: videos.description,
      category: videos.category,
      thumbnailUrl: videos.thumbnailUrl,
      hlsKey: videos.hlsKey,
      durationSeconds: videos.durationSeconds,
      viewsCount: videos.viewsCount,
      publishedAt: videos.publishedAt,
      isPremium: videos.isPremium,
      status: videos.status,
      creatorId: videos.creatorId,
      channelName: creatorProfiles.channelName,
      channelSlug: creatorProfiles.channelSlug,
      avatarUrl: users.avatarUrl,
    })
    .from(videos)
    .innerJoin(creatorProfiles, eq(videos.creatorId, creatorProfiles.userId))
    .innerJoin(users, eq(videos.creatorId, users.id))
    .where(eq(videos.id, videoId))
    .limit(1)

  if (!row || row.status !== 'ready') {
    throw new AppError(404, 'NOT_FOUND', 'Video not found')
  }

  const access = await checkVideoAccess({ isPremium: row.isPremium, userId, ipAddress })

  if (!access.allowed) {
    throw new AppError(
      403,
      access.reason!,
      access.reason === 'SUBSCRIPTION_REQUIRED'
        ? 'This video requires an active subscription'
        : 'You have used all 5 free videos this month',
    )
  }

  const hlsUrl = row.hlsKey ? await generatePresignedGetUrl(row.hlsKey, HLS_TTL_SECS) : ''

  let isSubscribedToCreator = false
  if (userId) {
    const [sub] = await db
      .select({ id: channelSubscriptions.id })
      .from(channelSubscriptions)
      .where(
        and(
          eq(channelSubscriptions.viewerId, userId),
          eq(channelSubscriptions.creatorId, row.creatorId),
        ),
      )
      .limit(1)
    isSubscribedToCreator = !!sub
  }

  return {
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category,
    thumbnailUrl: row.thumbnailUrl,
    durationSeconds: row.durationSeconds,
    viewsCount: row.viewsCount,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    isPremium: row.isPremium,
    creator: { id: row.creatorId, channelName: row.channelName, channelSlug: row.channelSlug, avatarUrl: row.avatarUrl },
    hlsUrl,
    isSubscribedToCreator,
  }
}

// ─── Record view ──────────────────────────────────────────────────────────────

export async function recordView(
  videoId: string,
  userId?: string,
  ipAddress?: string,
): Promise<boolean> {
  const dedupKey = userId
    ? `view:${videoId}:user:${userId}`
    : `view:${videoId}:ip:${ipAddress}`

  const exists = await redis.get(dedupKey)
  if (exists) return false

  const [video] = await db
    .select({ creatorId: videos.creatorId })
    .from(videos)
    .where(eq(videos.id, videoId))
    .limit(1)

  if (!video) return false

  await Promise.all([
    db.insert(videoViews).values({ videoId, userId: userId ?? null, ipAddress: ipAddress ?? null }),
    db.update(videos)
      .set({ viewsCount: sql`${videos.viewsCount} + 1` })
      .where(eq(videos.id, videoId)),
    db.update(creatorProfiles)
      .set({ monthlyViews: sql`${creatorProfiles.monthlyViews} + 1` })
      .where(eq(creatorProfiles.userId, video.creatorId)),
    redis.setex(dedupKey, 30 * 60, '1'),
  ])

  return true
}
