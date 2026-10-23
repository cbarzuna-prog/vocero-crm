#!/usr/bin/env bash
# ============================================================
# Fork Knock Knock — Instala (o actualiza) el CRM en un servidor Ubuntu nuevo.
#
# Pensado para la VM de pruebas de Oracle Cloud (ARM, Ubuntu 24.04), sirve
# igual en Contabo. Se corre desde la computadora del dueño, sin copiar la
# llave a ningún lado:
#
#   ssh -i ~/.ssh/<llave> ubuntu@<IP> \
#     "curl -fsSL https://raw.githubusercontent.com/cbarzuna-prog/vocero-crm/feat/046-propiedades-y-tareas/scripts/instalar-servidor.sh | DOMAIN=crm-pruebas.knockknockcr.com bash"
#
# Qué hace: instala Docker, abre 80/443 en el firewall del sistema (las
# imágenes de Oracle traen iptables cerrado aunque la red de Oracle esté
# abierta), descarga el fork, genera el .env con secretos nuevos EN el
# servidor (jamás pasan por el chat) y construye/levanta app + Postgres +
# Caddy (HTTPS automático) en segundo plano. Sin agente de IA (bandeja manual):
# Nea se conecta después.
#
# Re-ejecutable: si ya existe, actualiza el código y conserva el .env y los
# datos.
# ============================================================
set -euo pipefail

DOMAIN="${DOMAIN:?Falta DOMAIN, p. ej. DOMAIN=crm-pruebas.knockknockcr.com}"
BRANCH="${BRANCH:-feat/046-propiedades-y-tareas}"
REPO="${REPO:-https://github.com/cbarzuna-prog/vocero-crm.git}"
DIR="${DIR:-$HOME/vocero}"
LOG="$HOME/vocero-instalacion.log"

paso() { printf '\n==> %s\n' "$*"; }

paso "1/5 Docker"
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sudo sh
  sudo usermod -aG docker "$USER" || true
else
  echo "Docker ya está instalado: $(docker --version)"
fi
command -v git >/dev/null 2>&1 || sudo apt-get install -y git

paso "2/5 Firewall del sistema: puertos 80 y 443"
for p in 80 443; do
  if ! sudo iptables -C INPUT -p tcp --dport "$p" -m state --state NEW -j ACCEPT 2>/dev/null; then
    sudo iptables -I INPUT 1 -p tcp --dport "$p" -m state --state NEW -j ACCEPT
  fi
done
if command -v netfilter-persistent >/dev/null 2>&1; then
  sudo netfilter-persistent save >/dev/null
else
  echo "(sin netfilter-persistent: las reglas valen hasta el próximo reinicio)"
fi

paso "3/5 Código ($BRANCH)"
if [ -d "$DIR/.git" ]; then
  git -C "$DIR" fetch --depth 1 origin "$BRANCH"
  git -C "$DIR" checkout -B "$BRANCH" FETCH_HEAD
else
  git clone --depth 1 -b "$BRANCH" "$REPO" "$DIR"
fi
cd "$DIR"
echo "Commit: $(git rev-parse --short HEAD)"

paso "4/5 Configuración (.env)"
if [ -f .env ]; then
  echo ".env ya existe: se conserva (secretos y datos intactos)."
else
  PGPASS="$(openssl rand -hex 24)"
  umask 077
  cat > .env <<EOF
# Generado por scripts/instalar-servidor.sh el $(date -u +%F). No lo comparta.
APP_BASE_URL=https://$DOMAIN
DOMAIN=$DOMAIN
POSTGRES_PASSWORD=$PGPASS
DATABASE_URL=postgresql://postgres:$PGPASS@postgres:5432/vocero
BETTER_AUTH_SECRET=$(openssl rand -base64 32)
ENCRYPTION_KEY=$(openssl rand -base64 32)
META_WEBHOOK_VERIFY_TOKEN=$(openssl rand -hex 32)
META_GRAPH_API_VERSION=v25.0
BOT_API_KEY=$(openssl rand -hex 32)
# Sin agente por ahora (bandeja manual). Para conectar Nea, borrar estas dos.
BRAIN_HEALTH_URL=
BRAIN_DISPATCH_URL=
# Módulos del fork (046).
TAREAS=on
PROPIEDADES=on
EOF
  echo ".env creado con secretos nuevos."
fi

paso "5/5 Construcción y arranque (en segundo plano, ~10–15 min en ARM)"
# --build siempre: es un fork con cambios propios y la imagen oficial es amd64.
# Sin `nea`: se agrega cuando se conecte el agente.
setsid nohup sudo docker compose up -d --build app postgres caddy </dev/null >"$LOG" 2>&1 &
echo "Construyendo… el avance queda en $LOG"
echo
echo "Listo por ahora. Puede cerrar esta ventana: la construcción sigue sola."
echo "Cuando termine, https://$DOMAIN/api/health responderá {\"ok\":true,…}."
