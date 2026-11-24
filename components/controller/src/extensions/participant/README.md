# Стол Пайщика — документация разработчика

Рабочий стол каждого пайщика кооператива. На нём пайщик видит своё членство и ведёт свои дела с кооперативом.

Текст страницы в каталоге приложений — `CATALOG.md`: его читают председатель и совет, технических подробностей в нём нет. Этот файл — для разработчика.

## Запись реестра

Запись — в `components/controller/src/extensions/extensions.registry.ts`. Что значит каждое поле — корневой `components/controller/CLAUDE.md`, раздел «Что расширение объявляет о себе».

### `participant` — Стол Пайщика

- Доступность в сети: везде.
- Ставится новому кооперативу сразу, включённым (`defaults` в записи реестра).
- Модуль: `ParticipantExtensionModule` — `participant/participant-extension.module.ts`.
- Рабочие столы: `participant` («Стол Пайщика»).
- Поля настроек (`Schema` модуля): `checkIntervalMinutes`, `lastCheckTimestamp`, `trackedMeets`, `minutesBeforeStartNotification`, `minutesBeforeEndNotification`, `closedMeetIds`.
- Миграции схемы базы: 0; миграции настроек: 0.
- Обязательные порты: `Account`, `Logger`, `Meet`, `Notification`.

## Где что лежит

- Сервер: `components/controller/src/extensions/participant/`. Подкаталоги: `i18n/`, `utils/`.
- Файлы верхнего уровня: `meet-tracker.service.ts`, `meet-workflow-notification.service.ts`, `notification-sender.service.ts`, `participant-extension.module.ts`, `participant.ports.ts`, `types.ts`.
- Стол: `components/desktop/extensions/participant/` — маршруты и пункты меню в `install.ts`, тексты в `i18n/ru.json`.
- Порты и их владельцы — `components/innercoop/PORTS.md`.

## Технические детали

Расширение использует систему cron-задач для периодической проверки наличия новых собраний. Данные об отслеживаемых собраниях хранятся в конфигурации расширения.

## Конфигурация

В настройках расширения можно задать:

- Интервал проверки наличия новых собраний (в минутах)
- Тему email-уведомлений
- Базовый URL для перехода по ссылкам из уведомлений
