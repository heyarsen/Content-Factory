# Multi-stage build for frontend and backend
FROM node:20-alpine AS frontend-builder

WORKDIR /app

# Copy frontend files
COPY frontend/package*.json ./frontend/
RUN npm config set fetch-retries 5 && \
    npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000 && \
    cd frontend && npm ci || \
    (echo "First attempt failed, retrying..." && sleep 5 && npm ci) || \
    (echo "Second attempt failed, retrying..." && sleep 10 && npm ci)

COPY frontend/ ./frontend/

# Build frontend with environment variables
# These need to be set as build args in Railway
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_API_URL

# Build frontend
RUN echo "Building frontend..." && \
    cd frontend && \
    VITE_SUPABASE_URL=${VITE_SUPABASE_URL} \
    VITE_SUPABASE_ANON_KEY=${VITE_SUPABASE_ANON_KEY} \
    VITE_API_URL=${VITE_API_URL} \
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
RUN npm config set fetch-retries 5 && \
    npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000 && \
    cd backend && npm ci || \
    (echo "First attempt failed, retrying..." && sleep 5 && npm ci) || \
    (echo "Second attempt failed, retrying..." && sleep 10 && npm ci)

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

# Install only production dependencies with retry logic
RUN npm config set fetch-retries 5 && \
    npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000 && \
    npm ci --only=production || \
    (echo "First attempt failed, retrying..." && sleep 5 && npm ci --only=production) || \
    (echo "Second attempt failed, retrying..." && sleep 10 && npm ci --only=production)

# Expose port (Railway will set PORT env var)
EXPOSE 3001

# Start the server
CMD ["node", "dist/server.js"]

