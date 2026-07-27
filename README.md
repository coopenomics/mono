# Цифровой Кооператив

<!-- badges -->
![License](https://img.shields.io/badge/license-BY--NC--SA%204.0-blue)
![Node](https://img.shields.io/badge/node-%3E%3D20-green)
![pnpm](https://img.shields.io/badge/pnpm-9-orange)

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

- Node.js >= 20
- pnpm 9
- Docker и Docker Compose
- [WeasyPrint](https://doc.courtbouillon.org/weasyprint/stable/first_steps.html#installation) (для генерации PDF)

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
