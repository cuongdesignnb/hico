# Stage 1: Build Vite React App
FROM node:20-alpine AS build
WORKDIR /app
ARG VITE_PUBLIC_SITE_URL
ENV VITE_PUBLIC_SITE_URL=$VITE_PUBLIC_SITE_URL
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: Serve with Nginx
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 5173
CMD ["nginx", "-g", "daemon off;"]
