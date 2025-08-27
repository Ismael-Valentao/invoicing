FROM ghcr.io/puppeteer/puppeteer:24.10.0

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install
COPY . .

CMD ["node", "server.js"]
