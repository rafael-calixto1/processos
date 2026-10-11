#!/usr/bin/env bash
# Backup das fotos de OS enviadas pelo app (pasta privada storage/os_fotos, ou FOTOS_DIR).
# Uso:   scripts/backup_os_fotos.sh [pasta-de-destino] [quantas-copias-guardar]
# Padrão: destino /root/backups/os_fotos, guarda as 14 últimas. Não apaga nem altera a pasta de origem.
# Para rodar todo dia às 3h (instalar só com autorização):  0 3 * * * /caminho/scripts/backup_os_fotos.sh >> /var/log/backup_os_fotos.log 2>&1
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ORIGEM="${FOTOS_DIR:-$RAIZ/storage/os_fotos}"
DESTINO="${1:-/root/backups/os_fotos}"
GUARDAR="${2:-14}"

case "$GUARDAR" in ''|*[!0-9]*) echo "Quantidade de cópias inválida: '$GUARDAR'" >&2; exit 2;; esac
[ "$GUARDAR" -ge 1 ] || { echo "Guarde ao menos 1 cópia." >&2; exit 2; }

if [ ! -d "$ORIGEM" ]; then
  echo "Pasta de fotos ainda não existe ($ORIGEM): nada a copiar."
  exit 0
fi
if [ -z "$(ls -A "$ORIGEM")" ]; then
  echo "Pasta de fotos vazia ($ORIGEM): nada a copiar."
  exit 0
fi

mkdir -p "$DESTINO"
ARQUIVO="$DESTINO/os_fotos_$(date +%Y-%m-%d_%H%M%S).tar.gz"
TEMP="$ARQUIVO.parcial"
trap 'rm -f "$TEMP"' EXIT

# -C: o arquivo guarda caminhos relativos (restaura em qualquer lugar). Escreve num .parcial e só renomeia no fim: um backup interrompido nunca parece completo.
tar -czf "$TEMP" -C "$ORIGEM" .
tar -tzf "$TEMP" > /dev/null   # confere que o arquivo gerado é legível
mv "$TEMP" "$ARQUIVO"
trap - EXIT

# rotação: mantém só as mais recentes (nome tem data e hora, então a ordem alfabética é a cronológica)
ls -1 "$DESTINO"/os_fotos_*.tar.gz 2>/dev/null | sort | head -n -"$GUARDAR" | while read -r velho; do rm -f -- "$velho"; done

echo "Backup criado: $ARQUIVO ($(du -h "$ARQUIVO" | cut -f1)); guardadas $(ls -1 "$DESTINO"/os_fotos_*.tar.gz | wc -l) cópia(s) em $DESTINO"
