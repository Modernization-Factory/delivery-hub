# DeliveryHub — single image: Express API + the built React bundle on one origin.
# Build from the REPO ROOT (the web/ build stage needs to be in context):
#   docker build -t <registry>/deliveryhub:<tag> .

# --- stage 1: build the frontend ---
FROM node:20-alpine AS web
WORKDIR /build
COPY web/package*.json ./
RUN npm ci
COPY web/ ./
RUN npm run build          # -> /build/dist

# --- stage 2: API runtime ---
FROM node:20-alpine
WORKDIR /app
COPY api/package*.json ./
RUN npm ci --omit=dev
COPY api/src ./src
COPY api/scripts ./scripts
COPY --from=web /build/dist ./public
EXPOSE 8080
USER node
CMD ["node", "src/server.js"]
