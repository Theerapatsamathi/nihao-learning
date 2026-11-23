# Multi-stage Dockerfile for Google Cloud Run (你好 Nihao)
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml* ./
RUN npm install --no-audit --no-fund
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
COPY package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/gcp ./gcp
EXPOSE 8080
CMD ["node", "gcp/server.mjs"]
