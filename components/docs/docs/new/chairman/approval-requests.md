---
tags:
  - Председатель
  - Разработчик
---

# Запросы одобрений

Запросы одобрений собирают документы, которые ждут подписи председателя. Пайщик подписывает документ первым, председатель ставит вторую подпись от имени кооператива. Сюда сходятся запросы всех приложений кооператива: договоры участия в хозяйственной деятельности, акты приёма результатов, доверенности и договоры председателей участков.

![Запросы одобрений](/assets/new/chairman/approval-requests/01-list.png)

Строка запроса показывает пайщика с учётным именем, действие, состояние и дату. Счётчик у пункта меню считает запросы в состоянии «Ожидает». Поиск в шапке ищет по пайщику. Флажки слева отбирают несколько запросов, чтобы одобрить их разом.

![Запрос целиком](/assets/new/chairman/approval-requests/02-request.png)

Нажатие на строку открывает запрос в правой панели: пайщик, учётное имя, действие, дата и состояние. Ниже документ с подписью пайщика, он раскрывается стрелкой. Внизу панели две кнопки. «Одобрить» ставит подпись председателя, «Отклонить» возвращает документ пайщику с причиной.

![Подтверждение одобрения](/assets/new/chairman/approval-requests/03-confirm.png)

Кнопка «Одобрить» просит подтверждения. После него председатель подписывает документ ключом, и приложение, которое прислало запрос, продолжает свой процесс. У договора участия в хозяйственной деятельности это означает, что пайщик допущен к работе в программе.

![Запрос одобрен](/assets/new/chairman/approval-requests/04-signed.png)

Одобренный запрос исчезает из списка ожидающих, счётчик гаснет. Отбор по состоянию показывает одобренные и отклонённые запросы.

## Разработчикам

{{ dev_schema_source() }}

### Список запросов на одобрение

{{ get_sdk_doc("Queries", "Chairman", "GetApprovals") }} | {{ get_graphql_doc("query.chairmanApprovals") }}

{{ get_typedoc_desc("Queries.Chairman.GetApprovals") }}

{{ get_typedoc_input("Queries.Chairman.GetApprovals") }}

Результат:

{{ get_typedoc_definition("Queries.Chairman.GetApprovals", "IOutput") }}

### Один запрос на одобрение

{{ get_sdk_doc("Queries", "Chairman", "GetApproval") }} | {{ get_graphql_doc("query.chairmanApproval") }}

{{ get_typedoc_desc("Queries.Chairman.GetApproval") }}

{{ get_typedoc_input("Queries.Chairman.GetApproval") }}

Результат:

{{ get_typedoc_definition("Queries.Chairman.GetApproval", "IOutput") }}

### Подтвердить одобрение

{{ get_sdk_doc("Mutations", "Chairman", "ConfirmApprove") }} | {{ get_graphql_doc("Mutation.chairmanConfirmApprove") }}

{{ get_typedoc_desc("Mutations.Chairman.ConfirmApprove") }}

{{ get_typedoc_input("Mutations.Chairman.ConfirmApprove") }}

Результат:

{{ get_typedoc_definition("Mutations.Chairman.ConfirmApprove", "IOutput") }}

### Отклонить одобрение

{{ get_sdk_doc("Mutations", "Chairman", "DeclineApprove") }} | {{ get_graphql_doc("Mutation.chairmanDeclineApprove") }}

{{ get_typedoc_desc("Mutations.Chairman.DeclineApprove") }}

{{ get_typedoc_input("Mutations.Chairman.DeclineApprove") }}

Результат:

{{ get_typedoc_definition("Mutations.Chairman.DeclineApprove", "IOutput") }}

{{ dev_blockchain_note() }}


