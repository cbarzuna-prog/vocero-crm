# Servidor de Knock Knock: real y sandbox (066)

Se corre desde la Terminal de la Mac. `LLAVE` = `~/.ssh/knockknock/crm-pruebas/id_ed25519`.

**Actualizar el sandbox** (después de cada cambio de Claude):

    ssh -i LLAVE ubuntu@161.153.116.135 "curl -fsSL https://raw.githubusercontent.com/cbarzuna-prog/vocero-crm/feat/046-propiedades-y-tareas/scripts/instalar-servidor.sh | ENTORNO=sandbox bash"

**Refrescar los datos del sandbox con los del real**: el mismo comando con
`ENTORNO=sandbox COPIAR_DATOS=1 bash`.

**Actualizar el real** (cuando lo probado en el sandbox está aprobado y Claude
movió `produccion`):

    ssh -i LLAVE ubuntu@161.153.116.135 "curl -fsSL https://raw.githubusercontent.com/cbarzuna-prog/vocero-crm/produccion/scripts/instalar-servidor.sh | ENTORNO=real bash"

**Ver el estado de los dos**:

    ssh -i LLAVE ubuntu@161.153.116.135 "for d in vocero vocero-sandbox; do echo \$d: \$(git -C ~/\$d log --oneline -1 2>/dev/null); done; sudo docker ps --format '{{.Names}} {{.Status}}'"
