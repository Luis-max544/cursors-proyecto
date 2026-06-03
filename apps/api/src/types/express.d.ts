import type { UserRole } from '@nutrilearn/types'

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string
        role: UserRole
      }
    }
  }
}

export {}
