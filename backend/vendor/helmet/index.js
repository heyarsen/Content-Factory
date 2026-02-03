const DEFAULT_HEADERS = {
  "X-DNS-Prefetch-Control": "off",
  "X-Frame-Options": "SAMEORIGIN",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "X-Download-Options": "noopen",
  "X-Permitted-Cross-Domain-Policies": "none"
};

export default function helmet(options = {}) {
  const {
    contentSecurityPolicy = true,
    crossOriginEmbedderPolicy = true,
    headers = {}
  } = options;

  const computedHeaders = {
    ...DEFAULT_HEADERS,
    ...headers
  };

  if (contentSecurityPolicy !== false) {
    computedHeaders["Content-Security-Policy"] =
      "default-src 'self'; base-uri 'self'; frame-ancestors 'self'";
  }

  if (crossOriginEmbedderPolicy !== false) {
    computedHeaders["Cross-Origin-Embedder-Policy"] = "require-corp";
  }

  return function helmetMiddleware(_req, res, next) {
    Object.entries(computedHeaders).forEach(([key, value]) => {
      if (value) {
        res.setHeader(key, value);
      }
    });
    if (typeof next === "function") {
      next();
    }
  };
}
