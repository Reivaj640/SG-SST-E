# Configuración de OnlyOffice Document Server

Esta guía explica cómo configurar y ejecutar OnlyOffice Document Server para la aplicación SG-SST.

## Requisitos Previos

- Docker instalado y corriendo
- Puerto 8080 disponible en el host

## Configuración Rápida

### En Windows

Opción 1: Usar el script PowerShell (Recomendado)
```powershell
.\start-onlyoffice.ps1
```

Opción 2: Usar el script Batch
```batch
start-onlyoffice.bat
```

### En Linux/Mac

```bash
chmod +x start-onlyoffice.sh
./start-onlyoffice.sh
```

## Configuración Manual

1. Iniciar los servicios:
```bash
docker-compose up -d
```

2. Verificar el estado:
```bash
docker-compose ps
```

3. Ver los logs:
```bash
docker-compose logs -f onlyoffice-documentserver
```

## Verificar que OnlyOffice Está Funcionando

Una vez iniciado, espera 2-3 minutos y verifica que el servidor esté listo accediendo a:

- Health check: http://localhost:8080/healthcheck
- Editor: http://localhost:8080/office-apps/editor/index.html

## Configuración de JWT

El servidor está configurado con los siguientes parámetros JWT:

- **JWT_ENABLED**: `true`
- **JWT_SECRET**: `P6dJQcyvA4LstDY2h16Jh6ay8SEJrMUY`
- **JWT_HEADER**: `Authorization`
- **JWT_IN_BODY**: `true`

Este secret debe coincidir con el configurado en:
- `modules/gestion-integral/politica/onlyoffice-bridge.js`
- `main.js` (handler `open-onlyoffice-editor`)

## Estructura de Docker Compose

El servicio incluye:

1. **onlyoffice-documentserver**: Servidor principal de OnlyOffice
2. **onlyoffice-postgresql**: Base de datos PostgreSQL
3. **onlyoffice-redis**: Servidor Redis para caché

## Puertos

- **8080**: Puerto HTTP principal (mapeado al puerto 80 del contenedor)
- **443**: Puerto HTTPS (mapeado al puerto 443 del contenedor)

## Comandos Útiles

### Detener los servicios
```bash
docker-compose down
```

### Detener y eliminar volúmenes
```bash
docker-compose down -v
```

### Reiniciar los servicios
```bash
docker-compose restart
```

### Ver logs en tiempo real
```bash
docker-compose logs -f onlyoffice-documentserver
```

### Acceder al contenedor
```bash
docker exec -it onlyoffice-documentserver bash
```

## Solución de Problemas

### El puerto 8080 está ocupado

Si recibes un error que el puerto está ocupado, puedes cambiar el puerto en `docker-compose.yml`:

```yaml
ports:
  - "8081:80"  # Cambiar 8080 a otro puerto
```

Luego actualiza la configuración en:
- `onlyoffice-bridge.js`
- `main.js`
- `politica-viewer.js`

### OnlyOffice no inicia

Verifica los logs:
```bash
docker-compose logs onlyoffice-documentserver
```

Los problemas comunes incluyen:
- Insuficiente memoria RAM (requiere al menos 4GB)
- Puerto 8080 ocupado
- Problemas de red de Docker

### Error de conexión desde la aplicación

Asegúrate de que:
1. OnlyOffice esté completamente iniciado (espera 2-3 minutos)
2. El puerto 8080 sea accesible desde tu app
3. El JWT_SECRET coincida en todos los archivos

## Personalización

### Agregar fuentes personalizadas

Copia tus fuentes a la carpeta `fonts/custom` dentro del contenedor:
```bash
docker cp /ruta/a/tu/fuente.ttf onlyoffice-documentserver:/usr/share/fonts/truetype/custom/
```

Luego reinicia el contenedor:
```bash
docker-compose restart onlyoffice-documentserver
```

### Configurar SSL

Para producción, configura SSL editando `docker-compose.yml` y agregando certificados:

```yaml
volumes:
  - ./certs:/var/www/onlyoffice/Data/certs
```

## Actualización

Para actualizar a la última versión:

```bash
docker-compose pull
docker-compose down
docker-compose up -d
```

## Recursos

- Documentación oficial: https://api.onlyoffice.com/docserver/
- Docker Hub: https://hub.docker.com/r/onlyoffice/documentserver
- Issues de OnlyOffice: https://github.com/ONLYOFFICE/DocumentServer/issues
