# Multi-stage build for frontend and backend
FROM node:20-alpine AS frontend-builder

WORKDIR /app

# Copy frontend files
COPY frontend/package*.json ./frontend/
RUN cd frontend && npm ci

COPY frontend/ ./frontend/

# Build frontend with environment variables
# These need to be set as build args in Railway (or use defaults for build)
ARG VITE_SUPABASE_URL=${VITE_SUPABASE_URL:-https://okgerovytptsrylpweqo.supabase.co}
ARG VITE_SUPABASE_ANON_KEY=${VITE_SUPABASE_ANON_KEY:-}
ARG VITE_API_URL=${VITE_API_URL:-}

# Set as ENV so Vite can access them during build
ENV VITE_SUPABASE_URL=${VITE_SUPABASE_URL}
ENV VITE_SUPABASE_ANON_KEY=${VITE_SUPABASE_ANON_KEY}
ENV VITE_API_URL=${VITE_API_URL}

# Build frontend
RUN echo "Building frontend with VITE_SUPABASE_URL=${VITE_SUPABASE_URL}" && \
    cd frontend && \
    npm run build && \
    echo "Frontend build complete"

# Verify frontend build
RUN echo "Verifying frontend build..." && \
    ls -la frontend/dist/ && \
    test -f frontend/dist/index.html && \
    echo "✅ Frontend build verified: index.html exists" || \
    (echo "❌ ERROR: index.html not found in frontend/dist" && ls -la frontend/dist/ && exit 1)

# Backend stage
FROM node:20-alpine AS backend-builder

WORKDIR /app

# Copy backend files
COPY backend/package*.json ./backend/
RUN cd backend && npm ci

COPY backend/ ./backend/

# Copy built frontend to backend/public
COPY --from=frontend-builder /app/frontend/dist ./backend/public

# Verify frontend was copied
RUN ls -la backend/public/ || echo "Public directory not found"
RUN test -f backend/public/index.html || (echo "index.html not found in backend/public" && exit 1)

# Build backend
RUN cd backend && npm run build

# Verify backend build
RUN ls -la backend/dist/ || echo "Backend dist not found"
RUN test -f backend/dist/server.js || (echo "server.js not found in backend/dist" && exit 1)

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy only production files
COPY --from=backend-builder /app/backend/package*.json ./
COPY --from=backend-builder /app/backend/dist ./dist
COPY --from=backend-builder /app/backend/public ./public

# Verify files are in place
RUN ls -la /app/ || echo "App directory listing"
RUN ls -la /app/dist/ || echo "Dist directory listing"
RUN ls -la /app/public/ || echo "Public directory listing"
RUN test -f /app/dist/server.js || (echo "ERROR: server.js not found" && exit 1)
RUN test -f /app/public/index.html || (echo "ERROR: index.html not found" && exit 1)

# Install only production dependencies
RUN npm ci --only=production

# Expose port (Railway will set PORT env var)
EXPOSE 3001

# Start the server
CMD ["node", "dist/server.js"]

