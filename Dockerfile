# Stage 1: Install all dependencies
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# Stage 2: Build the application
FROM node:24-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN node ace build

# Stage 3: Install production dependencies only
FROM node:24-alpine AS production-deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Stage 4: Final production image
FROM node:24-alpine
WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV TZ=UTC
ENV LOG_LEVEL=info

# Copy compiled code and production dependencies
COPY --from=production-deps /app/node_modules ./node_modules
COPY --from=build /app/build ./

# Start the server
CMD ["node", "bin/server.js"]
