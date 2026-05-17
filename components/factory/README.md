# 📄 @coopenomics/factory

Фабрика документов кооператива — библиотека для генерации юридически значимых документов (PDF). Объединяет шаблоны из блокчейна, приватные данные из хранилища и рендерит HTML через Handlebars/Nunjucks с последующей генерацией PDF через WeasyPrint.

## Основные возможности

- Более 60 шаблонов юридических документов (заявления, протоколы, решения, договоры, акты)
- Рендеринг HTML из шаблонов Handlebars и Nunjucks
- Генерация PDF через WeasyPrint
- Валидация данных по JSON Schema
- Электронная подпись документов через EOSIO-ключи
- Хранение документов и метаданных в MongoDB
- Сборка как ES-модуль и CommonJS (unbuild)

## Установка

Компонент является частью монорепозитория. Установка зависимостей из корня проекта:

```bash
pnpm install
```

Или только для этого компонента:

```bash
pnpm install --filter @coopenomics/factory
```

### Системные зависимости

Для генерации PDF необходим [WeasyPrint](https://doc.courtbouillon.org/weasyprint/stable/first_steps.html#installation).

## Скрипты

| Скрипт | Команда | Описание |
|--------|---------|----------|
| `build` | `pnpm run build` | Сборка библиотеки (unbuild) |
| `dev` | `pnpm run dev` | Режим разработки с автопересборкой (nodemon) |
| `test` | `pnpm run test` | Запуск тестов (Vitest) |
| `lint` | `pnpm run lint` | Проверка кода (ESLint) |
| `typecheck` | `pnpm run typecheck` | Проверка типов TypeScript |
| `setup-indexes` | `pnpm run setup-indexes` | Настройка индексов MongoDB |

Из корня монорепозитория:

```bash
pnpm run build:lib       # Сборка factory + cooptypes
pnpm run dev:lib         # Режим разработки factory + cooptypes
pnpm run test:component  # Компонентные тесты factory
```

## Конфигурация

Для тестирования и локальной работы необходимо подключение к MongoDB. Переменные окружения:

- `MONGO_URI` — строка подключения к MongoDB
- `SOURCE` — источник данных (`local` для тестов)

Подробное описание переменных — в файле `.env-example`.

## Тестирование

```bash
SOURCE=local NODE_ENV=test pnpm --filter @coopenomics/factory run test
```

Тестовый набор покрывает генерацию документов различных типов. Тесты требуют запущенный MongoDB и используют таймаут 240 секунд.

Файлы тестов:

| Файл | Описание |
|------|----------|
| `test/index.test.ts` | Основные тесты генерации документов |
| `test/wallet.test.ts` | Тесты документов кошелька |
| `test/meet.test.ts` | Тесты документов собраний |
| `test/blagorost.test.ts` | Тесты документов программы «Благорост» |
| `test/market.test.ts` | Тесты документов маркетплейса |
| `test/search.test.ts` | Тесты поиска документов |
| `test/udata.test.ts` | Тесты пользовательских данных |
| `test/documents-1000-plus.test.ts` | Тесты документов с registry_id > 1000 |

## Архитектура

```
src/
├── index.ts               # Точка входа библиотеки
├── config.ts              # Конфигурация подключений
├── Actions/               # Генераторы документов (по registry_id)
│   ├── 1.WalletAgreement.ts
│   ├── 100.ParticipantApplication.ts
│   ├── 300.AnnualGeneralMeetingAgenda.ts
│   ├── 600.FreeDecision.ts
│   ├── 1001.GenerationContract.ts
│   └── ...                # Более 60 шаблонов
├── Factory/               # Ядро фабрики документов
├── Models/                # Модели данных MongoDB
│   ├── Cooperative.ts
│   ├── Individual.ts
│   ├── Organization.ts
│   ├── Document.ts
│   └── ...
└── templates/             # HTML-шаблоны (Nunjucks/Handlebars)
test/                      # Тесты (Vitest)
```

### Процесс генерации документа

1. Загрузка шаблона и JSON Schema из блокчейна
2. Получение приватных данных из хранилища (MongoDB)
3. Валидация данных по JSON Schema (Ajv)
4. Конструирование контекста для шаблона
5. Рендеринг HTML из Nunjucks/Handlebars-шаблона
6. Подпись хеша документа EOSIO-ключом
7. Генерация PDF через WeasyPrint

## Приватные данные документа: `doc_data`

Зарезервированный механизм для документов, содержащих персональные данные (ФИО экспедитора, паспорт, госномер, телефон и т.п.), которые **не должны попадать в блокчейн**.

### Поток

1. Контроллер собирает приватный payload и вызывает `generator.saveDocData(payload, registry_id)` — возвращается `{ hash }` (sha256, идемпотентный).
2. `hash` передаётся on-chain в Action под зарезервированным именем `doc_data_hash`.
3. При генерации/регенерации фабрика подгружает payload из `doc_private_data` через `generator.getDocData(hash)` и подставляет в `combinedData.doc_data`.
4. Шаблон документа использует приватные поля как `{{ doc_data.<field> }}`.

### Пример

Контроллер:

```ts
const { hash } = await generator.saveDocData({
  expeditor_full_name: 'Иванов Иван Иванович',
  passport: '4509 123456',
  phone: '+79991234567',
  vehicle_registration_number: 'А123ВВ77',
}, 1103)

// в Action документа 1103 (MarketplaceTransportNote):
await generator.generate({
  registry_id: 1103,
  coopname: 'voskhod',
  username: operatorAccount,
  shipment_id,
  doc_data_hash: hash,
})
```

Фабрика (`src/Actions/1103.MarketplaceTransportNote.ts`):

```ts
const doc_data = await this.loadDocData<TransportNoteDocData>(data)
const combinedData = { ...base, doc_data }
```

Шаблон (`Templates/1103.MarketplaceTransportNote/index.ts`):

```html
<tr><th>Экспедитор</th><td>{{ doc_data.expeditor_full_name }}</td></tr>
<tr><th>Госномер</th><td>{{ doc_data.vehicle_registration_number }}</td></tr>
```

### Зарезервированные имена шаблона

| Имя | Источник | Применение |
|---|---|---|
| `meta` | factory | заголовки, дата, lang, hash |
| `coop` | factory | реквизиты кооператива |
| `vars` | factory | переменные кооператива |
| `user` | factory | подписант (по сертификату) |
| `request` / `program` / `decision` | factory | контекст ЦПП |
| `branch` | factory | данные КУ |
| **`doc_data`** | **DocDataService** | **приватные данные документа** |

### Graceful degradation

Если запись в `doc_private_data` удалена (например, по запросу пайщика), документ остаётся **верифицируемым по хэшу подписи** (хэш зафиксирован on-chain), но не регенерируется. Это явное архитектурное решение: ценность блокчейн-подписи сохраняется; восстановление PDF — обратимо deprecated.

### Когда применять

- **Новые документы** с персональными данными — сразу через `doc_data`.
- **Существующие документы** (700-1099, 300-304 и т.д.) — остаются без изменений. Паттерн прогрессивный, переводить старые документы при отсутствии необходимости не нужно.

## Ключевые зависимости

- **nunjucks / handlebars** — шаблонизаторы
- **ajv** — валидация JSON Schema
- **mongodb** — хранилище данных
- **eosjs-ecc** — криптографические операции EOSIO
- **pdf-lib** — работа с PDF
- **unbuild** — сборка библиотеки

## Лицензия

[BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/legalcode.ru)
