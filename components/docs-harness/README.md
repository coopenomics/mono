# docs-harness

Сценарии Playwright, которые ходят по реальному desktop UI и собирают скриншоты для документации. Один сценарий = один раздел инструкции.

## Конвенции

- **Скриншоты** всегда 1400×1000 px (viewport 1120×800 CSS-px × `deviceScaleFactor: 1.25`). Параметры в `lib/harness.mjs`, менять нельзя — иначе в документации будут прыгать размеры.
- **Тестовые пайщики** только с человеческими именами. Фикстуры в `state/participants/<username>.json`; username/email/WIF не меняются между прогонами.

## Запуск одного сценария

Перед прогоном должны быть подняты:
- блокчейн (`node` контейнер) — отдаёт chain info на `http://127.0.0.1:8888`
- индексатор цепи (`parser2`)
- controller (`coopback`) — `http://127.0.0.1:2998`
- desktop dev-сервер — `http://127.0.0.1:2999`

```bash
cd docs-harness
node run.mjs auth/signin                                 # 1. прогон → shots/auth/signin/*.png + manifest.json
node lib/render-md.mjs shots/auth/signin/manifest.json   # 2. черновик MD (только если draft.md ещё нет;
                                                         #    --force перегенерирует скелет)
# 3. пишешь прозу с admonitions в shots/auth/signin/draft.md руками
node lib/install.mjs auth/signin                         # 4. PNG+MD → ../components/docs/docs/
                                                         #    (--md чтобы принудительно перелить draft.md
                                                         #    поверх существующего; --docs-root=<path>
                                                         #    для другого клона)
```

## Контур сборки документации (end-to-end)

```
scenario.mjs ──run.mjs──► shots/<s>/*.png + manifest.json
                            │
                            ▼
             (ты дописываешь прозу в shots/<s>/draft.md)
                            │
                            ▼
              ──install.mjs──► components/docs/docs/
                                 ├── assets/new/<s>/*.png
                                 └── new/<s>/index.md

       ┌─────────────────────────────┘
       ▼
   mkdocs.yml: nav: …                 (один раз на новый раздел — руками)
       │
       ▼
   mkdocs build / mkdocs serve
       │
       ▼
   site/  ← готовая статика (MkDocs сам копирует всё из docs/, включая assets/)
```

Полный пример сборки на сервере:
```bash
python3 -m venv /tmp/mkdocs-venv
/tmp/mkdocs-venv/bin/pip install mkdocs-material mkdocs-macros-plugin mkdocs-section-index 'pymdown-extensions>10'
cd components/docs
/tmp/mkdocs-venv/bin/mkdocs serve          # http://127.0.0.1:8000 с live reload
# или
/tmp/mkdocs-venv/bin/mkdocs build          # site/ — статика для gh-pages
```

MkDocs **сам** переносит всё из `docs/` в `site/` (включая `assets/`), специально конфигурить копирование изображений не надо — абсолютные пути `/assets/new/…/*.png` в MD работают без доп. настроек.

## Прогон в CI (workflow `ui-docs`)

Сюита приложения гоняется на GitHub Actions без локального стенда: пуш в ветку
`ci/ui-docs-<приложение>` либо кнопка workflow_dispatch с выбором приложения.
Стенд поднимает `scripts/blackbox/stack.sh` (фазы до `app`, затем `desktop` —
собранный SSR рабочий стол на :2999, `browser` — chromium, `ui <приложение>` —
раннер сюиты, `uidiff` — сравнение кадров с документацией, `uisummary`).

Выход прогона — артефакт `ui-docs-<приложение>-<run_id>`: каталог `shots/`
целиком. Скачать на стенд и работать как после локального прогона:

```bash
pnpm docs:pull --app=marketplace             # последний завершённый прогон ветки
pnpm docs:pull --app=marketplace --run=<id>  # конкретный
pnpm docs:diff --app=marketplace             # shots/_suite/diff.md: что разошлось с docs
node lib/install.mjs <сценарий> [--md]       # кадры (и проза) в components/docs/docs
```

`bin/diff-shots.mjs` сравнивает свежие кадры с `components/docs/docs/<assetsDir>`
попиксельно и перечисляет: красные сценарии, изменившиеся кадры (доля пикселей
и страница), новые кадры и кадры документации, которых сценарий больше не
снимает. Это список для вычитки прозы — читать все кадры подряд не нужно.

Новое приложение заводится в трёх местах: раннер `bin/run-<приложение>-all.mjs`
(группы сценариев поверх общего `lib/suite.mjs`; образцы — `run-marketplace-all.mjs`,
`run-edubridge-all.mjs`), ветка `case` в `cmd_ui` в `stack.sh`, список `options`
у `workflow_dispatch` в `.github/workflows/ui-docs.yaml`. Стенд готовят фазы
засева: Стол заказов — `components/boot/src/scripts/seed-marketplace`,
«Образование» — `components/api-tests/src/seed/edubridge` (на помощниках
внешнего слоя тестов); какая команда у какой группы — `lib/prepare.mjs`.

## Как добавить новый сценарий

1. Создать `scenarios/<раздел>/<имя>.mjs`:
   ```js
   export const meta = {
     title: 'Название',
     docPath: 'new/<раздел>/<имя>.md',
     assetsDir: 'assets/new/<раздел>/<имя>',
     role: 'chairman',   // или 'participant'
   };
   export default async ({ page, shot, expect, env }) => {
     // ...
     await shot(page, '01-что-то', 'Человекочитаемое описание шага');
   };
   ```
2. `shot(name, description)` — имя попадает в PNG и в `manifest.json`, description — в alt-текст MD.
3. Ассерты: импорт не нужен, `expect` прокидывается в контекст сценария.

## Файлы

- `run.mjs` — запускает сценарий, пишет `shots/<scenario>/*.png` и `manifest.json`
- `lib/harness.mjs` — бутстрап playwright, общие хелперы (logInAsChairman и т.д.)
- `lib/render-md.mjs` — превращает `manifest.json` в `draft.md`
- `lib/install.mjs` — копирует PNG (и draft.md для новых доков) в docs-репозиторий
- `bin/run-marketplace-all.mjs` — сюита Стола заказов по цепочке состояния (образец раннера приложения)
- `bin/diff-shots.mjs` — сравнение кадров прогона с кадрами в docs, отчёт `shots/_suite/diff.md`
- `bin/pull-run.mjs` — скачивание артефакта прогона ui-docs с GitHub Actions в `shots/`
