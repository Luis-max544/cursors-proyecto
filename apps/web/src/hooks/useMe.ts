import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import type { UserMeDto } from '@nutrilearn/types'
import { useAuthStore } from '../stores/authStore'

export function useMe() {
  const user = useAuthStore((s) => s.user)

  return useQuery<UserMeDto>({
    queryKey: ['me'],
    queryFn: () => api.get<{ data: UserMeDto }>('/users/me').then((r) => r.data.data),
    enabled: !!user,
  })
}
