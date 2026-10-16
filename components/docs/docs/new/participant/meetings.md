---
tags:
  - Пайщик
  - Разработчик
---

# Собрания

Собрания показывают пайщику общие собрания кооператива: предстоящие с повесткой и голосованием, проведённые с протоколом.

![Собрания пайщика](/assets/new/participant/meetings/01-page.png)

У нового кооператива собраний нет. Когда совет созывает собрание, пайщик получает уведомление, здесь появляется собрание с датами и повесткой. Участие пайщика в собрании описано в разделе [«Общие собрания»](../meet/index.md).

## Разработчикам

{{ dev_schema_source() }}

### Одно собрание

{{ get_sdk_doc("Queries", "Meet", "GetMeet") }} | {{ get_graphql_doc("query.getMeet") }}

{{ get_typedoc_desc("Queries.Meet.GetMeet") }}

{{ get_typedoc_input("Queries.Meet.GetMeet") }}

Результат:

{{ get_typedoc_definition("Queries.Meet.GetMeet", "IOutput") }}

### Список собраний

{{ get_sdk_doc("Queries", "Meet", "GetMeets") }} | {{ get_graphql_doc("query.getMeets") }}

{{ get_typedoc_desc("Queries.Meet.GetMeets") }}

{{ get_typedoc_input("Queries.Meet.GetMeets") }}

Результат:

{{ get_typedoc_definition("Queries.Meet.GetMeets", "IOutput") }}

### ОСП: голосование

{{ get_sdk_doc("Mutations", "Meet", "VoteOnAnnualGeneralMeet") }} | {{ get_graphql_doc("Mutation.voteOnAnnualGeneralMeet") }}

{{ get_typedoc_desc("Mutations.Meet.VoteOnAnnualGeneralMeet") }}

{{ get_typedoc_input("Mutations.Meet.VoteOnAnnualGeneralMeet") }}

Результат:

{{ get_typedoc_definition("Mutations.Meet.VoteOnAnnualGeneralMeet", "IOutput") }}

### ОСП: уведомить

{{ get_sdk_doc("Mutations", "Meet", "NotifyOnAnnualGeneralMeet") }} | {{ get_graphql_doc("Mutation.notifyOnAnnualGeneralMeet") }}

{{ get_typedoc_desc("Mutations.Meet.NotifyOnAnnualGeneralMeet") }}

{{ get_typedoc_input("Mutations.Meet.NotifyOnAnnualGeneralMeet") }}

Результат:

{{ get_typedoc_definition("Mutations.Meet.NotifyOnAnnualGeneralMeet", "IOutput") }}

### ОСП: перезапуск

{{ get_sdk_doc("Mutations", "Meet", "RestartAnnualGeneralMeet") }} | {{ get_graphql_doc("Mutation.restartAnnualGeneralMeet") }}

{{ get_typedoc_desc("Mutations.Meet.RestartAnnualGeneralMeet") }}

{{ get_typedoc_input("Mutations.Meet.RestartAnnualGeneralMeet") }}

Результат:

{{ get_typedoc_definition("Mutations.Meet.RestartAnnualGeneralMeet", "IOutput") }}

### ОСП: подпись председателя

{{ get_sdk_doc("Mutations", "Meet", "SignByPresiderOnAnnualGeneralMeet") }} | {{ get_graphql_doc("Mutation.signByPresiderOnAnnualGeneralMeet") }}

{{ get_typedoc_desc("Mutations.Meet.SignByPresiderOnAnnualGeneralMeet") }}

{{ get_typedoc_input("Mutations.Meet.SignByPresiderOnAnnualGeneralMeet") }}

Результат:

{{ get_typedoc_definition("Mutations.Meet.SignByPresiderOnAnnualGeneralMeet", "IOutput") }}

### ОСП: подпись секретаря

{{ get_sdk_doc("Mutations", "Meet", "SignBySecretaryOnAnnualGeneralMeet") }} | {{ get_graphql_doc("Mutation.signBySecretaryOnAnnualGeneralMeet") }}

{{ get_typedoc_desc("Mutations.Meet.SignBySecretaryOnAnnualGeneralMeet") }}

{{ get_typedoc_input("Mutations.Meet.SignBySecretaryOnAnnualGeneralMeet") }}

Результат:

{{ get_typedoc_definition("Mutations.Meet.SignBySecretaryOnAnnualGeneralMeet", "IOutput") }}

Остальные мутации жизненного цикла ОСП (генерация документов повестки, бюллетеня и т.д.) — см. [Реестр собраний стола совета](../council/meetings.md) (тот же модуль `Mutations.Meet.*`).

{{ dev_blockchain_note() }}



