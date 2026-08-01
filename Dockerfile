# Build local monorepo image
# docker build --no-cache -t  flowise .

# Run image
# docker run -d -p 3000:3000 flowise

FROM node:24-alpine

# Install system dependencies and build tools
RUN apk update && \
    apk add --no-cache \
    libc6-compat \
    python3 \
    make \
    g++ \
    build-base \
    cairo-dev \
    pango-dev \
    chromium \
    curl && \
    npm install -g pnpm@10.26.0

ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

ENV NODE_OPTIONS=--max-old-space-size=4096
ENV HOST=0.0.0.0

WORKDIR /usr/src/flowise

# Copy app source
COPY . .

# Install dependencies and build (excluding sdk packages not needed for Docker)
RUN pnpm install && \
    pnpm build:docker

# Runtime memory limit and networking for Node V8 heap
ENV NODE_OPTIONS=--max-old-space-size=2048
ENV PORT=3000
ENV HOST=0.0.0.0
ENV NODE_TLS_REJECT_UNAUTHORIZED=0

# Give the node user ownership of the application files
RUN chown -R node:node .

# Switch to non-root user (node user already exists in node:20-alpine)
USER node

EXPOSE 3000

CMD [ "node", "-e", "require('./packages/server/dist/index.js').start().catch(console.error)" ]
