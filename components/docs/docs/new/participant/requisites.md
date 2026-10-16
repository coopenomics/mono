---
tags:
  - Пайщик
  - Разработчик
---

# Реквизиты

Реквизиты — способы, которыми пайщик получает деньги от кооператива: возврат паевого взноса, аванс под отчёт, выплаты по программам.

![Реквизиты пайщика](/assets/new/participant/requisites/01-page.png)

У нового пайщика способов нет, страница предлагает добавить банковскую карту или реквизиты. Кнопка «Добавить» в шапке открывает окно с выбором вида: счёт в банке или номер телефона для системы быстрых платежей. Добавленный способ появляется в списке и предлагается в заявлении на возврат взноса.

## Разработчикам

{{ dev_schema_source() }}

### Список платёжных методов

{{ get_sdk_doc("Queries", "PaymentMethods", "GetPaymentMethods") }} | {{ get_graphql_doc("query.getPaymentMethods") }}

{{ get_typedoc_desc("Queries.PaymentMethods.GetPaymentMethods") }}

{{ get_typedoc_input("Queries.PaymentMethods.GetPaymentMethods") }}

Результат:

{{ get_typedoc_definition("Queries.PaymentMethods.GetPaymentMethods", "IOutput") }}

### Добавить реквизиты

{{ get_sdk_doc("Mutations", "PaymentMethods", "AddPaymentMethod") }} | {{ get_graphql_doc("Mutation.addPaymentMethod") }}

{{ get_typedoc_desc("Mutations.PaymentMethods.AddPaymentMethod") }}

{{ get_typedoc_input("Mutations.PaymentMethods.AddPaymentMethod") }}

Результат:

{{ get_typedoc_definition("Mutations.PaymentMethods.AddPaymentMethod", "IOutput") }}

### Обновить банковский счёт

{{ get_sdk_doc("Mutations", "PaymentMethods", "UpdateBankAccount") }} | {{ get_graphql_doc("Mutation.updateBankAccount") }}

{{ get_typedoc_desc("Mutations.PaymentMethods.UpdateBankAccount") }}

{{ get_typedoc_input("Mutations.PaymentMethods.UpdateBankAccount") }}

Результат:

{{ get_typedoc_definition("Mutations.PaymentMethods.UpdateBankAccount", "IOutput") }}

### Удалить платёжный метод

{{ get_sdk_doc("Mutations", "PaymentMethods", "DeletePaymentMethod") }} | {{ get_graphql_doc("Mutation.deletePaymentMethod") }}

{{ get_typedoc_desc("Mutations.PaymentMethods.DeletePaymentMethod") }}

{{ get_typedoc_input("Mutations.PaymentMethods.DeletePaymentMethod") }}

Результат:

{{ get_typedoc_definition("Mutations.PaymentMethods.DeletePaymentMethod", "IOutput") }}


