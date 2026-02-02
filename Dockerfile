# Use Node.js 22 (LTS)
FROM node:22-alpine AS base

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Setup workspace
WORKDIR /app

# Copy package management files
COPY package.json pnpm-lock.yaml ./

# Install dependencies (frozen lockfile for reproducibility)
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build the application
# This runs "vite build" and "esbuild" as defined in package.json
RUN pnpm run build

# --- Production Runner ---
FROM node:22-alpine AS runner
WORKDIR /app

# Enable pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy production dependencies only
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile

# Copy built assets from builder
COPY --from=base /app/dist ./dist
# If you have static assets in public, vite usually bundles them, 
# but if server relies on other folders, copy them here:
# COPY --from=base /app/server ./server 
# (Note: package.json script bundles server/_core/index.ts to dist/index.js, so strict dist copy might be enough)

# Set environment
ENV NODE_ENV=production
ENV PORT=3000

# Expose port
EXPOSE 3000

# Command to run (matches "start" script)
CMD ["node", "dist/index.js"]
