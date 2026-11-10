#!/usr/bin/env bash
# ============================================================
# Fork Knock Knock — Instala (o actualiza) el CRM en un servidor Ubuntu.
#
# Pensado para la VM de Oracle Cloud (ARM, Ubuntu 24.04), sirve igual en
# Contabo. Se corre desde la computadora del dueño, sin copiar la llave a
# ningún lado:
#
#   ssh -i ~/.ssh/<llave> ubuntu@<IP> \
#     "curl -fsSL https://raw.githubusercontent.com/cbarzuna-prog/vocero-crm/feat/046-propiedades-y-tareas/scripts/instalar-servidor.sh | ENTORNO=real bash"
#
# Dos entornos en el mismo servidor (066):
#
#   ENTORNO=real     El CRM que usa el equipo. ~/vocero, rama `produccion`,
#                    https://crm.knockknockcr.com. Su Caddy atiende los 80/443
#                    de todo el servidor y redirige el dominio viejo
#                    (crm-pruebas) al nuevo.
#   ENTORNO=sandbox  La copia para probar. ~/vocero-sandbox, rama
#                    feat/046-propiedades-y-tareas,
#                    https://sandbox.knockknockcr.com. La primera vez copia
#                    los datos del real y BORRA las credenciales (WhatsApp, IA,
#                    anuncios…): jamás puede escribirle a un cliente.
#                    COPIAR_DATOS=1 vuelve a copiar los datos del real (pisa lo
#                    que haya en el sandbox).
#
# Sin ENTORNO: el modo de siempre (un solo CRM en ~/vocero con DOMAIN).
#
# Qué hace: instala Docker, abre 80/443 en el firewall del sistema (las
# imágenes de Oracle traen iptables cerrado aunque la red de Oracle esté
# abierta), descarga el fork, genera el .env con secretos nuevos EN el
# servidor (jamás pasan por el chat) y construye/levanta en segundo plano.
#
# Re-ejecutable: si ya existe, actualiza el código y conserva el .env y los
# datos.
# ============================================================
set -euo pipefail

ENTORNO="${ENTORNO:-}"
REPO="${REPO:-https://github.com/cbarzuna-prog/vocero-crm.git}"
SITIOS="$HOME/vocero-sitios"

case "$ENTORNO" in
  real)
    DOMAIN="${DOMAIN:-crm.knockknockcr.com}"
    ALIAS_VIEJO="${ALIAS_VIEJO:-crm-pruebas.knockknockcr.com}"
    BRANCH="${BRANCH:-produccion}"
    DIR="${DIR:-$HOME/vocero}"
    LOG="$HOME/vocero-instalacion.log"
    ;;
  sandbox)
    DOMAIN="${DOMAIN:-sandbox.knockknockcr.com}"
    BRANCH="${BRANCH:-feat/046-propiedades-y-tareas}"
    DIR="${DIR:-$HOME/vocero-sandbox}"
    LOG="$HOME/vocero-sandbox.log"
    ;;
  "")
    DOMAIN="${DOMAIN:?Falta DOMAIN (o use ENTORNO=real / ENTORNO=sandbox)}"
    BRANCH="${BRANCH:-feat/046-propiedades-y-tareas}"
    DIR="${DIR:-$HOME/vocero}"
    LOG="$HOME/vocero-instalacion.log"
    ;;
  *)
    echo "ENTORNO debe ser «real» o «sandbox» (o vacío)." >&2
    exit 1
    ;;
esac

paso() { printf '\n==> %s\n' "$*"; }

# El dominio tiene que apuntar a ESTE servidor antes de pedirle el
# certificado a Let's Encrypt (si no, Caddy reintenta y el sitio no abre).
verificar_dns() {
  local dominio="$1" ip_servidor ip_dominio
  ip_servidor="$(curl -fsS --max-time 10 https://api.ipify.org || true)"
  ip_dominio="$(getent ahostsv4 "$dominio" | awk 'NR==1{print $1}' || true)"
  if [ -z "$ip_dominio" ]; then
    echo "ALTO: $dominio todavía no existe en el DNS."
    echo "Cree un registro A: $dominio → ${ip_servidor:-<IP de este servidor>} y vuelva a correr esto."
    exit 1
  fi
  if [ -n "$ip_servidor" ] && [ "$ip_dominio" != "$ip_servidor" ]; then
    echo "ALTO: $dominio apunta a $ip_dominio, pero este servidor es $ip_servidor."
    echo "Corrija el registro A (si usa Cloudflare, con la nube en gris) y vuelva a correr esto."
    exit 1
  fi
  echo "DNS bien: $dominio → $ip_dominio"
}

paso "1/6 Docker"
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sudo sh
  sudo usermod -aG docker "$USER" || true
else
  echo "Docker ya está instalado: $(docker --version)"
fi
command -v git >/dev/null 2>&1 || sudo apt-get install -y git

paso "2/6 Firewall del sistema y DNS"
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
[ -n "$ENTORNO" ] && verificar_dns "$DOMAIN"
if [ "$ENTORNO" = "sandbox" ] && [ ! -f "$HOME/vocero/fork/servidor/compose.knockknock.yml" ]; then
  echo "ALTO: primero instale el CRM real con ENTORNO=real (su Caddy atiende al sandbox)."
  exit 1
fi

# Fork (058): nunca pisar cambios hechos a mano en el servidor. El 27/10 un
# webhook construido aquí y nunca subido a GitHub se perdió al actualizar.
# Si hay cambios o commits locales, se respaldan y se detiene todo.
proteger_cambios_locales() {
  local dir="$1" rama="$2"
  [ -d "$dir/.git" ] || return 0
  git -C "$dir" fetch --depth 50 origin "$rama" >/dev/null 2>&1 || true
  local sucios locales
  sucios="$(git -C "$dir" status --porcelain --untracked-files=no)"
  # Commits que no están en la rama de GitHub NI en ninguna otra rama remota
  # (al pasar de la rama de pruebas a `produccion`, los commits ya subidos no
  # cuentan como «locales»).
  locales="$(git -C "$dir" log --oneline HEAD --not FETCH_HEAD --remotes 2>/dev/null || true)"
  if [ -n "$locales" ]; then
    git -C "$dir" fetch --depth 50 origin "+refs/heads/*:refs/remotes/origin/*" >/dev/null 2>&1 || true
    locales="$(git -C "$dir" log --oneline HEAD --not FETCH_HEAD --remotes 2>/dev/null || true)"
  fi
  if [ -n "$sucios" ] || [ -n "$locales" ]; then
    local stamp; stamp="$(date +%Y%m%d-%H%M%S)"
    local respaldo="$HOME/vocero-respaldo-$stamp"
    mkdir -p "$respaldo"
    git -C "$dir" diff > "$respaldo/cambios-sin-commit.patch" || true
    [ -n "$locales" ] && git -C "$dir" format-patch FETCH_HEAD..HEAD -o "$respaldo/commits" >/dev/null 2>&1 || true
    echo
    echo "ALTO: este servidor tiene cambios que no están en GitHub."
    [ -n "$sucios" ] && echo "Archivos modificados:" && echo "$sucios"
    [ -n "$locales" ] && echo "Commits locales:" && echo "$locales"
    echo "Quedaron respaldados en $respaldo"
    echo "No se actualizó nada. Súbalos a GitHub (o pídale a Claude que los revise)"
    echo "y vuelva a correr este comando. Para descartarlos a propósito: FORZAR=1."
    [ "${FORZAR:-}" = "1" ] || exit 1
  fi
}

paso "3/6 Código ($BRANCH)"
proteger_cambios_locales "$DIR" "$BRANCH"

if [ -d "$DIR/.git" ]; then
  git -C "$DIR" fetch --depth 1 origin "$BRANCH"
  git -C "$DIR" checkout -B "$BRANCH" FETCH_HEAD
else
  git clone --depth 1 -b "$BRANCH" "$REPO" "$DIR"
fi
cd "$DIR"
echo "Commit: $(git rev-parse --short HEAD)"

# Cambia (o agrega) una variable del .env sin tocar las demás.
fijar_env() {
  local k="$1" v="$2"
  if grep -q "^$k=" .env; then
    sed -i "s|^$k=.*|$k=$v|" .env
  else
    printf '%s=%s\n' "$k" "$v" >> .env
  fi
}

paso "4/6 Configuración (.env)"
if [ -f .env ]; then
  echo ".env ya existe: se conservan los secretos y los datos."
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
if [ -n "$ENTORNO" ]; then
  # 066: el dominio puede cambiar (crm-pruebas → crm) sin perder secretos.
  fijar_env APP_BASE_URL "https://$DOMAIN"
  fijar_env DOMAIN "$DOMAIN"
  fijar_env ENTORNO "$ENTORNO"
  if [ "$ENTORNO" = "sandbox" ]; then
    # El sandbox nunca tiene agente ni token de formularios del sitio.
    fijar_env BRAIN_HEALTH_URL ""
    fijar_env BRAIN_DISPATCH_URL ""
  fi
fi

if [ "$ENTORNO" = "real" ]; then
  COMPOSE=(sudo docker compose -f docker-compose.yml -f fork/servidor/compose.knockknock.yml)
  SERVICIOS=(app postgres caddy)
elif [ "$ENTORNO" = "sandbox" ]; then
  COMPOSE=(sudo docker compose -p vocero-sandbox -f docker-compose.yml -f fork/servidor/compose.sandbox.yml)
  SERVICIOS=(app postgres)
else
  COMPOSE=(sudo docker compose)
  SERVICIOS=(app postgres caddy)
fi

paso "5/6 Red y sitios"
if [ -n "$ENTORNO" ]; then
  sudo docker network inspect kk_proxy >/dev/null 2>&1 || sudo docker network create kk_proxy >/dev/null
  mkdir -p "$SITIOS"
  [ -f "$SITIOS/_vacio.caddy" ] || echo "# Sitios extra del Caddy del CRM real (066)." > "$SITIOS/_vacio.caddy"
fi
if [ "$ENTORNO" = "real" ]; then
  fijar_env SITIOS_DIR "$SITIOS"
  if [ -n "$ALIAS_VIEJO" ] && [ "$ALIAS_VIEJO" != "$DOMAIN" ]; then
    # 308 (no 301): los formularios del sitio que todavía publican al dominio
    # viejo siguen llegando con su contenido.
    cat > "$SITIOS/alias-viejo.caddy" <<EOF
$ALIAS_VIEJO {
	redir https://$DOMAIN{uri} 308
}
EOF
    echo "El dominio viejo $ALIAS_VIEJO redirige a $DOMAIN."
  fi
elif [ "$ENTORNO" = "sandbox" ]; then
  cat > "$SITIOS/sandbox.caddy" <<EOF
$DOMAIN {
	reverse_proxy kk-sandbox-app:3000 {
		flush_interval -1
	}
	encode gzip
}
EOF
  echo "El Caddy del real atiende $DOMAIN."
fi

# 066 — La copia de datos del real al sandbox, sin credenciales.
copiar_datos_del_real() {
  echo "Copiando los datos del CRM real…"
  "${COMPOSE[@]}" up -d postgres
  for _ in $(seq 1 30); do
    "${COMPOSE[@]}" exec -T postgres pg_isready -U postgres -d vocero >/dev/null 2>&1 && break
    sleep 2
  done
  "${COMPOSE[@]}" stop app >/dev/null 2>&1 || true
  "${COMPOSE[@]}" exec -T postgres psql -U postgres -d postgres -q -c "DROP DATABASE IF EXISTS vocero WITH (FORCE);" -c "CREATE DATABASE vocero;"
  (cd "$HOME/vocero" && sudo docker compose -f docker-compose.yml -f fork/servidor/compose.knockknock.yml exec -T postgres pg_dump -U postgres -d vocero --no-owner --no-privileges) \
    | "${COMPOSE[@]}" exec -T postgres psql -U postgres -d vocero -q -v ON_ERROR_STOP=1 >/dev/null
  # Sin credenciales: el sandbox no puede escribirle a nadie ni gastar la llave
  # de IA del real (además, su ENCRYPTION_KEY es otra: no podría descifrarlas).
  "${COMPOSE[@]}" exec -T postgres psql -U postgres -d vocero -q -v ON_ERROR_STOP=1 <<'SQL'
DELETE FROM meta_credentials;
DELETE FROM instagram_credentials;
DELETE FROM messenger_credentials;
DELETE FROM tiktok_credentials;
DELETE FROM zoom_credentials;
DELETE FROM google_credentials;
DELETE FROM capi_settings;
DELETE FROM ai_credentials;
DELETE FROM session;
SQL
  echo "Datos copiados. Credenciales borradas; las sesiones también (entre de nuevo con su clave de siempre)."
}

paso "6/6 Construcción y arranque (en segundo plano, ~10–15 min en ARM)"
if [ "$ENTORNO" = "sandbox" ]; then
  if [ "${COPIAR_DATOS:-}" = "1" ] || [ ! -f "$DIR/.datos-copiados" ]; then
    copiar_datos_del_real
    date -u +%FT%TZ > "$DIR/.datos-copiados"
  fi
fi
# --build siempre: es un fork con cambios propios y la imagen oficial es amd64.
# Sin `nea`: se agrega cuando se conecte el agente.
CMD="${COMPOSE[*]} up -d --build ${SERVICIOS[*]}"
if [ "$ENTORNO" = "sandbox" ]; then
  # Que el Caddy del real lea el sitio nuevo.
  CMD="$CMD && cd $HOME/vocero && sudo docker compose -f docker-compose.yml -f fork/servidor/compose.knockknock.yml exec -T caddy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile"
fi
setsid nohup bash -c "$CMD" </dev/null >"$LOG" 2>&1 &
echo "Construyendo… el avance queda en $LOG"
echo
echo "Listo por ahora. Puede cerrar esta ventana: la construcción sigue sola."
echo "Cuando termine, https://$DOMAIN/api/health responderá {\"ok\":true,…}."
