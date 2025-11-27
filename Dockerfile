# Multi-stage build for frontend and backend
FROM node:20-alpine AS frontend-builder

WORKDIR /app

# Copy frontend files
COPY frontend/package*.json ./frontend/
RUN cd frontend && npm ci

COPY frontend/ ./frontend/
RUN cd frontend && npm run build

# Backend stage
FROM node:20-alpine AS backend-builder

WORKDIR /app

# Copy backend files
COPY backend/package*.json ./backend/
RUN cd backend && npm ci

COPY backend/ ./backend/

# Copy built frontend to backend/public
COPY --from=frontend-builder /app/frontend/dist ./backend/public

# Build backend
RUN cd backend && npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy only production files
COPY --from=backend-builder /app/backend/package*.json ./
COPY --from=backend-builder /app/backend/dist ./dist
COPY --from=backend-builder /app/backend/public ./public

# Install only production dependencies
RUN npm ci --only=production

# Expose port (Railway will set PORT env var)
EXPOSE 3001

# Start the server
CMD ["node", "dist/server.js"]

