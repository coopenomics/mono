# Системная информация

Системная информация включает в себя данные о конфигурации кооператива, состоянии блокчейна, версии программного обеспечения и другие технические параметры, необходимые для корректной работы платформы MONO.

## Получить системную информацию
{{ get_sdk_doc("Queries", "System", "GetSystemInfo") }} | {{ get_graphql_doc("Query.getSystemInfo") }}

{{ get_typedoc_input("Queries.System.GetSystemInfo") }}

Результат:

{{ get_typedoc_definition("Queries.System.GetSystemInfo", "IOutput") }}

Метод возвращает публичную информацию о системе, включая настройки кооператива, версии компонентов и текущее состояние.

## Инициализация системы
{{ get_sdk_doc("Mutations", "System", "InitSystem") }} | {{ get_graphql_doc("Mutation.initSystem") }}

{{ get_typedoc_input("Mutations.System.InitSystem") }}

Результат:

{{ get_typedoc_definition("Mutations.System.InitSystem", "IOutput") }}

Произвести инициализацию программного обеспечения перед установкой совета методом install.

## Установка совета
{{ get_sdk_doc("Mutations", "System", "InstallSystem") }} | {{ get_graphql_doc("Mutation.installSystem") }}

{{ get_typedoc_input("Mutations.System.InstallSystem") }}

Результат:

{{ get_typedoc_definition("Mutations.System.InstallSystem", "IOutput") }}

Произвести установку членов совета перед началом работы.

## Обновление параметров
{{ get_sdk_doc("Mutations", "System", "UpdateSystem") }} | {{ get_graphql_doc("Mutation.updateSystem") }}

{{ get_typedoc_input("Mutations.System.UpdateSystem") }}

Результат:

{{ get_typedoc_definition("Mutations.System.UpdateSystem", "IOutput") }}

Обновить параметры системы.

## Сохранение приватного ключа
{{ get_sdk_doc("Mutations", "System", "SaveWif") }} | {{ get_graphql_doc("Mutation.setWif") }}

{{ get_typedoc_input("Mutations.System.SaveWif") }}

Результат:

{{ get_typedoc_definition("Mutations.System.SaveWif", "IOutput") }}

Сохранить приватный ключ в зашифрованном серверном хранилище.
