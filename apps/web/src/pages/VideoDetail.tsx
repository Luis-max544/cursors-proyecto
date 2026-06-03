import { useParams } from 'react-router-dom'
import { useVideoAccess } from '../hooks/useVideoAccess'
import { Navbar } from '../components/layout/Navbar'
import { VideoPlayer } from '../components/video/VideoPlayer'
import { PaywallOverlay } from '../components/video/PaywallOverlay'
import { VideoCardSkeleton } from '../components/ui/Skeleton'

export default function VideoDetail() {
  const { videoId } = useParams<{ videoId: string }>()
  const result = useVideoAccess(videoId!)

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="mx-auto max-w-5xl px-4 py-6">
        {result.isLoading && (
          <div className="space-y-4">
            <VideoCardSkeleton />
          </div>
        )}

        {!result.isLoading && result.allowed && (
          <>
            <VideoPlayer
              videoId={videoId!}
              hlsUrl={result.video.hlsUrl}
              thumbnailUrl={result.video.thumbnailUrl}
            />
            <div className="mt-4 space-y-2">
              <h1 className="text-2xl font-bold text-gray-900">{result.video.title}</h1>
              <p className="text-sm text-gray-500">
                {result.video.creator.channelName} ·{' '}
                {result.video.viewsCount.toLocaleString()} vistas
              </p>
              {result.video.description && (
                <p className="text-gray-700">{result.video.description}</p>
              )}
            </div>
          </>
        )}

        {!result.isLoading && !result.allowed && (
          <PaywallOverlay reason={result.reason} />
        )}
      </main>
    </div>
  )
}
