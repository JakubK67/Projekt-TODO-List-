FROM composer:2 AS vendor
WORKDIR /app
COPY composer.json ./
RUN composer install --no-dev --no-interaction --prefer-dist

FROM php:8.3-cli
RUN docker-php-ext-install pdo_mysql
WORKDIR /app
COPY --from=vendor /app/vendor ./vendor
COPY public ./public
EXPOSE 8080
CMD ["php", "-S", "0.0.0.0:8080", "-t", "public"]
