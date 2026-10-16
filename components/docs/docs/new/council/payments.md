---
tags:
  - Член совета
  - Председатель
  - Разработчик
---

# Реестр платежей

Реестр платежей показывает все деньги кооператива в движении. Входящие платежи — паевые взносы пайщиков. Исходящие платежи — выплаты по решениям совета: возвраты паевых взносов и оплата расходов. Реестр на столе совета открыт на чтение. Подтверждает платежи кассир на [своём столе](../cashier/payments.md), председатель делает это и здесь.

![Реестр платежей](/assets/new/council/payments/01-registry.png)

Строка платежа показывает пайщика, дату, сумму со стрелкой направления, тип платежа и состояние. Стрелка вниз означает входящий платёж, стрелка вверх — исходящий. Входящий паевой взнос ждёт кассира в состоянии «Ожидает обработки». Пайщик заявил этот взнос в своём кошельке и получил реквизиты для перевода.

![Платёж целиком](/assets/new/council/payments/02-payment.png)

Нажатие на строку раскрывает платёж: назначение с номером соглашения о программе, сумма к переводу и комиссия. Кассир сверяет поступление по выписке банка кооператива. В колонке действий две кнопки, «Подтвердить» и «Отклонить».

![Подтверждение платежа](/assets/new/council/payments/03-confirm.png)

Кнопка «Подтвердить» открывает окно с последствиями отметки. Платёж кандидата в пайщики отправляет в совет пакет документов на приём. Платёж пайщика зачисляет паевой взнос в его кошелёк.

![Платёж завершён](/assets/new/council/payments/04-paid.png)

После подтверждения состояние «Завершён», взнос лежит в кошельке пайщика. Кнопка «Отклонить» нужна для платежа, который так и не пришёл или пришёл с чужого счёта. Исходящий платёж по решению совета кассир подтверждает после перевода денег получателю, отклонить его нельзя: решение принял совет. Путь исходящих платежей по расходам описан в разделе [«Расходы»](../expenses/cashier.md).

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



