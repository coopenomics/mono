# Кооперативный участок — документация разработчика

Приложение помогает пайщикам самостоятельно организовать кооперативный участок и вести его дела.

Текст страницы в каталоге приложений — `CATALOG.md`: его читают председатель и совет, технических подробностей в нём нет. Этот файл — для разработчика.

## Запись реестра

Запись — в `components/controller/src/extensions/extensions.registry.ts`. Что значит каждое поле — корневой `components/controller/CLAUDE.md`, раздел «Что расширение объявляет о себе».

### `trustee` — Кооперативный участок

- Доступность в сети: везде.
- Ставит председатель из каталога приложений (`defaults` в записи реестра нет).
- Модуль: `KuExtensionModule` — `ku/ku-extension.module.ts`.
- Рабочие столы: `trustee` («Кооперативный участок»).
- Настроек нет: схема пустая.
- Миграции схемы базы: 3; миграции настроек: 0.
- Обязательные порты: `DesktopGrantsRegistry`, `Account`, `Branch`, `Chain`, `Document`, `Individual`, `Logger`, `Notification`, `Organization`, `PaymentMethod`, `Vault`.
- Необязательные порты: `ChainChanges`.

## Где что лежит

- Сервер: `components/controller/src/extensions/ku/`. Подкаталоги: `application/`, `domain/`, `i18n/`, `infrastructure/`, `migrations/`.
- Файлы верхнего уровня: `ku-extension.module.ts`, `ku.database-migrations.ts`, `ku.ports.ts`.
- Стол: `components/desktop/extensions/ku/` — маршруты и пункты меню в `install.ts`, тексты в `i18n/ru.json`.
- Таблицы базы (создают миграции расширения): `ku_decision_questions`, `ku_decisions`, `ku_powers_of_attorney`, `ku_trust_requests`, `ku_trustee_liabilities`.
- Порты и их владельцы — `components/innercoop/PORTS.md`.

## Данные

Данные читаются из PG-проекций (`ku_decisions`, `ku_decision_questions`, `ku_trust_requests`), история сохраняется после завершения процессов в блокчейне. Действия отправляются в контракт `branch` с подписью кооператива.
