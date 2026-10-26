---
tags:
  - Председатель
  - Разработчик
---

# Каталог приложений

Стол «Каталог приложений» показывает, что кооператив берёт из платформы, и ведёт подписки кооператива у провайдера подключения. Стол открыт председателю и совету; подписывается, настраивает и включает приложения председатель. Три пункта меню: «Каталог», «Установленные» и «Подписки».

![Витрина](/assets/new/chairman/app-store/01-showcase.png)

Пункт «Каталог» показывает все приложения одной сеткой: встроенные приложения платформы и приложения из каталога. Карточка называет приложение, описание, цену и состояние. Встроенные приложения бесплатны. У приложения из каталога цена указана в месяц, её называет провайдер подключения. Пометка «Установлено» означает, что приложение работает в кооперативе, «Выключено» — что оно установлено, но его столы скрыты, «Пробный период до даты» и «Подключено» — состояние подписки. Нажатие на карточку открывает страницу приложения.

![Установленные](/assets/new/chairman/app-store/02-installed.png)

Пункт «Установленные» оставляет только приложения кооператива: встроенные приложения с установкой и приложения из каталога с действующей подпиской. Столы совета, председателя, пайщика, стол «Каталог приложений», робот совета и стол бухгалтера установлены у каждого кооператива с самого начала.

![Страница приложения](/assets/new/chairman/app-store/03-extension.png)

Страница приложения показывает описание и рабочие столы. Путь один для всех приложений: откройте страницу, прочитайте описание, установите или подпишитесь, настройте, включите. У встроенного приложения слева кнопка «Установить», после установки — «Настройки», переключатель «Включить» / «Выключить» и «Удалить». Выключенное приложение остаётся в кооперативе, его столы скрыты от пайщиков.

У приложения из каталога слева стоит кнопка «Подписаться» или «Попробовать N дней бесплатно», когда издатель назначил пробный период. Окно подписки называет пробный период с датой окончания, цену в месяц и кошелёк, с которого идёт списание: это кошелёк членских взносов кооператива у оператора подключения, пополнить его можно на столе пайщика у оператора. После подписки приложение устанавливается на узел в течение минуты, и его стол появляется в меню. Дальше кнопки те же, что у встроенного: «Настройки», «Выключить» / «Включить» и «Отписаться». Выключенное приложение не грузится на рабочий стол, подписка при этом идёт. Отписка снимает приложение с узла и строку из счёта; пробный период повторно не выдаётся.

![Настройки приложения](/assets/new/chairman/app-store/04-settings.png)

Настройки показывают параметры, которые приложение объявило: числа, переключатели и поля с пояснением к каждому. Кнопка «Сохранить» применяет их сразу. У приложений из каталога настроек пока нет.

## Подписки

Пункт «Подписки» показывает подписки кооператива у провайдера подключения только для чтения: кошелёк членских взносов и AXON у оператора, сумму подписок в месяц, сумму к оплате сейчас, ближайшее списание и таблицу подписок с состоянием и датами. Пополнение кошелька и смена тарифа остаются на столе пайщика кооператива у оператора, в пункте [«Подключение»](../connection/dashboard.md).

## Разработчикам

{{ dev_schema_source() }}

### Приложения каталога на узле

{{ get_sdk_doc("Queries", "Extensions", "AppsCatalogRemotePackages") }} | {{ get_graphql_doc("query.appsCatalogRemotePackages") }}

{{ get_typedoc_desc("Queries.Extensions.AppsCatalogRemotePackages") }}

Результат:

{{ get_typedoc_definition("Queries.Extensions.AppsCatalogRemotePackages", "IOutput") }}

### Подписки и кошелёк узла

{{ get_sdk_doc("Queries", "Extensions", "AppsNodeBilling") }} | {{ get_graphql_doc("query.appsNodeBilling") }}

{{ get_typedoc_desc("Queries.Extensions.AppsNodeBilling") }}

Результат:

{{ get_typedoc_definition("Queries.Extensions.AppsNodeBilling", "IOutput") }}

### Подписаться на приложение

{{ get_sdk_doc("Mutations", "Extensions", "SubscribePackage") }} | {{ get_graphql_doc("Mutation.subscribePackage") }}

{{ get_typedoc_desc("Mutations.Extensions.SubscribePackage") }}

{{ get_typedoc_input("Mutations.Extensions.SubscribePackage") }}

Результат:

{{ get_typedoc_definition("Mutations.Extensions.SubscribePackage", "IOutput") }}

### Отписаться от приложения

{{ get_sdk_doc("Mutations", "Extensions", "UnsubscribePackage") }} | {{ get_graphql_doc("Mutation.unsubscribePackage") }}

{{ get_typedoc_desc("Mutations.Extensions.UnsubscribePackage") }}

{{ get_typedoc_input("Mutations.Extensions.UnsubscribePackage") }}

Результат:

{{ get_typedoc_definition("Mutations.Extensions.UnsubscribePackage", "IOutput") }}

### Включить или выключить приложение каталога

{{ get_sdk_doc("Mutations", "Extensions", "SetCatalogAppEnabled") }} | {{ get_graphql_doc("Mutation.setCatalogAppEnabled") }}

{{ get_typedoc_desc("Mutations.Extensions.SetCatalogAppEnabled") }}

{{ get_typedoc_input("Mutations.Extensions.SetCatalogAppEnabled") }}

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


