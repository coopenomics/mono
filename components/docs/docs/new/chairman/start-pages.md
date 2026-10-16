---
tags:
  - Председатель
  - Разработчик
---

# Стартовые страницы

Стартовые страницы задают, какой стол и какая страница открываются при входе на сайт кооператива. Настройка задаётся отдельно для вошедших пайщиков и для гостей.

![Стартовые страницы](/assets/new/chairman/start-pages/01-page.png)

Для вошедшего пайщика на кадре открывается кошелёк на столе пайщика. Для гостя открывается регистрация пайщика на том же столе. Пайщик, который уже работал на сайте, попадает на стол, где был в прошлый раз. Кнопка «Сбросить» возвращает поля к сохранённым значениям, кнопка «Сохранить» применяет новые.

## Разработчикам

{{ dev_schema_source() }}

### Настройки системы

{{ get_sdk_doc("Mutations", "System", "UpdateSettings") }} | {{ get_graphql_doc("Mutation.updateSettings") }}

{{ get_typedoc_desc("Mutations.System.UpdateSettings") }}

{{ get_typedoc_input("Mutations.System.UpdateSettings") }}

Результат:

{{ get_typedoc_definition("Mutations.System.UpdateSettings", "IOutput") }}

### Рабочие столы (десктоп)

{{ get_sdk_doc("Queries", "Desktop", "GetDesktop") }} | {{ get_graphql_doc("query.getDesktop") }}

{{ get_typedoc_desc("Queries.Desktop.GetDesktop") }}

{{ get_typedoc_input("Queries.Desktop.GetDesktop") }}

Результат:

{{ get_typedoc_definition("Queries.Desktop.GetDesktop", "IOutput") }}

### Системная информация

{{ get_sdk_doc("Queries", "System", "GetSystemInfo") }} | {{ get_graphql_doc("query.getSystemInfo") }}

{{ get_typedoc_desc("Queries.System.GetSystemInfo") }}

{{ get_typedoc_input("Queries.System.GetSystemInfo") }}

Результат:

{{ get_typedoc_definition("Queries.System.GetSystemInfo", "IOutput") }}

