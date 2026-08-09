---
tags:
  - Председатель
  - Разработчик
---

Магазин приложений - это способ, которым кооператив берет из экосистемы то, что ему нужно. Магазин предоставляет приложения, которые расширяют [Навигатор](../navigator/index.md) новыми рабочими столами, а также включают фоновые утилиты для автоматизации бизнес-процессов в кооперации. 

![запросы одобрений](/assets/new/chairman_apps_1.png)

При установке приложений с рабочими столами, все пайщики кооператива немедленно получают к ним доступ согласно своей роли в кооперативе. Страницы рабочих столов, которые должны быть доступны только председателю и членам совета, будут видны только председателю и членам совета. 

При установке приложений без рабочих столов, цифровой кооператив получает новые маршруты API (например, для приема платежей через Yookassa), включает фоновые задания и т.д. и т.п. Такие приложения являются утилитами и служат для автоматизации процессов. Их можно только установить, настроить и включить/отключить, при этом, визуально в [Навигаторе](../navigator/index.md) они не видны. 

![запросы одобрений](/assets/new/chairman_apps_2.png)

Доступом к магазину приложений обладает только председатель совета. Председатель совета устанавливает приложения с рабочими столами, тем самым, расширяя Навигатор и функционал своего цифрового кооператива. А редактируя [Стартовые страницы](start-pages.md), председатель устанавливает то, что увидят пайщики при входе на сайт. 

Таким образом, с помощью магазина приложений председатель цифрового кооператива может взять в свой кооператив только то, что ему нужно, и отобразить так, как ему нужно, настроив главную страницу, например, как "Стол заказов - Витрина". Тогда все посетители сайта будут видеть витрину стола заказов при входе на сайт. 


!!!note "О том, что это будет"
    Мы исследуем возможность создания магазина PWA-приложений (которые устанавливаются нажатием на кнопку "добавить на домашний экран"). Он позволит пайщикам устанавливать на рабочие столы своих устройств кооперативные приложения из магазина кооператива, которые не будут содержать избыточной информации о других установленных в кооперативе рабочих столах. Например, таким приложеним может быть "Стол заказов", которое при установке на устройство пайщика добавит иконку, организовав прямой и быстрый доступ только на стол заказов конкретного цифрового кооператива, и скрыв все другие столы. На текущий момент мы только исследуем эту возможность. Шагов по реализации пока не предпринимается. 

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


