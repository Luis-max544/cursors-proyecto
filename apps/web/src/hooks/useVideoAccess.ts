import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import type { VideoDetailDto, AccessError } from '@nutrilearn/types'
import type { AxiosError } from 'axios'

type ApiErrorResponse = { error: { code: string; message: string } }

type AccessResult =
  | { isLoading: true }
  | { isLoading: false; allowed: true; video: VideoDetailDto }
  | { isLoading: false; allowed: false; reason: AccessError | 'UNAUTHENTICATED' }

export function useVideoAccess(videoId: string): AccessResult {
  const { data, isLoading, error } = useQuery<VideoDetailDto, AxiosError<ApiErrorResponse>>({
    queryKey: ['video', videoId],
    queryFn: () =>
      api.get<{ data: VideoDetailDto }>(`/videos/${videoId}`).then((r) => r.data.data),
    retry: false,
    enabled: !!videoId,
  })

  if (isLoading) return { isLoading: true }

  if (error) {
    const code = error.response?.data?.error?.code
    if (code === 'SUBSCRIPTION_REQUIRED' || code === 'FREE_LIMIT_REACHED') {
      return { isLoading: false, allowed: false, reason: code as AccessError }
    }
    return { isLoading: false, allowed: false, reason: 'UNAUTHENTICATED' }
  }

  if (!data) return { isLoading: true }

  return { isLoading: false, allowed: true, video: data }
}
