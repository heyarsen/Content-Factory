import { Request, Response, NextFunction } from 'express'

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Log full error details
  console.error('Error Handler caught error:', {
    message: err.message,
    stack: err.stack,
    name: err.name,
    path: req.path,
    method: req.method,
  })

  // If headers already sent, delegate to Express default handler
  if (res.headersSent) {
    return next(err)
  }

  // If error already has a status code (from express-validator or other middleware)
  const status = (err as any).status || (err as any).statusCode || 500
  
  // Return error message if available, otherwise generic message
  const errorMessage = err.message || 'Internal server error'

  const requestId = res.locals.requestId

  res.status(status).json({
    error: errorMessage,
    requestId,
    details: process.env.NODE_ENV === 'development' ? {
      stack: err.stack,
      name: err.name,
      path: req.path,
    } : undefined,
  })
}
