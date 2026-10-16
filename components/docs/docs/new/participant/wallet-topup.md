---
tags:
  - Пайщик
  - Разработчик
---

# Паевой взнос

Паевой взнос пополняет главный кошелёк пайщика. Пайщик называет сумму, платформа заводит платёж через провайдера платежей кооператива и показывает реквизиты.

![Сумма взноса](/assets/new/participant/wallet/02-deposit.png)

Кнопка «Совершить взнос» в шапке кошелька открывает окно с суммой. Кнопка «Продолжить» заводит платёж.

![Реквизиты взноса](/assets/new/participant/wallet/03-deposit-payment.png)

Второе окно показывает сумму с комиссией провайдера, получателя, назначение платежа с номером соглашения о программе и код для оплаты. Код сканируется любым банковским приложением, кнопка «Скачать QR» сохраняет его картинкой, кнопка «Показать реквизиты» даёт реквизиты для перевода вручную. Платёж нужно сделать с банковского счёта самого пайщика, перевод с чужого счёта кооператив аннулирует. После оплаты кассир кооператива подтверждает поступление в реестре платежей, и взнос появляется в главном кошельке.

## Разработчикам

{{ dev_schema_source() }}

### Создать платёж (депозит / пополнение)

{{ get_sdk_doc("Mutations", "Gateway", "CreateDepositPayment") }} | {{ get_graphql_doc("Mutation.createDepositPayment") }}

{{ get_typedoc_desc("Mutations.Gateway.CreateDepositPayment") }}

{{ get_typedoc_input("Mutations.Gateway.CreateDepositPayment") }}

Результат:

{{ get_typedoc_definition("Mutations.Gateway.CreateDepositPayment", "IOutput") }}

### Изменить статус платежа

{{ get_sdk_doc("Mutations", "Gateway", "SetPaymentStatus") }} | {{ get_graphql_doc("Mutation.setPaymentStatus") }}

{{ get_typedoc_desc("Mutations.Gateway.SetPaymentStatus") }}

{{ get_typedoc_input("Mutations.Gateway.SetPaymentStatus") }}

Результат:

{{ get_typedoc_definition("Mutations.Gateway.SetPaymentStatus", "IOutput") }}

### Список платежей

{{ get_sdk_doc("Queries", "Gateway", "GetPayments") }} | {{ get_graphql_doc("query.getPayments") }}

{{ get_typedoc_desc("Queries.Gateway.GetPayments") }}

{{ get_typedoc_input("Queries.Gateway.GetPayments") }}

Результат:

{{ get_typedoc_definition("Queries.Gateway.GetPayments", "IOutput") }}

### Баланс программного кошелька

{{ get_sdk_doc("Queries", "Wallet", "GetProgramWallet") }} | {{ get_graphql_doc("query.getProgramWallet") }}

{{ get_typedoc_desc("Queries.Wallet.GetProgramWallet") }}

{{ get_typedoc_input("Queries.Wallet.GetProgramWallet") }}

Результат:

{{ get_typedoc_definition("Queries.Wallet.GetProgramWallet", "IOutput") }}

