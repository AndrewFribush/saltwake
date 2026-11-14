# Hosted Saltwake: one container serving the built web and the testnet API on one origin (apps/server/src/static-web.ts).
# The contract WASM is built outside the image (npm run build:contract) and copied in; the server hashes it at start.
FROM node:22.23.1-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build
ENV NODE_ENV=production PORT=8080
EXPOSE 8080
ENTRYPOINT ["/bin/sh","/app/deploy/entrypoint.sh"]
