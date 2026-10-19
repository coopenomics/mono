---
tags:
  - Пайщик
  - Разработчик
---

# Документы

Документы показывают пайщику всё, что он подписал в кооперативе, и решения совета по его заявлениям.

![Документы пайщика](/assets/new/participant/documents/01-page.png)

Строка документа показывает заголовок, дату подписи и подписанта. На кадре согласия с условиями пользовательского соглашения, положения о простой электронной подписи и политики обработки конфиденциальных данных, их пайщик подписал при первом входе. Нажатие на документ открывает его текст, значок справа скачивает документ файлом. Поиск в шапке ищет по заголовку.

## Разработчикам

{{ dev_schema_source() }}

### Список документов

{{ get_sdk_doc("Queries", "Documents", "GetDocuments") }} | {{ get_graphql_doc("query.getDocuments") }}

{{ get_typedoc_desc("Queries.Documents.GetDocuments") }}

{{ get_typedoc_input("Queries.Documents.GetDocuments") }}

Результат:

{{ get_typedoc_definition("Queries.Documents.GetDocuments", "IOutput") }}

### Поиск документов

{{ get_sdk_doc("Queries", "Search", "SearchDocuments") }} | {{ get_graphql_doc("query.searchDocuments") }}

{{ get_typedoc_desc("Queries.Search.SearchDocuments") }}

{{ get_typedoc_input("Queries.Search.SearchDocuments") }}

Результат:

{{ get_typedoc_definition("Queries.Search.SearchDocuments", "IOutput") }}

Класс для подписи содержимого документов: {{ get_class_doc("Classes", "Document") }}.



 