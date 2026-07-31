FROM php:8.4-apache

# Estensioni PHP richieste dal gestionale (il codice usa solo PDO MySQL;
# mysqli e' incluso perche' alcuni script diagnostici lo cercano).
RUN docker-php-ext-install pdo_mysql mysqli \
    && a2enmod rewrite headers

# Limiti upload allineati agli allegati delle consuntivazioni
RUN { \
      echo 'upload_max_filesize = 32M'; \
      echo 'post_max_size = 40M'; \
      echo 'max_file_uploads = 30'; \
      echo 'date.timezone = Europe/Rome'; \
      echo 'display_errors = On'; \
      echo 'error_reporting = E_ALL'; \
    } > /usr/local/etc/php/conf.d/zz-gestionale.ini

COPY vhost.conf /etc/apache2/sites-available/000-default.conf

WORKDIR /var/www/html
