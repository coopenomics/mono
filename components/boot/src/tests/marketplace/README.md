# Marketplace contract suite — Stories 11.2 + 11.3 MVP «Стол заказов»

Suite покрывает:

- **Story 11.2** — append-only трассировка каждой ledger2-операции
  marketplace flow в `blockchain_actions` / `journal` / `wjournal` через
  ProcessRegistry Phase A/B. Файл `trace.ts`.
- **Story 11.3** — CI-инварианты ledger2 (6 инвариантов) на каждом значимом
  marketplace-действии. Файл `invariants.ts`.

## Принцип «off-chain агрегация»

Контракт ledger2 НЕ хранит и не считает сумму по всем кошелькам/счетам
пайщиков on-chain — это ограничение CPU/RAM смарт-контракта.

Vitest-харнес ходит через GraphQL в controller (`getLedger2Accounts`,
`getLedger2Wallets`, `getLedger2History`) и сводит инварианты в test-time.
Это та же логика что и UI стола бухгалтера: единый off-chain layer для
аудита.

## Запуск

```bash
# С активным dev-стеком: nodeos + controller + parser2
pnpm --filter @coopenomics/boot run test src/tests/marketplace.test.ts
```

Тесты требуют:

1. nodeos с задеплоенным marketplace-контрактом из `marketplace2` ветки
   (или slim-equivalent). Старая `o.mkt.supply`/`o.mkt.recv` модель не
   подходит — рассогласование с 13 операциями.
2. controller с актуальным `OPERATION_CODE_TO_PROCESS_TYPE` (включая
   p.mkt.supply/return/wroff anchors).
3. Chairman-account `ant` (или другой через `TEST_EMAIL`/`TEST_WIF`).

## Статус scaffold (2026-05-18)

- `invariants.ts` — 6 функций готовы; I5 пометки SCAFFOLD (требует
  `marketplaceListOrders` query доступным в тестах).
- `trace.ts` — `loadProcessTrace` + `assertOperationTraced` готовы;
  `MARKETPLACE_OPERATION_CODES` зеркалит 13 кодов из cooptypes.
- `marketplace.test.ts` — каркас с full-flow сценариями. Конкретные
  helpers создания process (purchase / consume / return / writeoff) —
  todo (зависят от деплоя marketplace2 контракта).

После мержа `marketplace2` в `main` mono-ai-5:

1. Заполнить helpers `marketplace/createPurchaseFlow.ts`,
   `createConsumeFlow.ts`, `createReturnFlow.ts`, `createWriteoffFlow.ts`
   по образцу `capital/registerContributor.ts`.
2. Раскомментировать full-flow тесты в `marketplace.test.ts`.
3. Подключить suite в CI workflow `build-bootstrap.yaml` либо отдельным
   `marketplace-test.yaml` (memory `project_emp_workflows_disabled`
   относится к EMP, не mono-ai-5).
