#!/usr/bin/env bash
# ينشئ قاعدة بيانات مستقلة للاختبارات الشاملة من الصفر ويهيئها بالبيانات التجريبية.
# لا يمس قاعدة بيانات التطوير. يتطلب صلاحية CREATEDB لمستخدم قاعدة البيانات.
set -euo pipefail
E2E_DB_URL="${E2E_DATABASE_URL:-postgresql://qaddimha:qaddimha_dev@localhost:5432/qaddimha_e2e}"
ADMIN_URL="${E2E_DB_URL%/*}/postgres"
DB_NAME="${E2E_DB_URL##*/}"
case "$DB_NAME" in *e2e*|*test*) ;; *) echo "رفض: اسم قاعدة الاختبار يجب أن يحتوي e2e أو test" >&2; exit 1;; esac
psql "$ADMIN_URL" -q -c "DROP DATABASE IF EXISTS \"$DB_NAME\" WITH (FORCE);" -c "CREATE DATABASE \"$DB_NAME\";"
rm -rf ./storage-e2e
DATABASE_URL="$E2E_DB_URL" npx prisma migrate deploy >/dev/null
DATABASE_URL="$E2E_DB_URL" STORAGE_DIR=./storage-e2e npm run -s db:seed
