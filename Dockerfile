FROM mcr.microsoft.com/playwright:v1.46.0-jammy

WORKDIR /app

# Copia package.json e package-lock.json se esiste
COPY package*.json ./

# Installa le dipendenze (senza dev)
RUN npm install --omit=dev

# Copia il resto del codice
COPY . .

# Imposta variabili ambiente
ENV NODE_ENV=production

# Espone la porta 3000
EXPOSE 3000

# Comando di avvio
CMD ["node", "index.js"]
