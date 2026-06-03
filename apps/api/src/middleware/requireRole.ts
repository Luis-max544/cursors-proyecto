import { Request, Response, NextFunction } from 'express'
import type { UserRole } from '@nutrilearn/types'

const ROLE_HIERARCHY: Record<UserRole, number> = {
  viewer: 0,
  creator: 1,
  admin: 2,
}

export function requireRole(minRole: UserRole) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } })
      return
    }

    if (ROLE_HIERARCHY[req.user.role] < ROLE_HIERARCHY[minRole]) {
      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } })
      return
    }

    next()
  }
}
