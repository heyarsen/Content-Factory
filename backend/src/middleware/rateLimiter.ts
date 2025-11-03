import rateLimit from 'express-rate-limit'

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  // Skip validation for trust proxy since we're behind Railway's proxy
  validate: {
    trustProxy: false,
    xForwardedForHeader: false,
  },
})

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: 'Too many authentication requests, please try again later.',
  validate: {
    trustProxy: false,
    xForwardedForHeader: false,
  },
})

