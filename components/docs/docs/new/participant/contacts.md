---
tags:
  - Пайщик
  - Разработчик
---

# Контакты

Контакты показывают пайщику, как связаться с кооперативом, и его реквизиты.

![Контакты кооператива](/assets/new/participant/contacts/01-page.png)

Страница показывает полное наименование кооператива, ИНН, ОГРН, председателя совета, телефон, почту и адрес. Телефон и почту задаёт председатель на странице [«Контакты кооператива»](../chairman/cooperative-contacts.md).

## Разработчикам

{{ dev_schema_source() }}

### Системная информация (контакты и сводка по кооперативу)

{{ get_sdk_doc("Queries", "System", "GetSystemInfo") }} | {{ get_graphql_doc("query.getSystemInfo") }}

{{ get_typedoc_desc("Queries.System.GetSystemInfo") }}

{{ get_typedoc_input("Queries.System.GetSystemInfo") }}

Результат:

{{ get_typedoc_definition("Queries.System.GetSystemInfo", "IOutput") }}

Публичные контакты и реквизиты на этой странице соответствуют полю `contacts` и связанным данным в типе `SystemInfo`.



