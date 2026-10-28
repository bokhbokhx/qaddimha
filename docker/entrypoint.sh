#!/usr/bin/env bash
# تطبيق المهاجرات، ثم البيانات التجريبية (اختياري)، ثم تشغيل الخادم
set -euo pipefail
cd /app
npx prisma migrate deploy
if [ "${SEED_DEMO:-0}" = "1" ] && [ "${APP_ENV:-development}" != "production" ]; then
  npm run -s db:seed
fi
exec npx next start -p "${PORT:-3000}"
