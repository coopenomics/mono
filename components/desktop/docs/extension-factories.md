# Фабрики инжекции компонентов между расширениями

В desktop есть два «общих стола», на которые приходят данные из разных
расширений: **стол совета** (`extensions/soviet`) и **стол бухгалтера**
(`extensions/reports`). Они показывают единый поток того, чем живёт
кооператив — повестка решений и реестр операций соответственно — и должны
оставаться единственной точкой просмотра для пользователя.

Чтобы прикладные расширения (`capital`, `market`, `registrator`, …) могли
показать на этих столах своё бизнес-описание, не дублируя интерфейс у себя
и не размывая роль стола, используется паттерн **фабрик инжекции**.
Расширение регистрирует Vue-компонент по идентификатору доменной сущности
(тип решения / тип процесса), общий стол этот компонент рендерит в нужном
слоте.

## Где какая фабрика

| Фабрика | Куда инжектирует | Чем индексируется | Источник правды по идентификатору |
|---|---|---|---|
| `decisionFactory` (`shared/lib/decision-factory`) | Стол совета — `widgets/Questions/QuestionsTable` (повестка) | `decisionType` (строка из `table.type`) | Реестр решений в backend / `cooptypes` |
| `processInfoFactory` (`shared/lib/process-info-factory`) | Стол бухгалтера — `extensions/reports/pages/OperationsPage` (реестр операций) | `process_type` | `Ledger2.LEDGER2_PROCESS_REGISTRY` |

Обе фабрики устроены одинаково: singleton-реестр `Record<string, Handler>`
+ методы `registerHandler / getInfoComponent / hasHandler`. Регистрация —
side-effect при загрузке расширения; общий стол читает реестр на каждом
ререндере строки.

## Когда что добавлять

- **Новый тип решения совета** (нужна подпись Протокола, голосование,
  отдельная заявка-инициатор) — `decisionFactory`. Помимо `infoComponent`
  здесь нужен `generateHandler`, генерирующий PDF-документ решения.

- **Новый тип процесса ledger2** (поставка, возврат, списание, выпуск
  займа и т. п.) — `processInfoFactory`. Достаточно одного
  `infoComponent`: проводки, движения по кошелькам и документы стол
  бухгалтера соберёт сам, расширение лишь даёт человекочитаемое
  «содержание процесса» в бизнес-словаре + deep-link на свой собственный
  стол.

## Что НЕ должно делать расширение

- **Не показывать у себя реестр операций / проводок / документов.** Эта
  информация уже есть на столе бухгалтера в общем виде по всем процессам.
  Дублирование = два «правильных» места + расхождения между ними.
- **Не показывать у себя ленту решений совета.** Все решения по всем
  расширениям видны в одной повестке.
- **Не пихать в `infoComponent` техничку**: `process_type` / `o.mkt.*` /
  block_num / event_id / raw enum-значения. Стол читают председатель,
  бухгалтер, ревизор — у них нет контекста разработчика. Только бизнес-
  поля и deep-link.

## DecisionFactory — стол совета

### Контракт

```ts
// shared/lib/types/decision-factory.ts
interface IDecisionHandler {
  generateHandler: (data: IGenerateDecisionData) => Promise<unknown>
  infoComponent?: Component<{ agenda: IAgenda }>
}
```

`infoComponent` получает `IAgenda` (строку повестки) и рендерит блок
дополнительной информации справа от стандартных полей повестки.

### Пример регистрации (`extensions/capital`)

```ts
// extensions/capital/app/extensions.ts
import { decisionFactory } from 'src/shared/lib/decision-factory'
import { CreateResultDecisionInfoWidget } from '../widgets/CreateResultDecisionInfoWidget'
import { useGenerateResultContributionDecision } from '../features/Result/.../model'

export function registerCapitalDecisionHandlers() {
  decisionFactory.registerHandler('createresult', {
    generateHandler: async ({ decision_id, username, row }) => {
      const meta = JSON.parse(row.table.statement.meta) as { result_hash: string }
      const { generateResultContributionDecision } = useGenerateResultContributionDecision()
      return generateResultContributionDecision({ result_hash: meta.result_hash, decision_id, username })
    },
    infoComponent: CreateResultDecisionInfoWidget,
  })
}
```

Регистрация вызывается из `install.ts` расширения **до** `return` workspace-
конфигурации, чтобы стол совета увидел handler раньше первого ренда.

## ProcessInfoFactory — стол бухгалтера

### Контракт

```ts
// shared/lib/types/process-info-factory.ts
interface IProcessInfoProps {
  processHash: string
  processType: string
  coopname: string
}
interface IProcessInfoHandler {
  infoComponent: Component<IProcessInfoProps>
}
```

`infoComponent` получает три props и должен:
- сам подтянуть `IProcessSnapshot` через `useProcessStore().loadLatestSnapshot({ coopname, hash: processHash })`;
- отрисовать бизнес-поля из снэпшота;
- дать кнопку-deep-link на свой собственный стол расширения с
  `query: { process_hash: processHash }`.

### Пример регистрации (`extensions/market`)

```ts
// extensions/market/app/extensions.ts
import { Ledger2 } from 'cooptypes'
import { processInfoFactory } from 'src/shared/lib/process-info-factory'
import { ProcessSupplyInfoWidget } from 'src/widgets/Marketplace/ProcessSupplyInfoWidget'
import { ProcessReturnInfoWidget } from 'src/widgets/Marketplace/ProcessReturnInfoWidget'
import { ProcessWriteoffInfoWidget } from 'src/widgets/Marketplace/ProcessWriteoffInfoWidget'

function processTypeByName(name: string): string {
  const meta = Ledger2.LEDGER2_PROCESS_REGISTRY.find(
    (p) => p.contract === 'marketplace' && p.name === name,
  )
  if (!meta) throw new Error(`process_type marketplace::${name} отсутствует в LEDGER2_PROCESS_REGISTRY`)
  return meta.type
}

export function registerMarketplaceProcessInfoHandlers(): void {
  processInfoFactory.registerHandler(processTypeByName('SUPPLY'),   { infoComponent: ProcessSupplyInfoWidget })
  processInfoFactory.registerHandler(processTypeByName('RETURN'),   { infoComponent: ProcessReturnInfoWidget })
  processInfoFactory.registerHandler(processTypeByName('WRITEOFF'), { infoComponent: ProcessWriteoffInfoWidget })
}
```

Ключ берётся из `Ledger2.LEDGER2_PROCESS_REGISTRY` через `name`-поле, а не
строковым литералом — переименование `process_type` в cooptypes
автоматически подцепится.

Вызов `registerMarketplaceProcessInfoHandlers()` стоит в `install.ts`
расширения до `return`.

## Чек-лист для нового расширения

1. Завести виджет(ы) `widgets/.../<DomainName>InfoWidget` — `<template lang="pug">`,
   бизнес-поля + deep-link, никаких raw enum / process_type / hash в видимой части.
2. Создать `extensions/<name>/app/extensions.ts` с функцией
   `register<Name>(Decision|ProcessInfo)Handlers()`.
3. Импортировать и вызвать её в `extensions/<name>/install.ts` до `return`.
4. Если новый `process_type` или `decision_type` — добавить запись в
   соответствующий реестр (`cooptypes` для процессов; backend-реестр для
   решений). Иначе фабрика правильно молчит, но строка в общем столе
   останется без бизнес-блока.
5. На своём собственном столе расширения не пытаться повторить реестр
   операций / проводок / повестки. Если нужно «открыть процесс» — это
   deep-link в общий стол.

## Связанные файлы

- `components/desktop/src/shared/lib/decision-factory/index.ts`
- `components/desktop/src/shared/lib/process-info-factory/index.ts`
- `components/desktop/src/shared/lib/types/decision-factory.ts`
- `components/desktop/src/shared/lib/types/process-info-factory.ts`
- `components/desktop/src/widgets/Questions/QuestionsTable/QuestionsTable.vue` — рендер слота на столе совета
- `components/desktop/extensions/reports/pages/OperationsPage/ui/OperationsPage.vue` — рендер слота на столе бухгалтера
- `components/desktop/src/entities/Process` — api / store для `processInfoFactory`-виджетов
- `components/desktop/extensions/capital/app/extensions.ts` — образец `decisionFactory`-регистрации
- `components/desktop/extensions/market/app/extensions.ts` — образец `processInfoFactory`-регистрации
