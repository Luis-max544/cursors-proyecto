import type { VideoDto } from '@nutrilearn/types'
import { VideoCard } from './VideoCard'
import { VideoCardSkeleton } from '../ui/Skeleton'

interface VideoGridProps {
  videos?: VideoDto[]
  isLoading?: boolean
  skeletonCount?: number
}

export function VideoGrid({ videos, isLoading, skeletonCount = 8 }: VideoGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: skeletonCount }).map((_, i) => (
          <VideoCardSkeleton key={i} />
        ))}
      </div>
    )
  }

  if (!videos?.length) {
    return (
      <div className="py-16 text-center text-gray-500">
        No hay videos disponibles en esta categoría.
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {videos.map((video) => (
        <VideoCard key={video.id} video={video} />
      ))}
    </div>
  )
}
