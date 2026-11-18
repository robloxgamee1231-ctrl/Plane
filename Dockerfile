FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

FROM node:22-bookworm-slim
ENV NODE_ENV=production PORT=4173 NDX_DATA_DIR=/var/lib/ndx
WORKDIR /app
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/server ./server
RUN mkdir -p /var/lib/ndx && chown node:node /var/lib/ndx
USER node
EXPOSE 4173
VOLUME /var/lib/ndx
CMD ["node", "server/start.mjs"]
