// ─── Enums ───────────────────────────────────────────────────────────────────

export type UserRole = 'viewer' | 'creator' | 'admin'
export type VideoStatus = 'uploading' | 'processing' | 'ready' | 'rejected' | 'deleted'
export type VideoCategory = 'programming' | 'science' | 'math' | 'languages'
export type SubscriptionStatus = 'active' | 'canceled' | 'past_due' | 'trialing'

// ─── Error codes ─────────────────────────────────────────────────────────────

export type ErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'SUBSCRIPTION_REQUIRED'
  | 'FREE_LIMIT_REACHED'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'CREATOR_NOT_APPROVED'
  | 'INTERNAL_ERROR'

export type AccessError = 'SUBSCRIPTION_REQUIRED' | 'FREE_LIMIT_REACHED'

// ─── API response shapes ──────────────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T
}

export interface ApiError {
  error: {
    code: ErrorCode
    message: string
    details?: unknown
  }
}

export interface PaginatedMeta {
  total: number
  page: number
  pages: number
}

export interface PaginatedResponse<T> {
  data: T[]
  meta: PaginatedMeta
}

// ─── User DTOs ────────────────────────────────────────────────────────────────

export interface UserDto {
  id: string
  email: string
  username: string
  role: UserRole
  avatarUrl: string | null
  bio: string | null
}

export interface SubscriptionDto {
  active: boolean
  status: SubscriptionStatus | null
  currentPeriodEnd: string | null
}

export interface UserMeDto extends UserDto {
  subscription: SubscriptionDto
  freeViewsUsed: number
  freeViewsLimit: number
}

// ─── Video DTOs ───────────────────────────────────────────────────────────────

export interface CreatorSummaryDto {
  id: string
  channelName: string
  channelSlug: string
  avatarUrl: string | null
}

export interface VideoDto {
  id: string
  title: string
  description: string | null
  category: VideoCategory
  thumbnailUrl: string | null
  durationSeconds: number | null
  viewsCount: number
  publishedAt: string | null
  isPremium: boolean
  creator: CreatorSummaryDto
}

export interface VideoDetailDto extends VideoDto {
  hlsUrl: string
  isSubscribedToCreator: boolean
}

// ─── Auth DTOs ────────────────────────────────────────────────────────────────

export interface AuthTokensDto {
  accessToken: string
  refreshToken: string
}

export interface AuthResponseDto {
  user: UserDto
  accessToken: string
  refreshToken: string
}
