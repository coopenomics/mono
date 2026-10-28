# @coopenomics/factory — конвенции

> Детальное описание движка — в `AGENTS.md`. Здесь — правила, которые легко
> нарушить при правке `Actions/*`.

## Параллелизация сборки документа (resolveParallel)

В `generateDocument` каждого `Actions/*.ts` чтения источников шли строго
последовательно (`getTemplate` → `getMeta` → хранилище → udata/meet/request), и
сетевые запросы складывались в задержку (~1.5 с). Хелпер
`DocFactory.resolveParallel({...})` (`src/Factory/index.ts`) стартует
**взаимно независимые** чтения разом через `Promise.all`.

### Правило

В батч — ТОЛЬКО задачи, зависящие исключительно от `data` (не друг от друга):

```ts
const { template, coop, vars, user, meet, paymentMethod } = await this.resolveParallel({
  template: () => process.env.SOURCE === 'local'
    ? Promise.resolve(SomeDoc.Template as ITemplate<SomeDoc.Model>)
    : this.getTemplate<SomeDoc.Model>(DraftContract.contractName.production, SomeDoc.registry_id, data.block_num),
  coop: () => super.getCooperative(data.coopname, data.block_num),
  vars: () => super.getVars(data.coopname, data.block_num),
  user: () => super.getUser(data.username, data.block_num),
  // meet/udata/paymentMethod — если их аргументы только из data
})
```

Безопасно батчить: `getTemplate`, `getCooperative`, `getVars`, `getUser`,
`getBankAccount`, `getMeet`, `udataService.getOne(...)`, `paymentMethodService.getOne(...)`
— все читают только поля `data`, без сайд-эффектов.

### Зависимые вызовы — ПОСЛЕ батча, последовательно

Нельзя класть в `resolveParallel` то, что использует результат другой задачи:

- `getMeta({ title: template.title, ... })` — от `template`;
- `getDecision(coop, …, meta.created_at)` / `getApprovedDecision(coop, …)` — от `coop` (+ `meta`);
- `getCommonUser(user)` / `getFullName(user.data)` — от `user`;
- `getMeetQuestions(coopname, meet.id)` / `getGeneralMeetingDecision(meet)` — от `meet`;
- `getProgram(request.program_id)` — от `request`.

### Ловушка TDZ

`getMeta` нельзя засунуть в тот же батч, даже обернув в thunk: `Promise.all`
вызывает все thunk'и ДО присваивания деструктурированной `template` →
`ReferenceError` (temporal dead zone). Только после `await resolveParallel`.

### Сервисы — до батча

`new Udata(this.storage)` / `new PaymentMethod(this.storage)` создавать ДО
`resolveParallel`, чтобы ссылаться на них в thunk'ах.

### Что не трогать

Файлы, где параллелить нечего (только `template` + `meta`, а `meta` зависит от
`template`) — оставлять как есть. Условные ветки (bank_account по типу юзера,
branch по `is_branched`, signature-логика) и гварды — на местах, после батча.

## Шрифт PDF — системный, не base64

Arial встроен СИСТЕМНО в образ controller'а (`controller/Dockerfile` →
fontconfig + `fc-cache`), а НЕ через `@font-face data:base64` в html. base64
заставлял weasyprint парсить ~270 КБ TTF на КАЖДЫЙ рендер (≈1.3 с).
`Services/Generator/index.ts` ставит только `font-family: 'Arial'`. Не
возвращать base64-встраивание. `.gitattributes` держит `*.ttf binary` —
не убирать, иначе EOL-нормализация (`* text eol=lf`) испортит шрифт.
## Эталоны сборки (фабрика v2, шаг 0)

Каждая сборка документа в наборе тестов сверяется со снимком в
`test/golden/<registry_id>/<имя случая>.{html,meta.json,pdf.sha256}`
(`test/utils/golden.ts`, вызывается из `testDocumentGeneration`). Снимок —
поведение фабрики до рефакторинга: расхождение означает, что вывод старого
документа изменился, и это ошибка, а не повод обновить снимок.

- Набор запускается только в CI: workflow `Factory` (`.github/workflows/factory.yaml`),
  пуш в `ci/factory` или `ci/factory-*`. Локально тесты фабрики не гонять.
- Пересоздать снимки: пуш в `ci/factory-update` (режим `-u`), забрать артефакт
  `factory-golden`, положить в `test/golden/` и закоммитить. Делается только
  при осознанной смене вывода.
- `scripts/golden-coverage.mjs` падает, если у вида документа из `src/Actions`
  нет ни одного снимка. Новый документ — новый тест с `testDocumentGeneration`.
- Файлы набора идут по имени в закреплённом порядке (`AlphabeticalSequencer`):
  тесты делят одну базу PostgreSQL и переписывают udata и переменные кооператива.
- Хранилище набора — PostgreSQL (`testStorage()` в `test/utils`), фикстуры
  цепи — в памяти (`seedChainFixtures`, `src/Utils/mocks/store.ts`), кладутся
  перед каждым файлом.
- Время сборки пишется в `GOLDEN_TIMING_FILE`, сводка —
  `scripts/golden-timing-report.mjs`: исходный уровень скорости (NFR5).
- Версия пакета впечатывается в PDF (Creator и отпечаток меты в Keywords), и
  каждый выпуск менял бы хэши снимков. В наборе версия меты закреплена
  (`GOLDEN_VERSION` в `test/utils/golden.ts`), дата — `GOLDEN_CREATED_AT`.
- Пул WeasyPrint выдаёт воркеры по кругу; в наборе их два (`WEASY_POOL_SIZE`),
  поэтому сборка и пересборка идут через разные процессы Python и сверяются.
- Проба детерминизма между процессами — `scripts/pdf-determinism-probe.mjs`,
  шаг workflow `Factory`; печатает место первого отличия байтов PDF.


## Слой источников (фабрика v2, шаг 1)

Все чтения — в `src/Sources` (`FactorySources`): шаблон на блок (в том числе
локальный при `SOURCE=local`), субъекты, кооператив, переменные, реквизиты,
udata, приватные данные, подписи, собрания, голоса. `DocFactory` только
делегирует (`getTemplate`, `getUser`, `getUdata`, `getPaymentMethod`, …).
В `Actions/*` обращений к `this.storage`, `new Udata(...)` и ветки
`process.env.SOURCE` нет и не должно появляться: новое чтение добавляется
методом `FactorySources`, затем фасадом в `DocFactory`.

## Объявляемый сборщик (фабрика v2, шаг 3)

Сборщик документа — объявление, не класс: `defineBuilder<Action, Model>()({ … })`
в `src/Builder`. Поля объявления:

- `registry_id`, `version` — номер реестра и версия сборщика (ось версий, шаг 7);
- `reads: ({ data, f, s, options }) => ({ ключ: () => чтение })` — первая волна,
  независимые чтения, каркас запускает их разом; `f` — фасад составных чтений
  (`getUser`, `getCooperative`, `getVars`, `getUdata`, `getMeet`, …), `s` — слой
  источников для сырых чтений;
- `derive: ({ …, meta, template, reads }) => ({ ключ: () => чтение })` — вторая
  волна, когда чтению нужна мета (голоса по решению) или первая волна (вопросы
  собрания, участок после проверки);
- `meta: ({ data, template, reads }) => поля меты` — только если мета не
  `{ title: template.title, ...data }` (заголовок из проекта, подпись вне меты);
- `assemble: ({ data, meta, template, reads, derived }) => Model` — чистая сборка;
  проверки реквизитов и исключения живут здесь;
- `signer` — подписант для названия файла PDF.

Правила:
- Текст шаблона каркас читает сам; в объявлении его нет.
- Запрет сохранения каркас берёт из `options.skip_save`, иначе из `data.skip_save`.
- Чтение с записью одно — подпись пайщика в заявлении 100, во второй волне.
- Форматирование — только `Format.*`; `this` в объявлении нет.
- Новый вид документа — один файл в `src/Actions` по этому образцу плюс строка
  экспорта в `src/Actions/index.ts`. Реестр сборщиков (`src/Builder/registry.ts`)
  собирается из этих экспортов при старте и падает на дубле номера, расхождении
  с реестром шаблонов и сборщике без шаблона; полноту экспорта держит
  `scripts/actions-index-check.mjs` в workflow Factory. Таблицы в `Generator` нет.
