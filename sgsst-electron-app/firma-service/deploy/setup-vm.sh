#!/usr/bin/env bash
# =============================================================================
# K+AIR Firma Electrónica — Setup de VM (Ubuntu 22.04/24.04, Oracle Always Free)
# =============================================================================
# Uso (en la VM, como usuario con sudo):
#   chmod +x setup-vm.sh
#   ./setup-vm.sh
#
# Qué hace (idempotente, se puede re-ejecutar):
#   1. Instala Node.js 20 LTS, Caddy (HTTPS automático), sqlite3 (backups)
#   2. Crea usuario de servicio kairfirma (sin login)
#   3. Crea la estructura /opt/kair-firma (app, data, storage, backups)
#   4. Firewall: solo 22 (SSH), 80 y 443 (Caddy). El puerto 3001 NUNCA queda
#      expuesto a internet (solo 127.0.0.1 detrás de Caddy).
#
# Después de este script falta: subir el código, crear .env, instalar
# dependencias, levantar el servicio systemd y configurar Caddyfile.
# Ver README-DESPLIEGUE.md (paso 5 en adelante).
# =============================================================================
set -euo pipefail

echo "==> [1/5] Paquetes base"
sudo apt-get update -y
sudo apt-get install -y curl ca-certificates sqlite3

echo "==> [2/5] Node.js 20 LTS (NodeSource)"
if ! command -v node >/dev/null 2>&1 || [ "$(node -v | cut -d. -f1 | tr -d v)" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
node -v
npm -v

echo "==> [3/5] Caddy (HTTPS automático con Let's Encrypt)"
if ! command -v caddy >/dev/null 2>&1; then
  sudo apt-get install -y debian-keyring debian-archive-keyring apt-transport-https
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
  sudo apt-get update -y
  sudo apt-get install -y caddy
fi
caddy version

echo "==> [4/5] Usuario de servicio y carpetas"
if ! id kairfirma >/dev/null 2>&1; then
  sudo useradd --system --shell /usr/sbin/nologin --home-dir /opt/kair-firma kairfirma
fi
sudo mkdir -p /opt/kair-firma/data /opt/kair-firma/storage/pdfs/originales \
             /opt/kair-firma/storage/pdfs/firmados /opt/kair-firma/storage/pdfs/constancias \
             /opt/kair-firma/backups
sudo chown -R kairfirma:kairfirma /opt/kair-firma

echo "==> [5/5] Firewall (UFW): SSH + 80/443 solamente"
sudo ufw allow OpenSSH >/dev/null
sudo ufw allow 80/tcp >/dev/null    # HTTP → redirige a HTTPS (y desafío LE)
sudo ufw allow 443/tcp >/dev/null   # HTTPS (Caddy)
sudo ufw deny 3001 >/dev/null       # El servicio NUNCA se expone directo
sudo ufw --force enable >/dev/null
sudo ufw status verbose

echo ""
echo "✔ Setup base completo. Siguiente: README-DESPLIEGUE.md pasos 5-9"
echo "  (subir código, crear .env, npm ci, systemd, Caddyfile)"
