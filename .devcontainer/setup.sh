#!/usr/bin/env bash
# إعداد أول مرة: الاعتماديات، قاعدة البيانات، البيانات التجريبية، والبناء
set -euo pipefail
cd "$(dirname "$0")/.."
if ! command -v pdftotext >/dev/null; then
  (sudo -n true 2>/dev/null && SUDO=sudo || SUDO=""; $SUDO apt-get update -qq && $SUDO apt-get install -y -qq poppler-utils >/dev/null) || echo "تعذر تثبيت poppler-utils؛ سيُستخدم pdf.js لقراءة PDF"
fi
[ -f .env ] || cp .env.example .env
npm ci
for i in $(seq 1 30); do npx prisma migrate deploy && break; echo "بانتظار قاعدة البيانات…"; sleep 2; done
npm run -s db:seed
npx next build
echo "✓ الإعداد اكتمل"
