# Стол связи — документация разработчика

Переписка и звонки участников кооперативной экономики.

Текст страницы в каталоге приложений — `CATALOG.md`: его читают председатель и совет, технических подробностей в нём нет. Этот файл — для разработчика.

## Запись реестра

Запись — в `components/controller/src/extensions/extensions.registry.ts`. Что значит каждое поле — корневой `components/controller/CLAUDE.md`, раздел «Что расширение объявляет о себе».

### `chatcoop` — Стол связи

- Доступность в сети: везде.
- Ставит председатель из каталога приложений (`defaults` в записи реестра нет).
- Модуль: `ChatCoopExtensionModule` — `chatcoop/chatcoop-extension.module.ts`.
- Рабочие столы: `chatcoop` («Стол связи»).
- Поля настроек (`Schema` модуля): `messageHistorySyncIntervalMinutes`.
- Миграции схемы базы: 2; миграции настроек: 4.
- Обязательные порты: `DesktopGrantsRegistry`, `Account`, `CooperativeVars`, `CoopCalendarEventNotification`, `IntegrationSettings`, `Logger`, `Notification`, `SecretCipher`, `UserDirectory`.
- Необязательные порты: `ChainChanges`, `ProjectCapitalClearance`, `ProjectCommunicationArtifacts`.

## Где что лежит

- Сервер: `components/controller/src/extensions/chatcoop/`. Подкаталоги: `application/`, `domain/`, `i18n/`, `infrastructure/`, `migrations/`, `notes/`.
- Файлы верхнего уровня: `chatcoop-extension.module.ts`, `chatcoop.database-migrations.ts`, `chatcoop.migrations.ts`, `chatcoop.ports.ts`, `chatcoop.tables.ts`.
- Стол: `components/desktop/extensions/chatcoop/` — маршруты и пункты меню в `install.ts`, тексты в `i18n/ru.json`.
- Таблицы базы (создают миграции расширения): `chatcoop_calendar_events`, `chatcoop_calendar_ics_subscriptions`, `chatcoop_call_transcriptions`, `chatcoop_managed_matrix_rooms`, `chatcoop_room_message_history`, `chatcoop_state`, `chatcoop_transcription_segments`, `matrix_tokens`, `matrix_users`, `union_chats`.
- Порты и их владельцы — `components/innercoop/PORTS.md`.
