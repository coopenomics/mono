#!/usr/bin/env bash
# Git-хук после `git pull` (post-merge) и `git checkout` (post-checkout):
# если между прежним и новым коммитом менялся pnpm-lock.yaml, ставит пакеты.
#
# Зачем (решение 15 PRD компонента 71): фабрика документов приходит из npm
# точной версией, и её обновление — это строка в package.json и lock-файле.
# Забытый `pnpm install` оставил бы стенд на старой фабрике; контроллер это
# поймает при старте, а хук не даёт до этого дойти.
#
# Отключить разово: MONO_SKIP_AUTO_INSTALL=1 git checkout …
# Хук ставит simple-git-hooks (конфиг в корневом package.json, `pnpm install`).
set -u
[ "${MONO_SKIP_AUTO_INSTALL:-}" = "1" ] && exit 0

# post-checkout получает (прежний, новый, флаг ветки); post-merge — ничего.
prev="${1:-}"
next="${2:-}"
if [ -z "$prev" ] || [ -z "$next" ]; then
  prev=$(git rev-parse -q --verify 'HEAD@{1}' 2>/dev/null || git rev-parse -q --verify ORIG_HEAD 2>/dev/null || true)
  next=$(git rev-parse HEAD)
fi
[ -z "$prev" ] && exit 0
[ "$prev" = "$next" ] && exit 0

if git diff --name-only "$prev" "$next" -- pnpm-lock.yaml 2>/dev/null | grep -q .; then
  echo "▸ pnpm-lock.yaml изменился — pnpm install (отключить: MONO_SKIP_AUTO_INSTALL=1)"
  pnpm install --frozen-lockfile || echo "⚠ pnpm install не прошёл — выполните его вручную, иначе контроллер не стартует на прежних пакетах"
fi
exit 0
