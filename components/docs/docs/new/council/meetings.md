---
tags:
  - Член совета
  - Председатель
  - Разработчик
---

# Реестр собраний

Реестр собраний ведёт общие собрания пайщиков: предстоящие и проведённые. У нового кооператива реестр пуст. Кнопка «Созвать собрание» в шапке начинает созыв.

![Реестр собраний](/assets/new/council/meetings/01-registry.png)

![Созыв общего собрания](/assets/new/council/meetings/02-create.png)

Созыв идёт в два шага. Первый шаг задаёт параметры собрания: тип, председатель и секретарь собрания, даты открытия и закрытия, сведения для пайщиков. Открытие назначается самое раннее через пятнадцать дней. Второй шаг собирает повестку: вопросы и проекты решений по ним. Документ повестки направляется в совет на решение. После решения собрание запланировано, пайщики получают уведомление с повесткой на подпись. Ход собрания и голосование описаны в разделе [«Общие собрания»](../meet/index.md).

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

### Повестка (для контекста собрания)

{{ get_sdk_doc("Queries", "Agenda", "GetAgenda") }} | {{ get_graphql_doc("query.getAgenda") }}

{{ get_typedoc_desc("Queries.Agenda.GetAgenda") }}

{{ get_typedoc_input("Queries.Agenda.GetAgenda") }}

Результат:

{{ get_typedoc_definition("Queries.Agenda.GetAgenda", "IOutput") }}

### ОСП: создать собрание

{{ get_sdk_doc("Mutations", "Meet", "CreateAnnualGeneralMeet") }} | {{ get_graphql_doc("Mutation.createAnnualGeneralMeet") }}

{{ get_typedoc_desc("Mutations.Meet.CreateAnnualGeneralMeet") }}

{{ get_typedoc_input("Mutations.Meet.CreateAnnualGeneralMeet") }}

Результат:

{{ get_typedoc_definition("Mutations.Meet.CreateAnnualGeneralMeet", "IOutput") }}

### ОСП: уведомление (генерация документа)

{{ get_sdk_doc("Mutations", "Meet", "GenerateAnnualGeneralMeetNotificationDocument") }} | {{ get_graphql_doc("Mutation.generateAnnualGeneralMeetNotificationDocument") }}

{{ get_typedoc_desc("Mutations.Meet.GenerateAnnualGeneralMeetNotificationDocument") }}

{{ get_typedoc_input("Mutations.Meet.GenerateAnnualGeneralMeetNotificationDocument") }}

Результат:

{{ get_typedoc_definition("Mutations.Meet.GenerateAnnualGeneralMeetNotificationDocument", "IOutput") }}

### ОСП: повестка (генерация документа)

{{ get_sdk_doc("Mutations", "Meet", "GenerateAnnualGeneralMeetAgendaDocument") }} | {{ get_graphql_doc("Mutation.generateAnnualGeneralMeetAgendaDocument") }}

{{ get_typedoc_desc("Mutations.Meet.GenerateAnnualGeneralMeetAgendaDocument") }}

{{ get_typedoc_input("Mutations.Meet.GenerateAnnualGeneralMeetAgendaDocument") }}

Результат:

{{ get_typedoc_definition("Mutations.Meet.GenerateAnnualGeneralMeetAgendaDocument", "IOutput") }}

### ОСП: решение (генерация документа)

{{ get_sdk_doc("Mutations", "Meet", "GenerateAnnualGeneralMeetDecisionDocument") }} | {{ get_graphql_doc("Mutation.generateAnnualGeneralMeetDecisionDocument") }}

{{ get_typedoc_desc("Mutations.Meet.GenerateAnnualGeneralMeetDecisionDocument") }}

{{ get_typedoc_input("Mutations.Meet.GenerateAnnualGeneralMeetDecisionDocument") }}

Результат:

{{ get_typedoc_definition("Mutations.Meet.GenerateAnnualGeneralMeetDecisionDocument", "IOutput") }}

### ОСП: бюллетень (генерация документа)

{{ get_sdk_doc("Mutations", "Meet", "GenerateBallotForAnnualGeneralMeetDocument") }} | {{ get_graphql_doc("Mutation.generateBallotForAnnualGeneralMeetDocument") }}

{{ get_typedoc_desc("Mutations.Meet.GenerateBallotForAnnualGeneralMeetDocument") }}

{{ get_typedoc_input("Mutations.Meet.GenerateBallotForAnnualGeneralMeetDocument") }}

Результат:

{{ get_typedoc_definition("Mutations.Meet.GenerateBallotForAnnualGeneralMeetDocument", "IOutput") }}

### ОСП: решение совета по итогам (генерация документа)

{{ get_sdk_doc("Mutations", "Meet", "GenerateSovietDecisionOnAnnualMeetDocument") }} | {{ get_graphql_doc("Mutation.generateSovietDecisionOnAnnualMeetDocument") }}

{{ get_typedoc_desc("Mutations.Meet.GenerateSovietDecisionOnAnnualMeetDocument") }}

{{ get_typedoc_input("Mutations.Meet.GenerateSovietDecisionOnAnnualMeetDocument") }}

Результат:

{{ get_typedoc_definition("Mutations.Meet.GenerateSovietDecisionOnAnnualMeetDocument", "IOutput") }}

### ОСП: уведомить

{{ get_sdk_doc("Mutations", "Meet", "NotifyOnAnnualGeneralMeet") }} | {{ get_graphql_doc("Mutation.notifyOnAnnualGeneralMeet") }}

{{ get_typedoc_desc("Mutations.Meet.NotifyOnAnnualGeneralMeet") }}

{{ get_typedoc_input("Mutations.Meet.NotifyOnAnnualGeneralMeet") }}

Результат:

{{ get_typedoc_definition("Mutations.Meet.NotifyOnAnnualGeneralMeet", "IOutput") }}

### ОСП: голосование

{{ get_sdk_doc("Mutations", "Meet", "VoteOnAnnualGeneralMeet") }} | {{ get_graphql_doc("Mutation.voteOnAnnualGeneralMeet") }}

{{ get_typedoc_desc("Mutations.Meet.VoteOnAnnualGeneralMeet") }}

{{ get_typedoc_input("Mutations.Meet.VoteOnAnnualGeneralMeet") }}

Результат:

{{ get_typedoc_definition("Mutations.Meet.VoteOnAnnualGeneralMeet", "IOutput") }}

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

### ОСП: перезапуск

{{ get_sdk_doc("Mutations", "Meet", "RestartAnnualGeneralMeet") }} | {{ get_graphql_doc("Mutation.restartAnnualGeneralMeet") }}

{{ get_typedoc_desc("Mutations.Meet.RestartAnnualGeneralMeet") }}

{{ get_typedoc_input("Mutations.Meet.RestartAnnualGeneralMeet") }}

Результат:

{{ get_typedoc_definition("Mutations.Meet.RestartAnnualGeneralMeet", "IOutput") }}

{{ dev_blockchain_note() }}


