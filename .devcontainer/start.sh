#!/usr/bin/env bash
# تشغيل الخادم في الخلفية عند كل بدء للبيئة
cd "$(dirname "$0")/.."
[ -f .next/BUILD_ID ] || npx next build
if ! curl -sf localhost:3000/api/health >/dev/null 2>&1; then
  setsid nohup npx next start -p 3000 > /tmp/qaddimha.log 2>&1 < /dev/null &
fi
for i in $(seq 1 30); do curl -sf localhost:3000/api/health >/dev/null 2>&1 && { echo "✓ قدمها يعمل على المنفذ 3000"; exit 0; }; sleep 1; done
echo "تحقق من السجل: /tmp/qaddimha.log"
