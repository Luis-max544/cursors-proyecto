import { Request, Response, NextFunction } from 'express'
import { ZodError } from 'zod'
import { env } from '@nutrilearn/config'

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: { code: err.code, message: err.message },
    })
    return
  }

  if (err instanceof ZodError) {
    res.status(422).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: err.flatten().fieldErrors,
      },
    })
    return
  }

  console.error(err)
  const message = env.NODE_ENV === 'production' ? 'Internal server error' : String(err)
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message } })
}
