FROM node:20-alpine

WORKDIR /app

COPY backend/package.json backend/
RUN cd backend && npm install

COPY backend/ backend/
COPY frontend/ frontend/

EXPOSE 3001

CMD ["node", "backend/index.js"]