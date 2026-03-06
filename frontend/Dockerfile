# Stage 1: Build the frontend explicitly with Bun
FROM oven/bun:alpine AS builder

WORKDIR /app

# Cache dependencies
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Copy source and build
COPY . .
RUN bun run build


# Stage 2: Serve with Nginx for minimal footprint and maximum security
FROM nginx:alpine-slim

# Copy the built assets to Nginx
COPY --from=builder /app/dist /usr/share/nginx/html

# Provide a lightweight non-root setup for Nginx if necessary
# Modern nginx:alpine-slim allows running as nginx user
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
