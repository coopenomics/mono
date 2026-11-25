# 🔔 @coopenomics/notifications

> Типобезопасная библиотека workflow-уведомлений для платформы Novu

## Описание

`@coopenomics/notifications` — библиотека для создания и управления workflow уведомлений кооператива. Построена на Zod-схемах и паттерне Builder, обеспечивая полную типобезопасность payload каждого уведомления. Поддерживает множество каналов доставки и ролевую маршрутизацию через систему тегов.

Интегрируется с платформой [Novu](https://novu.co) для оркестрации и доставки уведомлений.

## Возможности

- **21 workflow** — покрытие всех ключевых бизнес-процессов кооператива
- **Типобезопасность** — Zod-схемы для валидации payload каждого workflow
- **Многоканальность** — Email (HTML), In-App, Push, SMS, Chat
- **Ролевая маршрутизация** — теги для направления уведомлений по ролям (председатель, член совета, пайщик)
- **Паттерн Builder** — удобное декларативное создание новых workflow через `WorkflowBuilder`
- **Синхронизация** — автоматическая синхронизация workflow с платформой Novu

## Workflow

| Workflow | Описание |
|----------|----------|
| `welcome` | Приветствие нового участника |
| `approval-request` | Запрос на утверждение (совету) |
| `approval-response` | Ответ на запрос утверждения |
| `decision-approved` | Решение утверждено |
| `decision-expired` | Решение просрочено |
| `payment-paid` | Платёж выполнен |
| `payment-cancelled` | Платёж отменён |
| `new-initial-payment-request` | Запрос начального взноса |
| `new-deposit-payment-request` | Запрос депозитного взноса |
| `incoming-transfer` | Входящий перевод |
| `new-agenda-item` | Новый пункт повестки |
| `meet-initial` | Инициация собрания |
| `meet-reminder-start` | Напоминание о начале собрания |
| `meet-started` | Собрание началось |
| `meet-reminder-end` | Напоминание об окончании собрания |
| `meet-restart` | Перезапуск собрания |
| `meet-ended` | Собрание завершено |
| `invite` | Приглашение в кооператив |
| `reset-key` | Сброс ключа доступа |
| `email-verification` | Подтверждение электронной почты |
| `server-provisioned` | Сервер подготовлен |

## Установка

```bash
pnpm install --filter @coopenomics/notifications
```

## Скрипты

| Скрипт | Описание |
|--------|----------|
| `pnpm run build` | Сборка библиотеки (`unbuild`) |
| `pnpm run dev` | Режим разработки с отслеживанием изменений (`unbuild --watch`) |
| `pnpm run test` | Запуск тестов (`vitest`) |
| `pnpm run sync` | Синхронизация workflow с платформой Novu |
| `pnpm run sync:dev` | Синхронизация в dev-режиме |

> Все скрипты запускаются из корня монорепозитория через фильтр: `pnpm --filter @coopenomics/notifications run <скрипт>`

## Конфигурация

Для синхронизации с Novu необходим API-ключ. Подробности о настройке — в [документации Novu](https://docs.novu.co).

## Архитектура

```
src/
├── types/                     # Базовые типы и интерфейсы
│   └── index.ts               # ChannelConfig, WorkflowStep, WorkflowDefinition
├── base/                      # Ядро библиотеки
│   ├── defaults.ts            # Настройки по умолчанию для каналов
│   └── workflow-builder.ts    # Паттерн Builder для создания workflow
├── utils/                     # Вспомогательные утилиты
│   └── index.ts
├── workflows/                 # Определения workflow (21 директория)
│   ├── welcome/               # Приветствие
│   ├── approval-request/      # Запрос утверждения
│   ├── approval-response/     # Ответ на утверждение
│   ├── decision-approved/     # Решение утверждено
│   ├── decision-expired/      # Решение просрочено
│   ├── payment-paid/          # Платёж выполнен
│   ├── payment-cancelled/     # Платёж отменён
│   ├── meet-initial/          # Инициация собрания
│   ├── meet-started/          # Собрание началось
│   ├── meet-ended/            # Собрание завершено
│   ├── meet-reminder-start/   # Напоминание о начале
│   ├── meet-reminder-end/     # Напоминание об окончании
│   ├── meet-restart/          # Перезапуск собрания
│   ├── invite/                # Приглашение
│   ├── reset-key/             # Сброс ключа
│   ├── email-verification/    # Подтверждение email
│   ├── incoming-transfer/     # Входящий перевод
│   ├── new-agenda-item/       # Пункт повестки
│   ├── new-initial-payment-request/   # Запрос начального взноса
│   ├── new-deposit-payment-request/   # Запрос депозитного взноса
│   └── server-provisioned/    # Сервер подготовлен
├── sync/                      # Синхронизация с Novu
│   ├── novu-sync.service.ts   # Сервис синхронизации
│   └── sync-runner.ts         # Точка входа для sync-скриптов
└── index.ts                   # Главная точка входа
```

Каждый workflow экспортирует определение типа `WorkflowDefinition` с Zod-схемой payload, настройками каналов и шаблонами сообщений. Все workflow автоматически регистрируются через массив `allWorkflows` и доступны по идентификатору через `workflowsById`.

## Тестирование

```bash
pnpm --filter @coopenomics/notifications run test
```

Проект содержит 7 smoke-тестов на `vitest`, проверяющих корректность определений workflow и Zod-схем.

## Лицензия

[MIT](../../LICENSE) — условия лицензий репозитория приведены в файле `LICENSE` в корне.
