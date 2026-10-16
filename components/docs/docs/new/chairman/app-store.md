---
tags:
  - Председатель
  - Разработчик
---

# Каталог приложений

Каталог приложений показывает, что кооператив берёт из платформы. Приложение с рабочими столами даёт пайщикам новые столы и страницы, приложение без столов добавляет кооперативу способ приёма платежей или другую службу. Каталог открыт председателю.

![Витрина](/assets/new/chairman/app-store/01-showcase.png)

Вкладка «Витрина» показывает все приложения платформы карточками с описанием и состоянием. «Установлено» означает, что приложение работает в кооперативе, «В разработке» означает, что приложение ещё готовится. Ссылка «Подробнее» открывает страницу приложения.

![Установленные](/assets/new/chairman/app-store/02-installed.png)

Вкладка «Установленные» оставляет только приложения кооператива. Столы совета, председателя и пайщика, робот совета и стол бухгалтера установлены у каждого кооператива с самого начала.

![Страница приложения](/assets/new/chairman/app-store/03-extension.png)

Страница приложения показывает описание, рабочие столы и инструкцию. Слева кнопка «Настройки», переключатель «включено» и действие «удалить». Выключенное приложение остаётся в кооперативе, его столы скрыты от пайщиков. На кадре Стол заказов с четырьмя столами: заказчика, поставщика, пункта выдачи и администратора.

![Настройки приложения](/assets/new/chairman/app-store/04-settings.png)

Настройки показывают параметры, которые приложение объявило: числа, переключатели и поля с пояснением к каждому. Кнопка «Сохранить» применяет их сразу.

## Разработчикам

{{ dev_schema_source() }}

### Список расширений

{{ get_sdk_doc("Queries", "Extensions", "GetExtensions") }} | {{ get_graphql_doc("query.getExtensions") }}

{{ get_typedoc_desc("Queries.Extensions.GetExtensions") }}

{{ get_typedoc_input("Queries.Extensions.GetExtensions") }}

Результат:

{{ get_typedoc_definition("Queries.Extensions.GetExtensions", "IOutput") }}

### Логи расширений

{{ get_sdk_doc("Queries", "Extensions", "GetExtensionLogs") }} | {{ get_graphql_doc("query.getExtensionLogs") }}

{{ get_typedoc_desc("Queries.Extensions.GetExtensionLogs") }}

{{ get_typedoc_input("Queries.Extensions.GetExtensionLogs") }}

Результат:

{{ get_typedoc_definition("Queries.Extensions.GetExtensionLogs", "IOutput") }}

### Рабочие столы (контекст магазина)

{{ get_sdk_doc("Queries", "Desktop", "GetDesktop") }} | {{ get_graphql_doc("query.getDesktop") }}

{{ get_typedoc_desc("Queries.Desktop.GetDesktop") }}

{{ get_typedoc_input("Queries.Desktop.GetDesktop") }}

Результат:

{{ get_typedoc_definition("Queries.Desktop.GetDesktop", "IOutput") }}

### Установить расширение

{{ get_sdk_doc("Mutations", "Extensions", "InstallExtension") }} | {{ get_graphql_doc("Mutation.installExtension") }}

{{ get_typedoc_desc("Mutations.Extensions.InstallExtension") }}

{{ get_typedoc_input("Mutations.Extensions.InstallExtension") }}

Результат:

{{ get_typedoc_definition("Mutations.Extensions.InstallExtension", "IOutput") }}

### Обновить расширение

{{ get_sdk_doc("Mutations", "Extensions", "UpdateExtension") }} | {{ get_graphql_doc("Mutation.updateExtension") }}

{{ get_typedoc_desc("Mutations.Extensions.UpdateExtension") }}

{{ get_typedoc_input("Mutations.Extensions.UpdateExtension") }}

Результат:

{{ get_typedoc_definition("Mutations.Extensions.UpdateExtension", "IOutput") }}

### Удалить расширение

{{ get_sdk_doc("Mutations", "Extensions", "UninstallExtension") }} | {{ get_graphql_doc("Mutation.uninstallExtension") }}

{{ get_typedoc_desc("Mutations.Extensions.UninstallExtension") }}

{{ get_typedoc_input("Mutations.Extensions.UninstallExtension") }}

Результат:

{{ get_typedoc_definition("Mutations.Extensions.UninstallExtension", "IOutput") }}


