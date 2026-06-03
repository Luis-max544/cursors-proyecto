import { useEffect, useRef } from 'react'
import Hls from 'hls.js'
import { api } from '../../lib/api'

interface VideoPlayerProps {
  videoId: string
  hlsUrl: string
  thumbnailUrl?: string | null
}

export function VideoPlayer({ videoId, hlsUrl, thumbnailUrl }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const viewCountedRef = useRef(false)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    let hls: Hls | null = null

    if (Hls.isSupported()) {
      hls = new Hls()
      hls.loadSource(hlsUrl)
      hls.attachMedia(video)
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS (Safari)
      video.src = hlsUrl
    }

    return () => hls?.destroy()
  }, [hlsUrl])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    function onTimeUpdate() {
      if (!viewCountedRef.current && video!.currentTime >= 10) {
        viewCountedRef.current = true
        api.post(`/videos/${videoId}/view`).catch(() => {})
      }
    }

    video.addEventListener('timeupdate', onTimeUpdate)
    return () => video.removeEventListener('timeupdate', onTimeUpdate)
  }, [videoId])

  return (
    <video
      ref={videoRef}
      controls
      className="w-full rounded-lg bg-black"
      poster={thumbnailUrl ?? undefined}
    />
  )
}
