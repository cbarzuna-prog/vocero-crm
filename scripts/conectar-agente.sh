#!/usr/bin/env bash
# Fork Knock Knock — Conecta el agente Nea al CRM en el servidor.
#
#   ssh -i ~/.ssh/<llave> ubuntu@<IP> \
#     "curl -fsSL https://raw.githubusercontent.com/cbarzuna-prog/vocero-crm/feat/046-propiedades-y-tareas/scripts/conectar-agente.sh | bash"
#
# Qué hace: quita del .env los BRAIN_* vacíos (que dejaban el CRM como bandeja
# manual), así el CRM despacha a http://nea:8000; se asegura de que haya
# BOT_API_KEY; construye Nea desde el código (ARM) y reinicia el CRM para que
# lea el entorno. Re-ejecutable. El agente queda APAGADO: se enciende en la
# pantalla Agente cuando Ajustes → IA tenga llave.
set -euo pipefail
DIR="${DIR:-$HOME/vocero}"
BRANCH="${BRANCH:-feat/046-propiedades-y-tareas}"
LOG="$DIR/conectar-agente.log"
cd "$DIR"

echo "== 1/3 Actualizando el código"
git fetch -q --depth 1 origin "$BRANCH"
git checkout -q -B "$BRANCH" FETCH_HEAD
echo "   Commit: $(git rev-parse --short HEAD)"

echo "== 2/3 Ajustando .env"
cp .env ".env.respaldo-$(date +%Y%m%d-%H%M%S)"
sed -i '/^BRAIN_DISPATCH_URL=\s*$/d; /^BRAIN_HEALTH_URL=\s*$/d' .env
if ! grep -q '^BOT_API_KEY=.\+' .env; then
  sed -i '/^BOT_API_KEY=/d' .env
  echo "BOT_API_KEY=$(openssl rand -hex 32)" >> .env
fi
echo "   BRAIN_* vacíos quitados; el CRM despachará a http://nea:8000"

echo "== 3/3 Construyendo Nea y reiniciando el CRM (en segundo plano, ~5 min)"
setsid nohup bash -c "sudo docker compose build nea && sudo docker compose up -d --no-build nea && sudo docker compose up -d --no-build --force-recreate app && echo LISTO" </dev/null >"$LOG" 2>&1 &
echo "El avance queda en $LOG. Cuando diga LISTO, entre a Agente en el CRM."
