# Стол Председателя — документация разработчика

Рабочий стол председателя кооператива. На нём председатель готовит кооператив к работе на платформе, настраивает приложения и доступ пайщиков.

Текст страницы в каталоге приложений — `CATALOG.md`: его читают председатель и совет, технических подробностей в нём нет. Этот файл — для разработчика.

## Запись реестра

Запись — в `components/controller/src/extensions/extensions.registry.ts`. Что значит каждое поле — корневой `components/controller/CLAUDE.md`, раздел «Что расширение объявляет о себе».

### `chairman` — Стол Председателя

- Доступность в сети: везде.
- Ставится новому кооперативу сразу, включённым (`defaults` в записи реестра).
- Модуль: `ChairmanExtensionModule` — `chairman/chairman-extension.module.ts`.
- Рабочие столы: `chairman` («Стол Председателя»).
- Поля настроек (`Schema` модуля): `checkInterval`, `lastCheckDate`, `onboarding_init_at`, `onboarding_expire_at`, `onboarding_wallet_agreement_done`, `onboarding_wallet_agreement_hash`, `onboarding_signature_agreement_done`, `onboarding_signature_agreement_hash`, `onboarding_privacy_agreement_done`, `onboarding_privacy_agreement_hash`, `onboarding_user_agreement_done`, `onboarding_user_agreement_hash`, `onboarding_participant_application_done`, `onboarding_participant_application_hash`, `onboarding_voskhod_membership_done`, `onboarding_voskhod_membership_hash`, `onboarding_general_meet_done`, `onboarding_general_meet_hash`.
- Миграции схемы базы: 1; миграции настроек: 0.
- Обязательные порты: `Account`, `Chain`, `CooperativeVars`, `Council`, `DecisionTracking`, `DesktopGrantsRegistry`, `DocumentApproval`, `Document`, `FreeDecision`, `Logger`, `Meet`, `Notification`, `OnboardingStepRegistry`, `Vault`.
- Необязательные порты: `ChainDeltaWait`, `ChainChanges`.

## Где что лежит

- Сервер: `components/controller/src/extensions/chairman/`. Подкаталоги: `application/`, `domain/`, `i18n/`, `infrastructure/`, `migrations/`.
- Файлы верхнего уровня: `chairman-extension.module.ts`, `chairman.database-migrations.ts`, `chairman.ports.ts`, `index.ts`.
- Стол: `components/desktop/extensions/chairman/` — маршруты и пункты меню в `install.ts`, тексты в `i18n/ru.json`.
- Таблицы базы (создают миграции расширения): `chairman_approvals`.
- Порты и их владельцы — `components/innercoop/PORTS.md`.
