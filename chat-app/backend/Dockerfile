# ============================================
# Multi-stage Dockerfile for Chat App Backend
# Optimized for Google Cloud Run
# ============================================

# Stage 1: Build dependencies
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (including devDependencies for potential build steps)
RUN npm ci --only=production && npm cache clean --force

# Stage 2: Production runtime
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

# Copy dependencies from builder
COPY --from=builder /app/node_modules ./node_modules

# Copy application source
COPY . .

# Create symlink for shared directory
# index.js uses ../../../shared which resolves to /shared from /app/src/
# So we need to link /shared -> /app/shared
RUN ln -s /app/shared /shared

# Force cache invalidation for shared directory
ARG CACHE_BUST=unknown
RUN echo "Cache bust: $CACHE_BUST"

# Change ownership to nodejs user (include /shared symlink)
RUN chown -R nodejs:nodejs /app && chown -h nodejs:nodejs /shared

# Switch to non-root user
USER nodejs

# Expose port (Cloud Run will override this with PORT env var)
EXPOSE 8080

# Health check (使用 wget 避免 ESM/CommonJS 問題)
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT:-8080}/health || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "src/index.js"]
