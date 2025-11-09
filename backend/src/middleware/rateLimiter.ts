import rateLimit from 'express-rate-limit'

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs (increased to handle polling)
  message: 'Too many requests from this IP, please try again later.',
  // Skip validation for trust proxy since we're behind Railway's proxy
  validate: {
    trustProxy: false,
    xForwardedForHeader: false,
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
})

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 requests per windowMs (increased to reduce false positives)
  message: 'Too many authentication requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  validate: {
    trustProxy: false,
    xForwardedForHeader: false,
  },
  // Custom handler to return proper JSON response
  handler: (req, res) => {
    res.status(429).json({ 
      error: 'Too many authentication requests, please try again later.',
      message: 'You have made too many login attempts. Please wait 15 minutes before trying again.',
    })
  },
})

