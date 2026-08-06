FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .

EXPOSE 3001

# Push schema to DB, seed if empty, then start the server
CMD ["sh", "-c", "npx drizzle-kit push && node src/startup.js && node src/index.js"]
