FROM node:20

WORKDIR /app

COPY . /app

RUN apt-get update && apt-get install -y poppler-data && apt-get install -y poppler-utils

RUN npm install -g pnpm

RUN pnpm i

RUN pnpm build:app

RUN pnpm build:server