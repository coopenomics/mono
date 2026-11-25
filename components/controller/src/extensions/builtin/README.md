# Стол Совета, Стол кассира — документация разработчика

Модуль `builtin` обслуживает встроенные столы без собственной серверной логики: «Стол Совета» и «Стол кассира». Сервер у них общий и пустой — экраны живут на столе, данные берутся из ядра.

Текст страницы в каталоге приложений — `CATALOG.md`: его читают председатель и совет, технических подробностей в нём нет. Этот файл — для разработчика.

## Запись реестра

Запись — в `components/controller/src/extensions/extensions.registry.ts`. Что значит каждое поле — корневой `components/controller/CLAUDE.md`, раздел «Что расширение объявляет о себе».

### `soviet` — Стол Совета

- Доступность в сети: везде.
- Ставится новому кооперативу сразу, включённым (`defaults` в записи реестра).
- Модуль: `BuiltinExtensionModule` — `builtin/builtin-extension.module.ts`.
- Рабочие столы: `soviet` («Стол Совета»).
- Настроек нет: схема пустая.
- Миграции схемы базы: 0; миграции настроек: 0.
- Обязательные порты: `Logger`.

### `cashier` — Стол кассира

- Доступность в сети: везде.
- Ставится новому кооперативу сразу, включённым (`defaults` в записи реестра).
- Модуль: `BuiltinExtensionModule` — `builtin/builtin-extension.module.ts`.
- Рабочие столы: `cashier` («Стол кассира»).
- Настроек нет: схема пустая.
- Миграции схемы базы: 0; миграции настроек: 0.
- Обязательные порты: `Logger`.

## Где что лежит

- Сервер: `components/controller/src/extensions/builtin/`. Подкаталоги: `soviet/`.
- Файлы верхнего уровня: `builtin-extension.module.ts`, `builtin.ports.ts`.
- Стол: `components/desktop/extensions/soviet/` — маршруты и пункты меню в `install.ts`, тексты в `i18n/ru.json`.
- Стол: `components/desktop/extensions/cashier/` — маршруты и пункты меню в `install.ts`, тексты в `i18n/ru.json`.
- Стол: `components/desktop/extensions/expenses/` — маршруты и пункты меню в `install.ts`, тексты в `i18n/ru.json`.
- Порты и их владельцы — `components/innercoop/PORTS.md`.
