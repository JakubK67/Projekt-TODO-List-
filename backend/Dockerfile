FROM composer:2 AS vendor
WORKDIR /app
COPY composer.json ./
RUN composer install --no-dev --no-interaction --prefer-dist

FROM php:8.3-cli
RUN apt-get update \
    && apt-get install -y libpq-dev \
    && docker-php-ext-install pdo_pgsql \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=vendor /app/vendor ./vendor
COPY public ./public
EXPOSE 8080
CMD ["php", "-S", "0.0.0.0:8080", "-t", "public"]
