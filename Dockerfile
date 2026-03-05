FROM ghcr.io/puppeteer/puppeteer:24.10.0

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install

COPY . .

# ✅ vira root só para preparar pastas/permissões
USER root
RUN mkdir -p /usr/src/app/public/images/logos \
  && chown -R pptruser:pptruser /usr/src/app

# ✅ volta para o user seguro da imagem
USER pptruser

CMD ["node", "server.js"]