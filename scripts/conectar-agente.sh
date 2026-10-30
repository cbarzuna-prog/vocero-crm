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

# Fork (058): nunca pisar cambios hechos a mano en el servidor. El 27/10 un
# webhook construido aquí y nunca subido a GitHub se perdió al actualizar.
# Si hay cambios o commits locales, se respaldan y se detiene todo.
proteger_cambios_locales() {
  local dir="$1" rama="$2"
  [ -d "$dir/.git" ] || return 0
  git -C "$dir" fetch --depth 50 origin "$rama" >/dev/null 2>&1 || true
  local sucios locales
  sucios="$(git -C "$dir" status --porcelain --untracked-files=no)"
  locales="$(git -C "$dir" log --oneline FETCH_HEAD..HEAD 2>/dev/null || true)"
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

echo "== 1/3 Actualizando el código"
proteger_cambios_locales "$DIR" "$BRANCH"

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
