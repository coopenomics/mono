# Стол образования — документация разработчика

Приложение подключает к кооперативу онлайн-школы на площадках Skillspace и GetCourse. Обучение идёт по целевой потребительской программе «Образование».

Текст страницы в каталоге приложений — `CATALOG.md`: его читают председатель и совет, технических подробностей в нём нет. Этот файл — для разработчика.

## Запись реестра

Запись — в `components/controller/src/extensions/extensions.registry.ts`. Что значит каждое поле — корневой `components/controller/CLAUDE.md`, раздел «Что расширение объявляет о себе».

### `edubridge` — Стол образования

- Доступность в сети: везде.
- Ставит председатель из каталога приложений (`defaults` в записи реестра нет).
- Модуль: `EdubridgeExtensionModule` — `edubridge/edubridge-extension.module.ts`.
- Рабочие столы: `edubridge` («Стол администратора»), `edubridge-member` («Стол ученика»), `edubridge-teacher` («Стол преподавателя»).
- Поля настроек (`Schema` модуля): `coopAcceptance`, `connectors`, `outbox_interval_sec`, `capital_integration`, `markup_percent`, `skillspace_api_base`, `getcourse_api_base`.
- Миграции схемы базы: 23; миграции настроек: 0.
- Обязательные порты: `Account`, `RoleAssignments`, `Chain`, `Council`, `DocumentDeclaration`, `Document`, `DesktopGrantsFilterRegistry`, `DesktopGrantsRegistry`, `ExpenseChassis`, `ExtensionConfig`, `FileStorage`, `GlobalSearchRegistry`, `Ledger2History`, `Logger`, `MemberExitRegistry`, `Notification`, `OnboardingStepRegistry`, `ProgramAgreement`, `RegistrationDocumentParametersRegistry`, `RegistrationOfferFilterRegistry`, `SecretCipher`, `UserAvatar`, `UserCertificate`, `UserData`, `UserDirectory`, `UserWallet`, `WalletWithdraw`, `Payment`, `Vault`.
- Необязательные порты: `RegistrationRegistry`, `ChairmanApprovals`, `ChainChanges`.

## Где что лежит

- Сервер: `components/controller/src/extensions/edubridge/`. Подкаталоги: `application/`, `constants/`, `domain/`, `i18n/`, `infrastructure/`, `migrations/`.
- Файлы верхнего уровня: `edubridge-extension.module.ts`, `edubridge.database-migrations.ts`, `edubridge.ports.ts`, `types.ts`.
- Стол: `components/desktop/extensions/edubridge/` — маршруты и пункты меню в `install.ts`, тексты в `i18n/ru.json`.
- Таблицы базы (создают миграции расширения): `edubridge_access_tasks`, `edubridge_admins`, `edubridge_connector_bindings`, `edubridge_contributions`, `edubridge_courses`, `edubridge_enrollments`, `edubridge_groups`, `edubridge_guarantee_claims`, `edubridge_learners`, `edubridge_lessons`, `edubridge_levels`, `edubridge_return_requests`, `edubridge_sections`, `edubridge_share_returns`, `edubridge_teacher_assignments`, `edubridge_teacher_contracts`, `edubridge_teacher_profiles`.
- Порты и их владельцы — `components/innercoop/PORTS.md`.
