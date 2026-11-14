#!/usr/bin/env bash
# Hiyou — mide un modelo de IA local en este servidor SIN tocar el CRM:
# corre en un contenedor aparte, con memoria y CPU limitadas, y al final se borra.
#   curl -fsSL https://raw.githubusercontent.com/cbarzuna-prog/vocero-crm/feat/046-propiedades-y-tareas/fork/servidor/medir-llm.sh | bash
set -euo pipefail
MODELOS="${MODELOS:-qwen2.5:1.5b qwen2.5:3b}"
echo "== La máquina"; echo "Arquitectura: $(uname -m) · Núcleos: $(nproc)"; free -h | sed -n 1,2p
echo "== Arrancando la prueba (máx. 6 GB y 3 núcleos)"
docker rm -f prueba-llm >/dev/null 2>&1 || true
docker run -d --name prueba-llm --memory 6g --cpus 3 -v prueba-llm:/root/.ollama ollama/ollama >/dev/null
trap 'echo "== Limpiando"; docker rm -f prueba-llm >/dev/null 2>&1; docker volume rm prueba-llm >/dev/null 2>&1; echo "Listo: no quedó nada instalado."' EXIT
sleep 5
PROMPT='Extraiga en JSON los datos del cliente (servicio, profesional, horario). Cliente: "Mae, ¿tienen campo el sábado en la tarde para corte y barba con Luis?"'
for m in $MODELOS; do
  echo "== $m: descargando"; docker exec prueba-llm ollama pull "$m" >/dev/null
  echo "== $m: midiendo (3 veces)"
  for i in 1 2 3; do docker exec prueba-llm ollama run "$m" --verbose "$PROMPT" 2>&1 | grep -E "^(eval rate|prompt eval rate|total duration)"; done
  docker stats --no-stream --format "Memoria usada: {{.MemUsage}}" prueba-llm
done
echo "== Copie todo lo de arriba y péguelo en el chat."
