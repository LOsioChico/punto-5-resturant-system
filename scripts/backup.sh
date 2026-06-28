#!/usr/bin/env bash
#
# Daily backup of the Supabase database (data + schema).
# Designed to run via cron. Stores backups in ./backups/ with date stamps.
# Keeps the last 30 days of backups.
#
# Usage:
#   ./scripts/backup.sh
#
# Cron example (runs daily at 3am):
#   0 3 * * * cd /Users/lange/Repos/Personal/punto-5-resturant-system && ./scripts/backup.sh >> backups/backup.log 2>&1

set -euo pipefail

cd "$(dirname "$0")/.."

BACKUP_DIR="backups"
mkdir -p "$BACKUP_DIR"

DATE=$(date +%Y%m%d_%H%M%S)
SCHEMA_FILE="$BACKUP_DIR/schema_${DATE}.sql"
DATA_FILE="$BACKUP_DIR/data_${DATE}.sql"

echo "[$(date)] Starting backup..."

# Dump schema
echo "[$(date)] Dumping schema..."
npx supabase db dump --linked --file "$SCHEMA_FILE" 2>&1

# Dump data (using copy for efficiency)
echo "[$(date)] Dumping data..."
npx supabase db dump --linked --data-only --use-copy --file "$DATA_FILE" 2>&1

# Compress
echo "[$(date)] Compressing..."
gzip -f "$SCHEMA_FILE"
gzip -f "$DATA_FILE"

echo "[$(date)] Backup complete:"
echo "  Schema: $(du -h ${SCHEMA_FILE}.gz | cut -f1)"
echo "  Data:   $(du -h ${DATA_FILE}.gz | cut -f1)"

# Clean up backups older than 30 days
echo "[$(date)] Cleaning old backups..."
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +30 -delete 2>/dev/null || true

echo "[$(date)] Done."
