import {
  pgTable, pgEnum, uuid, text, varchar, boolean,
  timestamp, integer, decimal, unique, index,
} from 'drizzle-orm/pg-core'

// ─── Enums ───────────────────────────────────────────────────────────────────

export const roleEnum = pgEnum('role', ['viewer', 'creator', 'admin'])

export const videoStatusEnum = pgEnum('video_status', [
  'uploading',
  'processing',
  'ready',
  'rejected',
  'deleted',
])

export const subscriptionStatusEnum = pgEnum('subscription_status', [
  'active',
  'canceled',
  'past_due',
  'trialing',
])

export const categoryEnum = pgEnum('category', [
  'programming',
  'science',
  'math',
  'languages',
])

// ─── Users ───────────────────────────────────────────────────────────────────

export const users = pgTable('users', {
  id:               uuid('id').primaryKey().defaultRandom(),
  email:            varchar('email', { length: 255 }).notNull().unique(),
  username:         varchar('username', { length: 60 }).notNull().unique(),
  passwordHash:     text('password_hash').notNull(),
  role:             roleEnum('role').notNull().default('viewer'),
  avatarUrl:        text('avatar_url'),
  bio:              text('bio'),
  stripeCustomerId: varchar('stripe_customer_id', { length: 255 }),
  createdAt:        timestamp('created_at').notNull().defaultNow(),
  updatedAt:        timestamp('updated_at').notNull().defaultNow(),
})

// ─── Creator profiles ─────────────────────────────────────────────────────────

export const creatorProfiles = pgTable('creator_profiles', {
  userId:        uuid('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  channelName:   varchar('channel_name', { length: 120 }).notNull(),
  channelSlug:   varchar('channel_slug', { length: 80 }).notNull().unique(),
  bannerUrl:     text('banner_url'),
  approved:      boolean('approved').notNull().default(false),
  approvedAt:    timestamp('approved_at'),
  payoutEmail:   varchar('payout_email', { length: 255 }),
  monthlyViews:  integer('monthly_views').notNull().default(0),
})

// ─── Platform subscriptions (Stripe) ─────────────────────────────────────────

export const platformSubscriptions = pgTable('platform_subscriptions', {
  id:                   uuid('id').primaryKey().defaultRandom(),
  userId:               uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  stripeSubscriptionId: varchar('stripe_subscription_id', { length: 255 }).notNull().unique(),
  stripePriceId:        varchar('stripe_price_id', { length: 255 }).notNull(),
  status:               subscriptionStatusEnum('status').notNull(),
  currentPeriodEnd:     timestamp('current_period_end').notNull(),
  cancelAtPeriodEnd:    boolean('cancel_at_period_end').notNull().default(false),
  createdAt:            timestamp('created_at').notNull().defaultNow(),
  updatedAt:            timestamp('updated_at').notNull().defaultNow(),
})

// ─── Channel subscriptions (viewer → creator) ─────────────────────────────────

export const channelSubscriptions = pgTable('channel_subscriptions', {
  id:        uuid('id').primaryKey().defaultRandom(),
  viewerId:  uuid('viewer_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  creatorId: uuid('creator_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => ({
  uniq: unique().on(t.viewerId, t.creatorId),
}))

// ─── Videos ───────────────────────────────────────────────────────────────────

export const videos = pgTable('videos', {
  id:              uuid('id').primaryKey().defaultRandom(),
  creatorId:       uuid('creator_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title:           varchar('title', { length: 200 }).notNull(),
  description:     text('description'),
  category:        categoryEnum('category').notNull(),
  thumbnailUrl:    text('thumbnail_url'),
  hlsKey:          text('hls_key'),
  rawKey:          text('raw_key'),
  durationSeconds: integer('duration_seconds'),
  status:          videoStatusEnum('status').notNull().default('uploading'),
  isPremium:       boolean('is_premium').notNull().default(false),
  viewsCount:      integer('views_count').notNull().default(0),
  publishedAt:     timestamp('published_at'),
  createdAt:       timestamp('created_at').notNull().defaultNow(),
  updatedAt:       timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  creatorIdx:  index('videos_creator_idx').on(t.creatorId),
  categoryIdx: index('videos_category_idx').on(t.category),
  statusIdx:   index('videos_status_idx').on(t.status),
}))

// ─── Video views ─────────────────────────────────────────────────────────────

export const videoViews = pgTable('video_views', {
  id:        uuid('id').primaryKey().defaultRandom(),
  videoId:   uuid('video_id').notNull().references(() => videos.id, { onDelete: 'cascade' }),
  userId:    uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  ipAddress: varchar('ip_address', { length: 45 }),
  viewedAt:  timestamp('viewed_at').notNull().defaultNow(),
}, (t) => ({
  videoIdx: index('views_video_idx').on(t.videoId),
  userIdx:  index('views_user_idx').on(t.userId),
}))

// ─── Free views tracker ───────────────────────────────────────────────────────

export const freeViewsTracker = pgTable('free_views_tracker', {
  id:        uuid('id').primaryKey().defaultRandom(),
  userId:    uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  ipAddress: varchar('ip_address', { length: 45 }),
  month:     varchar('month', { length: 7 }).notNull(), // "2025-06"
  viewsUsed: integer('views_used').notNull().default(0),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  userMonthIdx: index('free_views_user_month_idx').on(t.userId, t.month),
}))

// ─── Monthly payouts ──────────────────────────────────────────────────────────

export const monthlyPayouts = pgTable('monthly_payouts', {
  id:          uuid('id').primaryKey().defaultRandom(),
  creatorId:   uuid('creator_id').notNull().references(() => users.id),
  month:       varchar('month', { length: 7 }).notNull(), // "2025-06"
  viewsCount:  integer('views_count').notNull(),
  viewsTotal:  integer('views_total').notNull(),
  revenuePool: decimal('revenue_pool', { precision: 10, scale: 2 }).notNull(),
  amountUsd:   decimal('amount_usd', { precision: 10, scale: 2 }).notNull(),
  paidAt:      timestamp('paid_at'),
  createdAt:   timestamp('created_at').notNull().defaultNow(),
}, (t) => ({
  creatorMonthUniq: unique().on(t.creatorId, t.month),
}))

// ─── Upload sessions ──────────────────────────────────────────────────────────

export const uploadSessions = pgTable('upload_sessions', {
  id:        uuid('id').primaryKey().defaultRandom(),
  creatorId: uuid('creator_id').notNull().references(() => users.id),
  videoId:   uuid('video_id').notNull().references(() => videos.id, { onDelete: 'cascade' }),
  s3Key:     text('s3_key').notNull(),
  uploadId:  text('upload_id'),
  expiresAt: timestamp('expires_at').notNull(),
  completed: boolean('completed').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})
