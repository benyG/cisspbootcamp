#!/bin/sh
# Applies the Prisma migrations (Vercel build and CI).
#
# 16/11/2026: the first version of 20261116090000_card_only used
# CAST(... AS JSON), which MariaDB (production) rejects; nothing was changed,
# but Prisma recorded the migration as failed and blocks every deploy after
# it. Marking it rolled back lets the corrected SQL run. On a database where
# it is not failed (CI, or once fixed) the command errors and is ignored.
pnpm exec prisma migrate resolve --rolled-back 20261116090000_card_only >/dev/null 2>&1 || true
exec pnpm exec prisma migrate deploy
