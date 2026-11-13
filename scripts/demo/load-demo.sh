#!/bin/sh
# Demo deployments only: loads the pipeline cleanup demo data once when
# DEMO_SEED=true (scripts/demo/pipeline-cleanup-demo.sql skips itself if
# already loaded). Never set DEMO_SEED on production.
if [ "$DEMO_SEED" = "true" ]; then
  ./node_modules/.bin/prisma db execute --url "$DATABASE_URL" --file scripts/demo/pipeline-cleanup-demo.sql \
    && echo "[demo] pipeline cleanup demo data checked" \
    || echo "[demo] could not load demo data (continuing)"
fi
