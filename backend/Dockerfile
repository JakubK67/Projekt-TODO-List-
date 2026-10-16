FROM composer:2 AS vendor
WORKDIR /app
COPY composer.json composer.lock ./
RUN composer install --no-dev --no-interaction --prefer-dist --no-scripts --no-autoloader

FROM php:8.3-cli
RUN apt-get update && apt-get install -y --no-install-recommends libxml2-dev libzip-dev unzip \
    && docker-php-ext-install pdo_mysql xml zip \
    && apt-get clean && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=vendor /app/vendor ./vendor
COPY --from=vendor /usr/bin/composer /usr/local/bin/composer
COPY . .
RUN composer dump-autoload --no-dev --classmap-authoritative
EXPOSE 8080
CMD ["sh", "-c", "php bin/console app:database:init && php -S 0.0.0.0:8080 -t public public/router.php"]
