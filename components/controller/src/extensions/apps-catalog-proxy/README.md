# Стол разработчика — документация разработчика

Стол для разработчиков, которые создают приложения для кооперативов платформы.

Текст страницы в каталоге приложений — `CATALOG.md`: его читают председатель и совет, технических подробностей в нём нет. Этот файл — для разработчика.

## Запись реестра

Запись — в `components/controller/src/extensions/extensions.registry.ts`. Что значит каждое поле — корневой `components/controller/CLAUDE.md`, раздел «Что расширение объявляет о себе».

### `developer` — Стол разработчика

- Доступность в сети: только на контуре разработки.
- Ставит председатель из каталога приложений (`defaults` в записи реестра нет).
- Модуль: `AppsCatalogProxyModule` — `apps-catalog-proxy/apps-catalog-proxy.module.ts`.
- Рабочие столы: `developer` («Стол разработчика»), `publisher` («Мои приложения»).
- Настроек нет: схема пустая.
- Миграции схемы базы: 1; миграции настроек: 0.
- Обязательные порты: `DesktopGrantsRegistry`, `Logger`.

## Где что лежит

- Сервер: `components/controller/src/extensions/apps-catalog-proxy/`. Подкаталоги: `application/`, `i18n/`, `infrastructure/`, `migrations/`.
- Файлы верхнего уровня: `apps-catalog-proxy.database-migrations.ts`, `apps-catalog-proxy.module.ts`, `apps-catalog-proxy.ports.ts`, `apps-catalog-proxy.tables.ts`, `developer-extension.ts`.
- Стол: `components/desktop/extensions/developer/` — маршруты и пункты меню в `install.ts`, тексты в `i18n/ru.json`.
- Стол: `components/desktop/extensions/publisher/` — маршруты и пункты меню в `install.ts`, тексты в `i18n/ru.json`.
- Таблицы базы (создают миграции расширения): `apps_publishers`.
- Порты и их владельцы — `components/innercoop/PORTS.md`.
