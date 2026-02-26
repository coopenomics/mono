
## Быстрый старт

!!! note "Важно знать!"
    Никогда не используйте dev-конфигурацию для запуска подсетей кооперативов ввиду того, что ключи доступа к ней являются публичными. 

Программный код находится в моно-репозитории [github.com/coopenomics/mono](https://github.com/coopenomics/mono). Репозиторий включает полный комплект ПО для подключения к платформе «Кооперативная Экономика».

## Ветки

- `dev` — для разработки
- `testnet` — для стейджа
- `main` — для продакшена

## Предварительные требования

- **Node.js 20** (рекомендуется через nvm)
- **pnpm** (менеджер пакетов)
- **Docker** и **Docker Compose** (для инфраструктуры)
- **WeasyPrint** (генерация PDF документов)

```sh
# Node.js 20
nvm install 20 && nvm use 20

# pnpm
npm install -g pnpm

# WeasyPrint
sudo apt-get install -y python3 python3-venv libpango-1.0-0 libcairo2
sudo python3 -m venv /opt/weasyprint-venv
sudo /opt/weasyprint-venv/bin/pip install WeasyPrint==67
sudo ln -sf /opt/weasyprint-venv/bin/weasyprint /usr/local/bin/weasyprint
```

## Установка

```sh
git clone https://github.com/coopenomics/mono.git
cd mono
pnpm install
```

## Конфигурация с помощью `pnpm run setup`

Интерактивный установщик настраивает всю инфраструктуру:

```sh
pnpm run setup
```

Установщик предлагает три режима:

| Режим | Описание |
|-------|----------|
| **dev** | Локальная разработка — собственная блокчейн-нода, тестовые данные |
| **testnet** | Подключение к тестовой сети coopenomics |
| **production** | Подключение к основной сети |

Установщик автоматически:

1. Создаёт `.env` файлы для всех компонентов
2. Генерирует VAPID-ключи для push-уведомлений
3. Настраивает Docker Compose
4. Задаёт параметры подключения к блокчейну

## Запуск (dev-режим)

После конфигурации:

```sh
# Полный перезапуск (очистка + загрузка + старт)
pnpm run reboot
```

Команда `reboot` автоматически:

1. Останавливает все контейнеры
2. Очищает данные блокчейна
3. Поднимает инфраструктуру (MongoDB, PostgreSQL, Redis, OpenSearch, EOSIO)
4. Запускает `pnpm run boot` — деплоит смарт-контракты
5. Запускает парсер и контроллер

После успешного запуска:

| Сервис | URL |
|--------|-----|
| Контроллер (GraphQL) | http://localhost:2998/v1/graphql |
| Десктоп | http://localhost:2999 |
| Блокчейн API | http://localhost:8888 |

## Сборка контрактов

```sh
# Все контракты (test-режим, один член совета)
pnpm run build:contracts:all:test

# Один контракт
pnpm run build:contract:test -- marketplace
```

## Сборка библиотек

Порядок важен:

```sh
pnpm --filter cooptypes run build
pnpm --filter @coopenomics/factory run build
pnpm --filter @coopenomics/sdk run build
```

## Запуск тестов

```sh
# Unit-тесты контроллера
cd components/controller && npx jest tests/unit/

# Интеграционные тесты (требуют запущенную инфраструктуру)
cd components/boot && pnpm run test
```

## Полезные команды

| Команда | Описание |
|---------|----------|
| `pnpm run reboot` | Полный перезапуск всей системы |
| `pnpm run boot` | Деплой контрактов и инициализация |
| `pnpm run build:contracts:all:test` | Сборка всех контрактов |
| `docker compose up -d` | Поднять инфраструктуру |
| `docker compose down -v` | Остановить и очистить данные |

