FROM node:20-alpine
WORKDIR /app

# Install system dependencies (if needed, we can add postgresql-client later)
# Note: We don't actually need postgresql-client for runtime, only for migrations
# RUN apk add --no-cache postgresql-client

# Copy package files
COPY package*.json ./
RUN npm ci --no-audit --no-fund

# Copy source code
COPY . .

# Build client and server bundle
RUN npm run build

# Make scripts executable
RUN chmod +x server/init-db.js server/start-app.js server/health-check.js

ENV NODE_ENV=production
ENV PORT=5000
EXPOSE 5000

# Start with database initialization then run app
CMD ["sh", "-c", "node server/init-db.js && node server/start-app.js"]


