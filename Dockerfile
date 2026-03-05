FROM ghcr.io/puppeteer/puppeteer:24.10.0

WORKDIR /usr/src/app

# Instala deps (melhor com cache)
COPY package*.json ./
RUN npm install

# Copia o projeto
COPY . .

# ✅ cria a pasta de uploads e dá permissão ao user padrão da imagem
RUN mkdir -p /usr/src/app/public/images/logos \
  && chown -R pptruser:pptruser /usr/src/app

# ✅ corre a app como user não-root (boa prática)
USER pptruser

CMD ["node", "server.js"]