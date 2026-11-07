# ORGANICHY — 22 MB image, no build step, no node_modules.
FROM node:20-alpine

ENV NODE_ENV=production
WORKDIR /app

# No npm install: the app has zero runtime dependencies. If you add any, copy
# package*.json first and run `npm ci --omit=dev` to keep the layer cache.
COPY package.json ./
COPY server.js ./
COPY lib ./lib
COPY public ./public

# Writable folder for the JSON datastore. Mount a volume here in production
# (`-v organichy-data:/app/data`) or the orders vanish when the container dies.
RUN mkdir -p /app/data && chown -R node:node /app
VOLUME ["/app/data"]
ENV DATA_DIR=/app/data

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=4s --start-period=6s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
