FROM castopod/castopod:latest

# Configuration pour CleverCloud
# CleverCloud attend que l'application écoute sur le port défini par la variable PORT
# Castopod utilise Apache qui écoute sur le port 8000 par défaut

# Exposer le port 8080 pour CleverCloud
EXPOSE 8080

# Modifier la configuration Apache pour écouter sur $PORT au lieu de 8000
RUN sed -i 's/Listen 8000/Listen ${PORT}/' /etc/apache2/ports.conf && \
    sed -i 's/:8000/:${PORT}/' /etc/apache2/sites-available/000-default.conf

# Démarrer Apache en avant-plan
CMD ["apache2-foreground"]
