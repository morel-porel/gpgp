FROM nginx:alpine
COPY site/ /usr/share/nginx/html/
RUN printf 'gzip on;\ngzip_types text/css application/javascript;\n' > /etc/nginx/conf.d/gzip.conf
EXPOSE 80
