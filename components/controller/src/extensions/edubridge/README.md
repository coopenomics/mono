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
- Миграции схемы базы: 24; миграции настроек: 0.
- Обязательные порты: `Account`, `RoleAssignments`, `Chain`, `Council`, `DocumentDeclaration`, `Document`, `DesktopGrantsFilterRegistry`, `DesktopGrantsRegistry`, `ExpenseChassis`, `ExtensionConfig`, `FileStorage`, `GlobalSearchRegistry`, `Ledger2History`, `Logger`, `MemberExitRegistry`, `Notification`, `OnboardingStepRegistry`, `ProgramAgreement`, `RegistrationDocumentParametersRegistry`, `RegistrationOfferFilterRegistry`, `SecretCipher`, `UserAvatar`, `UserCertificate`, `UserData`, `UserDirectory`, `UserWallet`, `WalletWithdraw`, `Payment`, `Vault`.
- Необязательные порты: `RegistrationRegistry`, `ChairmanApprovals`, `ChainChanges`, `DecisionDeclineReason`.

## Где что лежит

- Сервер: `components/controller/src/extensions/edubridge/`. Подкаталоги: `application/`, `constants/`, `domain/`, `i18n/`, `infrastructure/`, `migrations/`.
- Файлы верхнего уровня: `edubridge-extension.module.ts`, `edubridge.database-migrations.ts`, `edubridge.ports.ts`, `types.ts`.
- Стол: `components/desktop/extensions/edubridge/` — маршруты и пункты меню в `install.ts`, тексты в `i18n/ru.json`.
- Таблицы базы (создают миграции расширения): `edubridge_access_tasks`, `edubridge_admins`, `edubridge_connector_bindings`, `edubridge_contributions`, `edubridge_courses`, `edubridge_enrollments`, `edubridge_groups`, `edubridge_guarantee_claims`, `edubridge_learners`, `edubridge_lessons`, `edubridge_levels`, `edubridge_return_requests`, `edubridge_sections`, `edubridge_share_returns`, `edubridge_teacher_assignments`, `edubridge_teacher_contracts`, `edubridge_teacher_profiles`.
- Порты и их владельцы — `components/innercoop/PORTS.md`.

## Взнос преподавателя: расчёт с участниками и расчёт с преподавателем

Два расчёта разведены (решение владельца 25.11.2026). Расчёт занятия с
участниками проходит один раз, при первом отчёте (`openlesson` →
`chargelesson` → `closecharge`), и дальше не меняется: ни отказ совета, ни
повторная подача подписки не читают и не правят. Расчёт с преподавателем живёт
записью материалов в цепи (`edurids`) и взносом в базе
(`edubridge_contributions`); пока запись жива, взнос преподавателя лежит в
резерве курса.

Состояния взноса (`EduContributionStatus`):

| Состояние | Что значит | Что дальше |
|---|---|---|
| `draft` | Отчёт подан, сумма посчитана контрактом | Преподаватель подписывает акт хранения |
| `held` | Материалы на ответственном хранении | Заявление в совет после гарантийного срока |
| `submitted` | Вопрос в повестке совета | Решение совета |
| `council_approved` → `act_signed` | Совет принял, акт подписывают стороны | Приём |
| `accepted` | Результат принят, паевой взнос зачислен | Конец |
| `returned` | Взнос не принят, материалы у преподавателя | Повторная подача без срока либо закрытие председателем |
| `closed` | Председатель закрыл расчёт без приёма | Конец |
| `declined` | Отчёт отозван расчётом (оплативших нет); взносы, отклонённые до 25.11.2026 | Новый отчёт по занятию |

Любой исход без приёма — отказ совета, истёкший срок вопроса, отказ
председателя в подписи акта, одно занятие либо взнос за гарантийный срок —
ведёт один метод сервиса: `returnForRework` (`returnrid` в цепь, взнос
`returned`). Повторная подача — `reworkContribution`: тот же взнос и тот же
`rid_hash`, сумма прежняя, документы прошлой попытки сняты; дальше прежние
шаги (`storageAct` → `holdContribution` → `statement` → `submitContribution`).
Закрытие без приёма — `closeContribution` (`recallrid`, право
`EduContribution:decide`): само и по сроку оно не происходит. Взнос на
доработке держит выход преподавателя из кооператива
(`edubridge-exit-blockers.service.ts`).

Действие контракта `refundlesson` (отмена расчёта занятия в подписках,
02.11.2026) сервер не вызывает; оно оставлено в контракте на один выпуск,
потому что контракты раскатываются раньше сервера.
