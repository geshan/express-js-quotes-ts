# --- Build Stage ---
FROM node:24-alpine AS builder

WORKDIR /app

RUN apk add --no-cache openssl

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci

COPY tsconfig.json ./
COPY src ./src

# Generate Prisma Client and compile TS to JS
RUN npx prisma generate
RUN npm run build

# --- Test Stage ---
FROM node:24-alpine AS tester

WORKDIR /app

RUN apk add --no-cache openssl

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci

COPY tsconfig.json ./
COPY src ./src
COPY tests ./tests

# Generate Prisma Client
RUN npx prisma generate

CMD ["sh", "-c", "npx prisma migrate deploy && npm test"]

# --- Production Stage ---
FROM node:24-alpine AS runner

WORKDIR /app

RUN apk add --no-cache openssl

ENV NODE_ENV=production

COPY package*.json ./
COPY prisma ./prisma/

# Install only production dependencies
RUN npm ci --only=production && npx prisma generate

# Copy compiled code from builder stage
COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["node", "dist/server.js"]
