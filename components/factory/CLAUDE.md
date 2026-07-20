# @coopenomics/factory — конвенции

> Детальное описание движка — в `AGENTS.md`. Здесь — правила, которые легко
> нарушить при правке `Actions/*`.

## Параллелизация сборки документа (resolveParallel)

В `generateDocument` каждого `Actions/*.ts` чтения источников шли строго
последовательно (`getTemplate` → `getMeta` → mongo → udata/meet/request), и
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
