# Стол кассира — документация разработчика

Каталог хранит только тексты «Стола кассира». Сервер стола — общий модуль `builtin` (см. `../builtin/README.md`), экраны — в расширениях стола `cashier` и `expenses`.

Стол кассира собирает работу с деньгами кооператива в одном месте. Он
встроен в платформу и ставится каждому кооперативу сам.

Текст страницы в каталоге приложений — `CATALOG.md`: его читают председатель и совет, технических подробностей в нём нет. Этот файл — для разработчика.

## Запись реестра

Запись — в `components/controller/src/extensions/extensions.registry.ts`. Что значит каждое поле — корневой `components/controller/CLAUDE.md`, раздел «Что расширение объявляет о себе».

### `cashier` — Стол кассира

- Доступность в сети: везде.
- Ставится новому кооперативу сразу, включённым (`defaults` в записи реестра).
- Модуль: `BuiltinExtensionModule` — `builtin/builtin-extension.module.ts`.
- Рабочие столы: `cashier` («Стол кассира»).
- Настроек нет: схема пустая.
- Миграции схемы базы: 0; миграции настроек: 0.
- Обязательные порты: `Logger`.

## Где что лежит

- Сервер: `components/controller/src/extensions/cashier/`.
- Стол: `components/desktop/extensions/cashier/` — маршруты и пункты меню в `install.ts`, тексты в `i18n/ru.json`.
- Стол: `components/desktop/extensions/expenses/` — маршруты и пункты меню в `install.ts`, тексты в `i18n/ru.json`.
- Порты и их владельцы — `components/innercoop/PORTS.md`.
