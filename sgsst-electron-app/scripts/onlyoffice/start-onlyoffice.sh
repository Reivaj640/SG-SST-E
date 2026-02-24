#!/bin/bash

echo "===================================="
echo "Iniciando OnlyOffice Document Server"
echo "===================================="
echo ""

# Verificar si Docker está corriendo
if ! docker ps > /dev/null 2>&1; then
    echo "Error: Docker no está corriendo. Por favor inicia Docker primero."
    exit 1
fi

# Verificar contenedores existentes
echo "Verificando contenedores existentes..."
if docker ps -a --filter "name=onlyoffice" --format "{{.Names}}" | grep -q "onlyoffice-documentserver"; then
    echo "Contenedor OnlyOffice existe. Deteniendo y eliminando..."
    docker-compose down
    echo ""
fi

# Iniciar OnlyOffice
echo "Iniciando OnlyOffice Document Server..."
echo "Esto puede tomar varios minutos la primera vez..."
echo ""

docker-compose up -d

if [ $? -ne 0 ]; then
    echo "Error iniciando OnlyOffice Document Server"
    exit 1
fi

echo ""
echo "===================================="
echo "Verificando estado del servidor..."
echo "===================================="
sleep 10

docker-compose ps

echo ""
echo "===================================="
echo "Esperando que OnlyOffice esté listo..."
echo "===================================="
echo "Esto puede tomar 2-3 minutos..."
echo ""

# Esperar hasta que OnlyOffice esté listo
max_attempts=60
attempt=0
ready=false

while [ "$ready" = false ] && [ $attempt -lt $max_attempts ]; do
    if curl -s -f http://localhost:8080/healthcheck > /dev/null 2>&1; then
        ready=true
    else
        echo "Esperando... (intento $((attempt + 1))/$max_attempts)"
        sleep 5
        attempt=$((attempt + 1))
    fi
done

if [ "$ready" = true ]; then
    echo ""
    echo "===================================="
    echo "OnlyOffice Document Server está listo!"
    echo "===================================="
    echo "URL del servidor: http://localhost:8080"
    echo "Editor: http://localhost:8080/office-apps/editor/index.html"
    echo ""
    echo "Para ver logs: docker-compose logs -f onlyoffice-documentserver"
    echo "Para detener: docker-compose down"
    echo ""
else
    echo ""
    echo "===================================="
    echo "Tiempo de espera agotado. OnlyOffice puede que no esté listo todavía."
    echo "===================================="
    echo ""
    echo "Revisa los logs con: docker-compose logs -f onlyoffice-documentserver"
    echo ""
fi
