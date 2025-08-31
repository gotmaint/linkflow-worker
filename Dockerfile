FROM mcr.microsoft.com/playwright:v1.46.0-jammy
WORKDIR /app
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
COPY package*.json ./
RUN npm install --omit=dev
COPY . .
# Check: deve stampare la versione (fallisce la build se manca)
RUN npx playwright --version
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node","index.js"]
