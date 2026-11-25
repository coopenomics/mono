---
tags:
  - Председатель
  - Разработчик
---

# Контакты кооператива

Страница задаёт публичные контакты кооператива. Их видят пайщики в разделе «Контакты кооператива» и гости сайта в подвале страницы.

![Контакты кооператива](/assets/new/chairman/cooperative-contacts/01-page.png)

Поля «Телефон» и «Электронная почта» заполняет председатель, кнопка «Сохранить контакты» применяет их сразу.

## Разработчикам

{{ dev_schema_source() }}

### Системная информация (в т.ч. публичные контакты)

{{ get_sdk_doc("Queries", "System", "GetSystemInfo") }} | {{ get_graphql_doc("query.getSystemInfo") }}

{{ get_typedoc_desc("Queries.System.GetSystemInfo") }}

{{ get_typedoc_input("Queries.System.GetSystemInfo") }}

Результат:

{{ get_typedoc_definition("Queries.System.GetSystemInfo", "IOutput") }}

В ответе поле `contacts` (`ContactsDTO`: телефон, email и др.) соответствует блоку контактов в подвале сайта и на странице «Контакты» у пайщика.

### Запись контактов (как в UI председателя)

Отдельной GraphQL-мутации «только контакты кооператива» нет. Действие `updateaccnt` контракта `registrator` с `meta` в виде JSON (`RegistratorContract.Actions.UpdateAccount`, поля `phone` и `email` в `IAccountMeta` из `@coopenomics/docs-templates`; см. `src/features/User/UpdateMeta` на десктопе).

{{ dev_blockchain_note() }}


