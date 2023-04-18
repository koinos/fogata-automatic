FROM node:18-alpine as builder
WORKDIR /app
COPY package.json .
COPY yarn.lock .
RUN yarn install --frozen-lockfile
COPY . .
RUN yarn build

FROM node:18-alpine
WORKDIR /app
COPY --from=builder /app/package.json .
COPY --from=builder /app/yarn.lock .
RUN yarn install --production
COPY --from=builder /app/dist ./dist
CMD ["yarn", "start"]
