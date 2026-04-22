FROM node:18-alpine

WORKDIR /app

# Copiar package.json
COPY package*.json ./

# Instalar dependências
RUN npm install --production

# Copiar resto do código
COPY . .

# Expor porta
EXPOSE 5000

# Comando para iniciar
CMD ["npm", "start"]
