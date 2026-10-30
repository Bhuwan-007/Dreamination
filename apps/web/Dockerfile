FROM node:20-alpine AS builder

WORKDIR /workspace

# Install web dependencies
COPY apps/web/package.json ./apps/web/
RUN cd apps/web && npm install

# Copy web source
COPY apps/web ./apps/web

WORKDIR /workspace/apps/web
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /workspace/apps/web

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=builder /workspace/apps/web/public ./public
COPY --from=builder /workspace/apps/web/.next ./.next
COPY --from=builder /workspace/apps/web/node_modules ./node_modules
COPY --from=builder /workspace/apps/web/package.json ./package.json

EXPOSE 3000

CMD ["npm", "start"]
