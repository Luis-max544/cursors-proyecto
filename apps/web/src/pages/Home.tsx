import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import type { VideoDto, PaginatedResponse } from '@nutrilearn/types'
import { Navbar } from '../components/layout/Navbar'
import { VideoGrid } from '../components/video/VideoGrid'

export default function Home() {
  const { data, isLoading } = useQuery<PaginatedResponse<VideoDto>>({
    queryKey: ['videos', 'home'],
    queryFn: () =>
      api.get<PaginatedResponse<VideoDto>>('/videos', { params: { sort: 'popular', limit: 20 } })
        .then((r) => r.data),
  })

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-8">
        <h2 className="mb-6 text-2xl font-bold text-gray-900">Videos populares</h2>
        <VideoGrid videos={data?.data} isLoading={isLoading} />
      </main>
    </div>
  )
}
