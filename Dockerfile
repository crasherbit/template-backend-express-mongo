FROM node:24-slim

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /usr/src/app

COPY package.json pnpm-lock.yaml ./

RUN pnpm i --prod

COPY . .

EXPOSE 3000

CMD ["pnpm", "start"]
