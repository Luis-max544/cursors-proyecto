import { Link } from 'react-router-dom'
import type { VideoDto } from '@nutrilearn/types'
import { Badge } from '../ui/Badge'

function formatDuration(seconds: number | null): string {
  if (!seconds) return ''
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

function formatViews(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`
  return String(count)
}

export function VideoCard({ video }: { video: VideoDto }) {
  return (
    <Link to={`/watch/${video.id}`} className="group flex flex-col gap-2">
      <div className="relative aspect-video overflow-hidden rounded-lg bg-gray-100">
        {video.thumbnailUrl ? (
          <img
            src={video.thumbnailUrl}
            alt={video.title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-gray-400 text-4xl">▶</div>
        )}

        {video.durationSeconds && (
          <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1 py-0.5 text-xs text-white">
            {formatDuration(video.durationSeconds)}
          </span>
        )}

        {video.isPremium && (
          <span className="absolute top-1 left-1">
            <Badge variant="premium">PREMIUM</Badge>
          </span>
        )}
      </div>

      <div className="flex gap-2">
        <div className="flex-1 min-w-0">
          <p className="line-clamp-2 text-sm font-medium text-gray-900 group-hover:text-blue-600">
            {video.title}
          </p>
          <p className="mt-0.5 text-xs text-gray-500">{video.creator.channelName}</p>
          <p className="text-xs text-gray-400">{formatViews(video.viewsCount)} vistas</p>
        </div>
      </div>
    </Link>
  )
}
