# Цифровой Кооператив

<!-- badges -->
![License](https://img.shields.io/badge/license-BY--NC--SA%204.0-blue)
![Node](https://img.shields.io/badge/node-22-green)
![pnpm](https://img.shields.io/badge/pnpm-10-orange)

Платформа «Цифровой Кооператив» — комплексное программное обеспечение для управления кооперативными организациями на основе блокчейна EOSIO. Система обеспечивает полный цикл управления кооперативом: от регистрации пайщиков и электронного документооборота до проведения собраний и финансового учёта. Построена на принципах прозрачности, децентрализации и простой электронной подписи.

Проект является частью экосистемы [Кооперативная Экономика](https://coopenomics.world).

## Архитектура

| Компонент | Пакет | Описание |
|-----------|-------|----------|
| [boot](components/boot) | `@coopenomics/boot` | CLI для инициализации и управления блокчейн-инфраструктурой |
| [cleos](components/cleos) | `@coopenomics/cleos` | Утилита командной строки для работы с блокчейн-кошельком |
| [contracts](components/contracts) | `@coopenomics/contracts` | Смарт-контракты EOSIO на C++ |
| [controller](components/controller) | `@coopenomics/controller` | GraphQL API сервер (NestJS) |
| [cooptypes](components/cooptypes) | `cooptypes` | Общие типы и интерфейсы блокчейн-контрактов |
| [desktop](components/desktop) | `@coopenomics/desktop` | Рабочий стол кооператива (Vue 3 + Quasar) |
| [factory](components/factory) | `@coopenomics/factory` | Генератор юридических документов |
| [migrator](components/migrator) | `migrator` | Утилита миграции данных |
| [notifications](components/notifications) | `@coopenomics/notifications` | Библиотека уведомлений на основе Novu |
| [parser](components/parser) | `@coopenomics/parser` | Индексатор блокчейна через State History Plugin |
| [sdk](components/sdk) | `@coopenomics/sdk` | TypeScript SDK для GraphQL API |
| [setup](components/setup) | `@coopenomics/setup` | Мастер первоначальной настройки |

## Быстрый старт

### Предварительные требования

- Node.js 22 — та же версия, что в рантайм-образах (`node:22-slim`) и во всех CI-workflow'ах
- pnpm 10.33.0 — пин в поле `packageManager` корневого `package.json`, ставится через `corepack enable`
- Docker и Docker Compose
- [WeasyPrint](https://doc.courtbouillon.org/weasyprint/stable/first_steps.html#installation) (для генерации PDF)

> **Про версию Node.** Она не рекомендация, а требование: нативные модули привязаны
> к ABI ноды (Node 22 → 127, Node 24 → 137). Готовые бинарники лежат в репозитории
> (`vendor/prebuilds/<пакет>/<версия>/node-v<ABI>/linux-<arch>/`) и подкладываются
> postinstall-скриптом `scripts/install-native-prebuilds.mjs` — ничего не скачивается
> и не компилируется при установке. Сейчас завендорены ABI 127 и 137. На другой
> версии Node установка остановится с явным сообщением о том, какого prebuild'а
> не хватает; лечится добавлением файла в `vendor/prebuilds/`, а не пересборкой.

### Установка

```bash
pnpm install
```

### Конфигурация

```bash
pnpm run setup
```

Интерактивный мастер создаст необходимые `.env` файлы для всех компонентов.

### Запуск инфраструктуры

```bash
docker compose up -d
pnpm run reboot
```

## Вклад в проект

Правила работы с ветками, Pull Request'ами и проверками качества — в [CONTRIBUTING.md](./CONTRIBUTING.md).

## Разработка

### Бэкенд (controller + parser)

```bash
pnpm run dev:backend
```

### Фронтенд (desktop)

```bash
pnpm run dev:desktop
```

### Библиотеки (factory + cooptypes)

```bash
pnpm run dev:lib
```

### Все сервисы одновременно

```bash
pnpm run dev:all
```

> **Примечание:** установка пакетов производится только через фильтр: `pnpm add <пакет> --filter <компонент>`

## Тестирование

```bash
# Все тесты
pnpm run test

# Юнит-тесты (cooptypes, parser, notifications)
pnpm run test:unit

# Компонентные тесты (factory)
pnpm run test:component

# Интеграционные тесты (boot + blockchain)
pnpm run test:integration
```

## Сборка

```bash
# Библиотеки (cooptypes, factory)
pnpm run build:lib

# Смарт-контракты
pnpm run build:contracts:all

# Desktop (SSR)
pnpm --filter @coopenomics/desktop run build
```

## Лицензия

Продукт Потребительского Кооператива «ВОСХОД» распространяется по лицензии [BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/legalcode.ru).

Разрешено делиться, копировать и распространять материал, адаптировать и создавать производные произведения при условии указания авторства и сохранения той же лицензии. Коммерческое использование запрещено.
