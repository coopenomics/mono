---
tags:
  - Пайщик
  - Разработчик
---

# Кошелёк

Кошелёк показывает паевые взносы пайщика по программам кооператива. Деньги приходят в главный паевой кошелёк паевым взносом, из него переводятся в кошельки приложений, когда пайщик участвует в их программах, и возвращаются обратно к выходу из программы. Возврат взноса пайщику идёт из главного кошелька по заявлению в совет.

![Кошелёк пайщика](/assets/new/participant/wallet/01-wallet.png)

Первая карточка показывает минимальный неснижаемый остаток: он зарезервирован на всё время членства и возвращается при выходе из кооператива. Вторая карточка — главный паевой кошелёк программы «Цифровой кошелёк» с доступной суммой. Ниже кошельки установленных приложений, на кадре Благорост и два кошелька Стола заказов: свободный паевой и членский взнос. В шапке две кнопки: [«Совершить взнос»](wallet-topup.md) и [«Получить возврат»](wallet-refund.md).

## Разработчикам

{{ dev_schema_source() }}

### Получить программный кошелёк

{{ get_sdk_doc("Queries", "Wallet", "GetProgramWallet") }} | {{ get_graphql_doc("query.getProgramWallet") }}

{{ get_typedoc_desc("Queries.Wallet.GetProgramWallet") }}

{{ get_typedoc_input("Queries.Wallet.GetProgramWallet") }}

Результат:

{{ get_typedoc_definition("Queries.Wallet.GetProgramWallet", "IOutput") }}

### Список программных кошельков

{{ get_sdk_doc("Queries", "Wallet", "GetProgramWallets") }} | {{ get_graphql_doc("query.getProgramWallets") }}

{{ get_typedoc_desc("Queries.Wallet.GetProgramWallets") }}

{{ get_typedoc_input("Queries.Wallet.GetProgramWallets") }}

Результат:

{{ get_typedoc_definition("Queries.Wallet.GetProgramWallets", "IOutput") }}

### Получить информацию об аккаунте

{{ get_sdk_doc("Queries", "Accounts", "GetAccount") }} | {{ get_graphql_doc("Query.getAccount") }}

{{ get_typedoc_desc("Queries.Accounts.GetAccount") }}

{{ get_typedoc_input("Queries.Accounts.GetAccount") }}

Результат:

{{ get_typedoc_definition("Queries.Accounts.GetAccount", "IOutput") }}

### Создать платёж (депозит), модуль Gateway

{{ get_sdk_doc("Mutations", "Gateway", "CreateDepositPayment") }} | {{ get_graphql_doc("Mutation.createDepositPayment") }}

{{ get_typedoc_desc("Mutations.Gateway.CreateDepositPayment") }}

{{ get_typedoc_input("Mutations.Gateway.CreateDepositPayment") }}

Результат:

{{ get_typedoc_definition("Mutations.Gateway.CreateDepositPayment", "IOutput") }}

### Создать платёж (депозит), модуль Wallet

{{ get_sdk_doc("Mutations", "Wallet", "CreateDepositPayment") }} | {{ get_graphql_doc("Mutation.createDepositPayment") }}

{{ get_typedoc_desc("Mutations.Wallet.CreateDepositPayment") }}

{{ get_typedoc_input("Mutations.Wallet.CreateDepositPayment") }}

Результат:

{{ get_typedoc_definition("Mutations.Wallet.CreateDepositPayment", "IOutput") }}

### Создать начальный платёж

{{ get_sdk_doc("Mutations", "Gateway", "CreateInitialPayment") }} | {{ get_graphql_doc("Mutation.createInitialPayment") }}

{{ get_typedoc_desc("Mutations.Gateway.CreateInitialPayment") }}

{{ get_typedoc_input("Mutations.Gateway.CreateInitialPayment") }}

Результат:

{{ get_typedoc_definition("Mutations.Gateway.CreateInitialPayment", "IOutput") }}

### Изменить статус платежа

{{ get_sdk_doc("Mutations", "Gateway", "SetPaymentStatus") }} | {{ get_graphql_doc("Mutation.setPaymentStatus") }}

{{ get_typedoc_desc("Mutations.Gateway.SetPaymentStatus") }}

{{ get_typedoc_input("Mutations.Gateway.SetPaymentStatus") }}

Результат:

{{ get_typedoc_definition("Mutations.Gateway.SetPaymentStatus", "IOutput") }}

### Заявление на возврат паевого взноса (документ)

{{ get_sdk_doc("Mutations", "Wallet", "GenerateReturnByMoneyStatementDocument") }} | {{ get_graphql_doc("Mutation.generateReturnByMoneyStatementDocument") }}

{{ get_typedoc_desc("Mutations.Wallet.GenerateReturnByMoneyStatementDocument") }}

{{ get_typedoc_input("Mutations.Wallet.GenerateReturnByMoneyStatementDocument") }}

Результат:

{{ get_typedoc_definition("Mutations.Wallet.GenerateReturnByMoneyStatementDocument", "IOutput") }}

### Решение совета о возврате паевого взноса (документ)

{{ get_sdk_doc("Mutations", "Wallet", "GenerateReturnByMoneyDecisionDocument") }} | {{ get_graphql_doc("Mutation.generateReturnByMoneyDecisionDocument") }}

{{ get_typedoc_desc("Mutations.Wallet.GenerateReturnByMoneyDecisionDocument") }}

{{ get_typedoc_input("Mutations.Wallet.GenerateReturnByMoneyDecisionDocument") }}

Результат:

{{ get_typedoc_definition("Mutations.Wallet.GenerateReturnByMoneyDecisionDocument", "IOutput") }}



