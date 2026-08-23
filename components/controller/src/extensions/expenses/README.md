# Expenses Extension — шасси расходов (C28-31)

**Статус:** implemented (8 actions полного lifecycle, sync-сервис, GraphQL).

## Скоуп расширения

Backend-сторона **шасси системы расходов** (MVP-SINGLE) для Цифрового Кооператива. Расширение:

- хранит и отдаёт **проектные сущности** (`expense_proposals`, `expense_items`) — синхронизация с контрактом `expenses` (TBA в C28-29);
- хранит и отдаёт **первичные файлы** (`expense_files`) — payment proof, отчёт-чеки, return proof. Файлы — в MinIO через готовую `~/infrastructure/file-storage` инфру;
- агрегирует document2 (2010 СЗ-смета, 2011 протокол-1 — см. cooptypes registry 2010/2011) и `expense_files` в единый ответ `expenseProposalDetails` для UI;
- триггерит capital extension при переходе расхода в финальный статус (capitalization of WIP).

## Зависимости (порядок сборки)

1. **C28-28** — P0 коды в `OPERATION_REGISTRY` (`o.exp.*`) — БЛОКИРУЕТ контракт.
2. **C28-29** — контракт `expenses` + cooptypes types: `Expenses.payexp`, `Expenses.reportexp`, `Expenses.returnexp` etc.
3. **C28-30** — ✅ document2 2010/2011 (готово, commit `1fa41b2b39a`).
4. **C28-31** (этот модуль) — TypeORM-entities + sync + GraphQL.
5. **C28-32** — UI шасси (потребляет GraphQL отсюда).

## Планируемая структура файлов

```
extensions/expenses/
├── README.md                                  ← этот файл
├── expenses-extension.module.ts               ← NestJS root module (forwardRef в Capital, File-storage)
├── application/
│   ├── dto/
│   │   ├── pay-expense-item.input.ts          ← { proposal_hash, item_hash, actual_amount, payment_proof: Upload }
│   │   ├── upload-report-file.input.ts        ← { proposal_hash, item_hash?, kind, file: Upload }
│   │   ├── submit-report.input.ts             ← { proposal_hash, total_actual_amount }
│   │   └── return-expense.input.ts            ← { proposal_hash, item_hash, return_proof: Upload }
│   └── resolvers/
│       ├── expense-proposal.resolver.ts       ← Query: expenseProposalDetails(proposal_hash)
│       ├── expense-files.resolver.ts          ← Query: expenseFiles(proposal_hash), Mutation: uploadExpenseFile
│       └── expense-mutations.resolver.ts      ← Mutation: payExpenseItem / submitReport / returnExpense / authorizeReport
├── domain/
│   ├── entities/
│   │   ├── expense-proposal.entity.ts         ← domain model (proposal_hash, status, items[], document2_refs)
│   │   ├── expense-item.entity.ts             ← domain model (item_hash, recipient_type, mechanics, amounts)
│   │   └── expense-file.entity.ts             ← domain model (file_id, proposal_hash, item_hash?, kind, minio_key, checksum, mime, size, uploaded_at, uploaded_by)
│   ├── enums/
│   │   ├── expense-proposal-status.enum.ts    ← DRAFT | APPROVED | PARTIALLY_PAID | REPORTED | AUTHORIZED | CLOSED | DECLINED
│   │   ├── expense-item-status.enum.ts        ← APPROVED | PAID | REPORTED | RETURNED | OVERSPENT
│   │   ├── expense-recipient-type.enum.ts     ← SELF | MEMBER | ORG (зеркалит cooptypes ExpenseItemRecipientType)
│   │   ├── expense-payment-mechanics.enum.ts  ← ADVANCE | DIRECT (зеркалит cooptypes ExpenseItemPaymentMechanics)
│   │   └── expense-file-kind.enum.ts          ← PAYMENT_PROOF | REPORT_FILE | RETURN_PROOF
│   ├── interfaces/
│   │   ├── expense-blockchain.interface.ts    ← IExpenseProposalBlockchainData / IExpenseItemBlockchainData
│   │   └── expense-database.interface.ts      ← IExpenseProposalDatabaseData / IExpenseItemDatabaseData / IExpenseFileDatabaseData
│   └── repositories/
│       ├── expense-proposal.repository.ts     ← interface
│       ├── expense-item.repository.ts         ← interface
│       └── expense-file.repository.ts         ← interface
├── infrastructure/
│   ├── database/
│   │   └── expenses-database.module.ts        ← TypeOrmModule.forFeature([...])
│   ├── entities/
│   │   ├── expense-proposal.typeorm-entity.ts ← coopname, proposal_hash, username, status, total_amount, statement_doc, decision_doc, _created_at, _updated_at
│   │   ├── expense-item.typeorm-entity.ts     ← proposal_hash, item_hash, recipient_type, mechanics, planned_amount, actual_amount, recipient_account, status
│   │   └── expense-file.typeorm-entity.ts     ← file_id (uuid), proposal_hash, item_hash (nullable), kind, minio_key, checksum, mime, size_bytes, uploaded_by, uploaded_at
│   ├── mappers/
│   │   ├── expense-proposal.mapper.ts         ← domain <-> typeorm
│   │   ├── expense-item.mapper.ts
│   │   └── expense-file.mapper.ts
│   ├── repositories/
│   │   ├── expense-proposal.typeorm-repository.ts  ← extends BaseBlockchainRepository
│   │   ├── expense-item.typeorm-repository.ts      ← extends BaseBlockchainRepository
│   │   └── expense-file.typeorm-repository.ts      ← plain TypeORM (нет блокчейн-якоря)
│   ├── blockchain/
│   │   └── mappers/
│   │       ├── expense-proposal-delta.mapper.ts    ← parser2 delta → IExpenseProposalBlockchainData
│   │       └── expense-item-delta.mapper.ts
│   └── services/
│       ├── expense-files.service.ts           ← @UseBucket('expenses:files'), put/getReadUrl/delete
│       ├── document-aggregation.service.ts    ← собирает 2010+2011 document2 + expense_files в expenseProposalDetails
│       └── capital-trigger.service.ts         ← вызывает capital extension при authorizeReport → capitalization
└── constants/
    └── expenses-bucket.ts                     ← { name: 'expenses:files', maxBytes, allowedMime, metadataSchema }
```

## MinIO bucket spec

```ts
{
  name: 'expenses:files',
  maxBytes: 20 * 1024 * 1024,     // 20 МБ на файл (чеки/PDF/фото)
  allowedMime: [
    'image/jpeg', 'image/png', 'image/webp', 'image/heic',
    'application/pdf',
  ],
  metadataSchema: {
    proposalHash: 'required',
    itemHash: 'optional',
    kind: 'required',                // PAYMENT_PROOF | REPORT_FILE | RETURN_PROOF
    uploadedBy: 'required',          // username
  },
  defaultUrlTtlSeconds: 600,         // 10 мин на signed read URL
}
```

Ключ объекта: `{coopname}/expenses/{proposal_hash}/{item_hash|_proposal}/{kind}/{checksum}.{ext}`.

## GraphQL-схема (предварительная)

```graphql
type Query {
  expenseProposalDetails(coopname: String!, proposal_hash: String!): ExpenseProposalDetails!
  expenseFiles(coopname: String!, proposal_hash: String!): [ExpenseFile!]!
}

type Mutation {
  payExpenseItem(input: PayExpenseItemInput!): ExpenseItem!
  submitExpenseReport(input: SubmitReportInput!): ExpenseProposal!
  authorizeExpenseReport(coopname: String!, proposal_hash: String!): ExpenseProposal!
  declineExpenseReport(coopname: String!, proposal_hash: String!, reason: String!): ExpenseProposal!
  returnExpenseItem(input: ReturnExpenseInput!): ExpenseItem!
  uploadExpenseFile(input: UploadExpenseFileInput!): ExpenseFile!
}

type ExpenseProposalDetails {
  proposal: ExpenseProposal!
  items: [ExpenseItem!]!
  files: [ExpenseFile!]!
  documents: ExpenseProposalDocuments!     # signed 2010 + signed 2011
  events: [ExpenseProposalEvent!]!         # таймлайн
}
```

## Когда расшивается C28-28

Каркас выше можно класть в код **только после** согласования имён `o.exp.*` action-codes и моделей wallets/счетов с пользователем (вопросы заданы в issue C28-28). До этого любой код в `infrastructure/blockchain/mappers/*` опирается на несуществующие cooptypes-типы.

## Ссылки

- PRD шасси: `13-platforma-tsifrovogo-kooperativa/components/14-versiya-3/requirements/f8-prd-shassi-sistemy-raskhodov-tsifrovogo-kooperativa-v12.md`
- Issue C28-31: `13-platforma-tsifrovogo-kooperativa/components/14-versiya-3/issues/C28-31-shassi-raskhodov-epik-3-backend-extension-expenses.md`
- File-storage инфра: `~/infrastructure/file-storage/README.md`
- Образец extension с blockchain-sync: `~/extensions/capital/`
- Document2 templates: `components/cooptypes/src/cooperative/registry/2010.ExpenseProposalStatement/`, `2011.ExpenseProposalDecision/`
