# syntax=docker/dockerfile:1
# صورة تشغيل «قدمها» — تتضمن Node وChromium (لتوليد PDF) وPoppler (لاستخراج نص PDF)
FROM mcr.microsoft.com/playwright:v1.63.0-noble

RUN apt-get update \
  && apt-get install -y --no-install-recommends poppler-utils \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json ./
# شهادة CA إضافية اختيارية (لبيئات خلف وكيل شبكة فقط): --secret id=extra_ca,src=path/to/ca.crt
RUN --mount=type=secret,id=extra_ca,required=false \
    if [ -f /run/secrets/extra_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/extra_ca; fi; npm ci

COPY . .
RUN --mount=type=secret,id=extra_ca,required=false \
    if [ -f /run/secrets/extra_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/extra_ca; fi; npx prisma generate && npx next build

ENV NODE_ENV=production \
    PORT=3000 \
    STORAGE_DIR=/data/storage
EXPOSE 3000
VOLUME ["/data"]

ENTRYPOINT ["/app/docker/entrypoint.sh"]
