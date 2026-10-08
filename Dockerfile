FROM node:24-alpine
WORKDIR /app
COPY server.mjs index.html app.js hologram.js style.css sample-public.b64 ./
ENV PORT=3000 DATA_DIR=/data NODE_ENV=production
EXPOSE 3000
CMD ["node", "server.mjs"]
