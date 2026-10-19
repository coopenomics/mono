---
tags:
  - Пайщик
  - Разработчик
---

# Возврат взноса

Возврат паевого взноса начинается с заявления пайщика. Заявление уходит в совет кооператива, после решения совета кассир переводит деньги на реквизиты пайщика.

![Заявление на возврат](/assets/new/participant/wallet/04-withdraw.png)

Кнопка «Получить возврат» в шапке кошелька открывает заявление. Пайщик указывает сумму в пределах доступного остатка главного кошелька и выбирает способ получения из своих [реквизитов](requisites.md). Кнопка «Создать заявление» собирает документ, пайщик подписывает его ключом, и вопрос встаёт в повестку совета. Ход возврата виден на странице [«Платежи»](payments.md), само заявление лежит в [документах](documents.md).

## Разработчикам

{{ dev_schema_source() }}

### Заявление на возврат (генерация документа)

{{ get_sdk_doc("Mutations", "Wallet", "GenerateReturnByMoneyStatementDocument") }} | {{ get_graphql_doc("Mutation.generateReturnByMoneyStatementDocument") }}

{{ get_typedoc_desc("Mutations.Wallet.GenerateReturnByMoneyStatementDocument") }}

{{ get_typedoc_input("Mutations.Wallet.GenerateReturnByMoneyStatementDocument") }}

Результат:

{{ get_typedoc_definition("Mutations.Wallet.GenerateReturnByMoneyStatementDocument", "IOutput") }}

### Решение по возврату (генерация документа)

{{ get_sdk_doc("Mutations", "Wallet", "GenerateReturnByMoneyDecisionDocument") }} | {{ get_graphql_doc("Mutation.generateReturnByMoneyDecisionDocument") }}

{{ get_typedoc_desc("Mutations.Wallet.GenerateReturnByMoneyDecisionDocument") }}

{{ get_typedoc_input("Mutations.Wallet.GenerateReturnByMoneyDecisionDocument") }}

Результат:

{{ get_typedoc_definition("Mutations.Wallet.GenerateReturnByMoneyDecisionDocument", "IOutput") }}

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

### Баланс программного кошелька

{{ get_sdk_doc("Queries", "Wallet", "GetProgramWallet") }} | {{ get_graphql_doc("query.getProgramWallet") }}

{{ get_typedoc_desc("Queries.Wallet.GetProgramWallet") }}

{{ get_typedoc_input("Queries.Wallet.GetProgramWallet") }}

Результат:

{{ get_typedoc_definition("Queries.Wallet.GetProgramWallet", "IOutput") }}



