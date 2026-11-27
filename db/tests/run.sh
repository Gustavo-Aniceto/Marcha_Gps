#!/usr/bin/env bash
# Sobe um Postgres temporário, aplica as migrations e roda os testes.
# Uso: ./db/tests/run.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
export PATH="$PGBIN:$PATH"
WORK="$(mktemp -d)"
PORT="${PGPORT_TEST:-54329}"
AS=""
if [ "$(id -u)" = "0" ]; then
  id postgres >/dev/null 2>&1 || useradd -r postgres
  chown postgres "$WORK"; AS="runuser -u postgres --"
fi
cleanup() { $AS pg_ctl -D "$WORK/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$WORK"; }
trap cleanup EXIT

$AS initdb -D "$WORK/data" -U postgres --auth=trust -E UTF8 --locale=C.UTF-8 >/dev/null
$AS pg_ctl -D "$WORK/data" -o "-p $PORT -k $WORK -c listen_addresses=''" -l "$WORK/log" -w start >/dev/null
PSQL=(psql -h "$WORK" -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q -X)

"${PSQL[@]}" -f "$ROOT/db/tests/00_auth_stub.sql"
for f in "$ROOT"/db/migrations/*.sql; do
  echo "migration: $(basename "$f")"
  "${PSQL[@]}" -f "$f"
done
fail=0
for t in "$ROOT"/db/tests/[1-9]*.sql; do
  if "${PSQL[@]}" -o /dev/null -f "$t"; then echo "ok    $(basename "$t")"; else echo "FALHOU $(basename "$t")"; fail=1; fi
done
# carga do script de importação (fixtures), rodada duas vezes pra garantir que não duplica
if command -v python3 >/dev/null; then
  python3 "$ROOT/scripts/import_obstacles.py" --osm-json "$ROOT/scripts/fixtures/osm_guarulhos.json" \
    --cidade Guarulhos --antt "$ROOT/scripts/fixtures/antt_radares.csv" \
    --out "$WORK/o.geojson" --sql "$WORK/carga.sql" >/dev/null
  chmod a+r "$WORK/carga.sql"
  if "${PSQL[@]}" -o /dev/null -f "$WORK/carga.sql" && "${PSQL[@]}" -o /dev/null -f "$WORK/carga.sql" \
     && "${PSQL[@]}" -o /dev/null -c "select t.ok((select count(*) from public.reports where source in ('osm','antt')) = 6, 'importação: 6 pontos, sem duplicar')"; then
    echo "ok    importação (scripts/import_obstacles.py)"
  else
    echo "FALHOU importação"; fail=1
  fi
fi
exit $fail
