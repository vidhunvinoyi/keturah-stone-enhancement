# Build stage
FROM node:22-alpine AS builder
WORKDIR /app/agent

# Copy package files
COPY agent/package.json ./
RUN npm install

# Copy source
COPY agent/ ./

# Production stage
FROM node:22-alpine
WORKDIR /app/agent

# Copy dependencies and source
COPY --from=builder /app/agent/node_modules ./node_modules
COPY agent/ ./

# Run the agent
CMD ["npm", "start"]
