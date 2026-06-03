import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import type { VideoDto, VideoCategory, PaginatedResponse } from '@nutrilearn/types'
import { Navbar } from '../components/layout/Navbar'
import { VideoGrid } from '../components/video/VideoGrid'

const CATEGORIES: { label: string; value: VideoCategory }[] = [
  { label: 'Todos', value: 'programming' }, // placeholder, treated as "all" below
  { label: 'Programación', value: 'programming' },
  { label: 'Ciencia', value: 'science' },
  { label: 'Matemáticas', value: 'math' },
  { label: 'Idiomas', value: 'languages' },
]

const ALL_CATEGORIES = ['programming', 'science', 'math', 'languages'] as VideoCategory[]

export default function Discover() {
  const [searchParams, setSearchParams] = useSearchParams()
  const categoryParam = searchParams.get('category') as VideoCategory | null

  const { data, isLoading } = useQuery<PaginatedResponse<VideoDto>>({
    queryKey: ['videos', 'discover', categoryParam],
    queryFn: () =>
      api
        .get<PaginatedResponse<VideoDto>>('/videos', {
          params: { category: categoryParam ?? undefined, sort: 'recent', limit: 24 },
        })
        .then((r) => r.data),
  })

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-8">
        <h2 className="mb-6 text-2xl font-bold text-gray-900">Explorar</h2>

        <div className="mb-6 flex gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setSearchParams({})}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${!categoryParam ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}`}
          >
            Todos
          </button>
          {ALL_CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSearchParams({ category: cat })}
              className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${categoryParam === cat ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}`}
            >
              {CATEGORIES.find((c) => c.value === cat)?.label ?? cat}
            </button>
          ))}
        </div>

        <VideoGrid videos={data?.data} isLoading={isLoading} />
      </main>
    </div>
  )
}
