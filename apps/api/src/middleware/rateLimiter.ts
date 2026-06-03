import { Request, Response, NextFunction } from 'express'
import { redis } from '../lib/redis'

interface RateLimiterOptions {
  max: number
  windowSecs: number
  keyPrefix?: string
}

export function rateLimiter(options: RateLimiterOptions) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown'
    const prefix = options.keyPrefix ?? req.path
    const key = `ratelimit:${prefix}:${ip}`

    try {
      const current = await redis.incr(key)
      if (current === 1) {
        await redis.expire(key, options.windowSecs)
      }

      if (current > options.max) {
        res.status(429).json({
          error: { code: 'RATE_LIMITED', message: 'Too many requests, please try again later' },
        })
        return
      }
    } catch {
      // If Redis is unavailable, allow the request through
    }

    next()
  }
}
