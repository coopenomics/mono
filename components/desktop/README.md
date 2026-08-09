# 🖥️ @coopenomics/desktop

Веб-приложение рабочего стола кооператива на Vue 3 и Quasar Framework с поддержкой SSR и SPA. Реализует интерфейс для всех участников кооператива: председателя, членов совета и пайщиков — включая регистрацию, голосование, документооборот, финансовые операции и управление кооперативом.

## Основные возможности

- Архитектура Feature Sliced Design (FSD)
- SSR и SPA режимы (Quasar Framework)
- Pug-шаблоны с Composition API
- Система расширений (extensions) для модульного подключения функциональности (см. [docs/extension-factories.md](docs/extension-factories.md) о фабриках инжекции в стол совета и стол бухгалтера)
- Интернационализация (Vue I18n)
- Pinia для управления состоянием с персистентностью
- Интеграция с блокчейном EOSIO через Wharfkit
- Push-уведомления через Novu
- Мониторинг через Sentry и OpenReplay

## Установка

Компонент является частью монорепозитория. Установка зависимостей из корня проекта:

```bash
pnpm install
```

Или только для этого компонента:

```bash
pnpm install --filter @coopenomics/desktop
```

## Скрипты

| Скрипт | Команда | Описание |
|--------|---------|----------|
| `dev` | `pnpm run dev` | Запуск в режиме SSR-разработки |
| `devnet` | `pnpm run devnet` | Запуск в режиме SPA-разработки |
| `build` | `pnpm run build` | Сборка SSR для production |
| `build:spa` | `pnpm run build:spa` | Сборка SPA |
| `build:lib` | `pnpm run build:lib` | Сборка как библиотеки (Vite) |
| `lint` | `pnpm run lint` | Проверка кода (ESLint) |
| `typecheck` | `pnpm run typecheck` | Проверка типов TypeScript |
| `format` | `pnpm run format` | Форматирование кода (Prettier) |
| `start` | `pnpm run start` | Запуск собранного SSR-приложения |

Из корня монорепозитория:

```bash
pnpm run dev:desktop
```

## Конфигурация

Скопируйте `.env-example` в `.env`. Основные переменные:

- URL GraphQL API контроллера
- Endpoint блокчейн-ноды и `CHAIN_ID`
- Настройки Sentry и аналитики
- Настройки OpenReplay и Chatwoot

Для подключения к тестовой сети используйте `.env-testnet`.

Подробное описание переменных — в файле `.env-example`.

## Архитектура

Проект организован по методологии **Feature Sliced Design (FSD)**:

```
src/
├── app/                   # Инициализация приложения, провайдеры
├── pages/                 # Маршрутизируемые страницы
├── widgets/               # Составные виджеты
├── features/              # Фичи (бизнес-логика UI)
├── entities/              # Доменные сущности
├── shared/                # Общие утилиты, UI-kit, конфигурация
├── processes/             # Бизнес-процессы
├── stores/                # Хранилища Pinia
├── desktops/              # Рабочие столы по ролям
├── i18n/                  # Переводы
└── boot/                  # Quasar boot-файлы
extensions/                # Подключаемые расширения
├── capital/               # Паевые взносы
├── chairman/              # Кабинет председателя
├── chatcoop/              # Чат кооператива
├── market/                # Маркетплейс
├── market-admin/          # Администрирование маркетплейса
├── participant/           # Кабинет пайщика
├── powerup/               # Управление ресурсами
└── soviet/                # Совет кооператива
```

### Стек технологий

- **Vue 3** — Composition API
- **Quasar Framework** — UI-компоненты и SSR/SPA инфраструктура
- **Pug** — шаблоны компонентов
- **Pinia** — управление состоянием
- **Vue Router** — маршрутизация
- **Vue I18n** — интернационализация
- **Wharfkit** — интеграция с блокчейном EOSIO

> **Примечание:** в режиме разработки рекомендуется SPA (`quasar dev`), так как SSR-режим не поддерживает рендеринг расширений из-за ограничений сериализации Pinia.

## Лицензия

[BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/legalcode.ru)
