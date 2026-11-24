# Стол бухгалтера — документация разработчика

Рабочий стол бухгалтера кооператива. Приложение ведёт двойную бухгалтерию по операциям кооператива на платформе и готовит налоговую отчётность.

Текст страницы в каталоге приложений — `CATALOG.md`: его читают председатель и совет, технических подробностей в нём нет. Этот файл — для разработчика.

## Запись реестра

Запись — в `components/controller/src/extensions/extensions.registry.ts`. Что значит каждое поле — корневой `components/controller/CLAUDE.md`, раздел «Что расширение объявляет о себе».

### `reports` — Стол бухгалтера

- Доступность в сети: везде.
- Ставится новому кооперативу сразу, включённым (`defaults` в записи реестра).
- Модуль: `ReportsExtensionModule` — `reports/reports-extension.module.ts`.
- Рабочие столы: `reports` («Стол бухгалтера»).
- Настроек нет: схема пустая.
- Миграции схемы базы: 1; миграции настроек: 0.
- Обязательные порты: `DesktopGrantsRegistry`, `Account`, `Individual`, `Ledger2History`, `Logger`, `Organization`, `Chain`, `PaymentDesk`, `Vault`, `AccountingRegistry`, `ProgramWallet`, `RoleAssignments`.
- Необязательные порты: `ChainChanges`.

## Где что лежит

- Сервер: `components/controller/src/extensions/reports/`. Подкаталоги: `application/`, `domain/`, `i18n/`, `infrastructure/`, `migrations/`, `schemas/`.
- Файлы верхнего уровня: `reports-extension.module.ts`, `reports.database-migrations.ts`, `reports.ports.ts`, `reports.tables.ts`.
- Стол: `components/desktop/extensions/reports/` — маршруты и пункты меню в `install.ts`, тексты в `i18n/ru.json`.
- Таблицы базы (создают миграции расширения): `balance_corrections`, `generated_reports`, `report_drafts`, `report_requisites`, `report_submission_marks`.
- Порты и их владельцы — `components/innercoop/PORTS.md`.
