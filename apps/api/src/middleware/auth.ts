import { Request, Response, NextFunction } from 'express'
import { verifyAccessToken } from '../lib/jwt'

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'No token provided' } })
    return
  }

  try {
    const token = header.slice(7)
    const payload = verifyAccessToken(token)
    req.user = { id: payload.sub, role: payload.role }
    next()
  } catch {
    res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' } })
  }
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization
  if (header?.startsWith('Bearer ')) {
    try {
      const payload = verifyAccessToken(header.slice(7))
      req.user = { id: payload.sub, role: payload.role }
    } catch {
      // silently ignore invalid token for optional auth
    }
  }
  next()
}
