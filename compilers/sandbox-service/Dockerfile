FROM node:20-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
  ca-certificates \
  wget \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json yarn.lock* ./

RUN yarn install --production && yarn cache clean

COPY . .

RUN mkdir -p /app/logs && chmod 755 /app/logs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:3000/health || exit 1

CMD ["node", "server.js"]