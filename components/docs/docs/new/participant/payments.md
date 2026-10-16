---
tags:
  - Пайщик
  - Разработчик
---

# Платежи

Платежи показывают все деньги пайщика в движении: паевые взносы, возвраты и выплаты по программам.

![Платежи пайщика](/assets/new/participant/payments/01-page.png)

У нового пайщика платежей нет. Строка платежа показывает пайщика, дату, сумму, тип платежа, направление и состояние. Входящий платёж — взнос пайщика в кооператив, он ждёт подтверждения кассира в состоянии «Ожидает обработки» и становится «Завершён» после подтверждения. Исходящий платёж — выплата пайщику по решению совета: возврат взноса или аванс под отчёт. Нажатие на строку раскрывает платёж с назначением, суммой и реквизитами, по авансу в раскрытой строке пайщик подаёт [отчёт чеками](../expenses/advances.md).

## Разработчикам

{{ dev_schema_source() }}

### Список платежей

{{ get_sdk_doc("Queries", "Gateway", "GetPayments") }} | {{ get_graphql_doc("query.getPayments") }}

{{ get_typedoc_desc("Queries.Gateway.GetPayments") }}

{{ get_typedoc_input("Queries.Gateway.GetPayments") }}

Результат:

{{ get_typedoc_definition("Queries.Gateway.GetPayments", "IOutput") }}

### Изменить статус платежа

{{ get_sdk_doc("Mutations", "Gateway", "SetPaymentStatus") }} | {{ get_graphql_doc("Mutation.setPaymentStatus") }}

{{ get_typedoc_desc("Mutations.Gateway.SetPaymentStatus") }}

{{ get_typedoc_input("Mutations.Gateway.SetPaymentStatus") }}

Результат:

{{ get_typedoc_definition("Mutations.Gateway.SetPaymentStatus", "IOutput") }}

### Создать платёж (депозит)

{{ get_sdk_doc("Mutations", "Gateway", "CreateDepositPayment") }} | {{ get_graphql_doc("Mutation.createDepositPayment") }}

{{ get_typedoc_desc("Mutations.Gateway.CreateDepositPayment") }}

{{ get_typedoc_input("Mutations.Gateway.CreateDepositPayment") }}

Результат:

{{ get_typedoc_definition("Mutations.Gateway.CreateDepositPayment", "IOutput") }}

### Создать начальный платёж

{{ get_sdk_doc("Mutations", "Gateway", "CreateInitialPayment") }} | {{ get_graphql_doc("Mutation.createInitialPayment") }}

{{ get_typedoc_desc("Mutations.Gateway.CreateInitialPayment") }}

{{ get_typedoc_input("Mutations.Gateway.CreateInitialPayment") }}

Результат:

{{ get_typedoc_definition("Mutations.Gateway.CreateInitialPayment", "IOutput") }}



