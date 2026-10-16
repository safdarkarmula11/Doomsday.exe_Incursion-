# Next.js + Prisma + Chromium (for PDF/PNG export) on Render.
FROM node:22-bookworm-slim

# Chromium for puppeteer, plus the fonts cards use:
# fonts-liberation = Arial/Times/Courier look-alikes, fonts-dejavu-core = Verdana/Georgia fallback,
# fonts-freefont-ttf = Hindi and Gujarati names.
RUN apt-get update && apt-get install -y --no-install-recommends \
      chromium fontconfig fonts-liberation fonts-dejavu-core fonts-freefont-ttf ca-certificates openssl \
    && fc-cache -f && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    NEXT_TELEMETRY_DISABLED=1

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY prisma ./prisma
RUN npx prisma generate
COPY . .
# The build does not connect to the database; this value is only a placeholder.
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build npm run build

ENV NODE_ENV=production \
    NODE_OPTIONS=--max-old-space-size=256
EXPOSE 10000
# Create/update the tables, then start. PORT is set by Render.
CMD ["sh", "-c", "npx prisma db push --skip-generate && npx next start -p ${PORT:-10000}"]