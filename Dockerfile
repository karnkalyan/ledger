FROM node:20-bookworm-slim

# Install system dependencies (OpenSSL required by Prisma engine)
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy dependency definitions and prisma schema
COPY package.json package-lock.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci

# Copy application source code
COPY . .

# Generate Prisma Client (using placeholder URL for build time)
ENV DATABASE_URL="mysql://dummy:dummy@localhost:3306/dummy"
RUN npx prisma generate

# Build Next.js application
RUN npm run build

# Copy entrypoint script and ensure executable permissions
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 3081

ENV NODE_ENV=production
ENV PORT=3081
ENV HOSTNAME="0.0.0.0"

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["npm", "start"]
