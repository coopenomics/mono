# @coopenomics/factory

## Назначение

Движок генерации юридических документов кооператива. Принимает данные, валидирует их по JSON-схемам, заполняет Handlebars/Nunjucks-шаблоны, конвертирует HTML → PDF через WeasyPrint и сохраняет результат в MongoDB.

## Структура

```
src/
├── Actions/          — Фабрики документов. Каждый файл = один тип документа по registry_id
│                       (например, 100.ParticipantApplication.ts — заявление на вступление)
├── Templates/        — Шаблоны документов: модель данных, переводы, контекст, описание
│   └── registry.ts   — Реестр: маппинг registry_id → модуль шаблона
├── Models/           — Модели данных (Individual, Organization, Entrepreneur, Udata,
│                       Vars, PaymentMethod, Cooperative, Project, Document)
├── Services/
│   ├── Generator/    — PDFService: HTML → PDF через WeasyPrint (exec в shell)
│   ├── Validator/    — Валидация данных по JSON Schema через AJV (с русской локалью)
│   ├── Databazor/    — MongoDB-коннектор, поиск (SearchService), CRUD-операции
│   └── Templator/    — Шаблонизатор Nunjucks: рендер HTML из шаблона + переменных
├── Schema/           — JSON-схемы для валидации входных данных (Individual, Organization, и т.д.)
├── Interfaces/       — TypeScript интерфейсы (IGeneratedDocument, IGenerate, и т.д.)
├── Fonts/            — Шрифт Arial в base64 для PDF
└── index.ts          — Класс Generator — главная точка входа
```

## Ключевые концепции

### Система реестра (registry_id)

Каждый документ идентифицируется числовым `registry_id`. Реестр определён в `Templates/registry.ts` и дублируется в `Actions/index.ts`. Номера сгруппированы по смыслу:
- 1–4: базовые соглашения (кошелёк, ЭЦП, приватность, пользовательское)
- 50–51: соглашение Coopenomics, конвертация
- 100–101: заявление на вступление, выбор участка
- 300–304: общее собрание (повестка, решение совета, уведомление, бюллетень, решение)
- 501, 599, 600: решения по заявлению, свободные решения
- 700–702, 800–802, 900–901: имущественные взносы, возвраты
- 994–999, 1000–1090: программы ЦПП (Генератор, Благорост), договоры, акты

### Источник шаблонов (SOURCE)

- `SOURCE=local` — шаблоны берутся из локальных файлов в `Templates/`
- Иначе — загружаются из MongoDB (дельты парсера, таблица `drafts` / `translations`)

### Генерация PDF

`PDFService` в `Services/Generator/` записывает HTML во временный файл, вызывает `weasyprint` через `child_process.exec`, читает результат. Требует установленного WeasyPrint в системе.

### Приватные данные документа: `doc_data`

Зарезервированный механизм для документов, содержащих персональные данные, которые не должны попадать в блокчейн.

- `Services/DocData/index.ts` — `DocDataService` с `save(payload, registry_id) → { hash }` (sha256, идемпотентный upsert) и `get(hash) → payload | null`.
- Коллекция Mongo `doc_private_data` со схемой `{ hash, registry_id, payload, _created_at }`; уникальный индекс по `hash`.
- В Action документа — зарезервированное поле `doc_data_hash: string` (см. `Cooperative.Document.IDocDataRef` в cooptypes).
- `DocFactory.loadDocData(data)` — хелпер для конкретной фабрики: подгружает payload, фабрика кладёт в `combinedData.doc_data`.
- Шаблон обращается как `{{ doc_data.<field> }}` — `doc_data` это зарезервированная переменная шаблона наравне с `meta`, `coop`, `vars`, `user`, `request`, `program`, `decision`, `branch`.
- Generator-фасад: `generator.saveDocData(payload, registry_id)` / `generator.getDocData(hash)`.
- Graceful degradation: если payload удалён из коллекции, документ остаётся верифицируемым по хэшу подписи (on-chain), но не регенерируется.

Применяется в новых документах с персональными данными (1103.MarketplaceTransportNote — данные экспедитора). Старые документы не переводим.

### Mock-система

- `src/Utils/testMocks.ts` — экспортирует `testMocks` (массив моков из `mocks/tables/` и `mocks/actions/`)
- `src/Utils/mocks/matchMock.ts` — сопоставление моков по фильтрам
- Используется в тестах для подмены данных из MongoDB

## Тесты

- Фреймворк: **Vitest**
- Путь: `test/`
- Подготовка данных: `test/utils/index.ts` — функция `preLoading()` очищает коллекции MongoDB и заполняет тестовыми данными (реестр шаблонов, переменные, пользователи, организации, платёжные методы, данные собраний)
- Требует работающий MongoDB

### Запуск

```
NODE_ENV=test SOURCE=local SKIP_BLOCK_FETCH=TRUE pnpm --filter @coopenomics/factory test
```

Переменная `MONGO_URI` указывает на строку подключения к MongoDB. По умолчанию берётся из `.env` или строится из `MONGO_HOST`.

## Скрипты package.json

| Скрипт | Описание |
|--------|----------|
| `build` | Сборка через unbuild |
| `dev` | Пересборка при изменениях (nodemon + unbuild) |
| `test` | Vitest (timeout 240s, exclude `documents/`) |
| `lint` | ESLint |
| `typecheck` | TypeScript проверка (`tsc --noEmit`) |

## Зависимости от других компонентов

- `cooptypes` (workspace) — типы контрактов, интерфейсы документов
