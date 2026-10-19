---
tags:
  - Член совета
  - Председатель
  - Разработчик
---

# Повестка совета

Повестка совета собирает вопросы, по которым совету предстоит принять решение. Вопрос ставит в повестку заявление пайщика, служебная записка члена совета, приложение кооператива или председатель кнопкой «Предложить». Совет голосует по каждому вопросу, председатель утверждает принятое решение.

![Повестка совета](/assets/new/council/agenda/01-agenda.png)

Карточка вопроса показывает номер, тему, заявителя и срок. Справа счётчики голосов «против» и «за», они же кнопки голосования. На кадре три вопроса: служебная записка о расходах от члена совета и два утверждения редакций документов, их вынес председатель из реестра шаблонов. Внизу карточки ссылка «Подробнее» и кнопка «Утвердить» для председателя. Вопрос живёт в повестке месяц.

![Правая панель вопроса](/assets/new/council/agenda/02-drawer.png)

Нажатие на строку вопроса открывает правую панель. В ней тема, заявитель и документы вопроса, документ раскрывается стрелкой. Внизу панели голосование и утверждение. Ссылка «Открыть страницу» ведёт на страницу вопроса.

![Вопрос целиком](/assets/new/council/agenda/02b-question.png)

Страница вопроса повторяет панель во весь экран: номер, срок, тема, заявитель, документы, голосование и утверждение. У утверждения редакции документ вопроса содержит проект решения с текстом новой редакции и хэшем этого текста.

![Голос принят](/assets/new/council/agenda/03-voted.png)

Член совета голосует одной из двух кнопок. После голоса кнопка «за» подсвечена, счётчик показывает один голос, под ним имя члена совета. Голос отдаётся один раз. Кнопка «Утвердить» станет активной, когда «за» проголосует больше половины совета.

![Большинство набрано](/assets/new/council/agenda/04-quorum.png)

Проголосовали ещё два члена совета: три голоса «за» из трёх, под счётчиком три имени. Кнопка «Утвердить» активна.

Голос «против» работает так же. Когда «против» проголосовало больше половины совета, вопрос отклонён. У председателя вместо «Утвердить» появляется «Отклонить», она снимает вопрос с повестки без протокола. Вопрос, по которому большинство так и осталось без решения, уходит из повестки сам по истечении срока.

![Решение утверждено](/assets/new/council/agenda/05-authorized.png)

Председатель нажимает «Утвердить». Платформа собирает протокол решения совета, председатель подписывает его ключом, решение исполняется. Вопрос уходит из повестки, страница вопроса сообщает об этом. Протокол лежит в реестре документов.

Исполнение зависит от типа решения. Утверждение редакции переводит кооператив на новую редакцию шаблона. Служебная записка о расходах заводит платежи по своим строкам в реестр платежей. Приём пайщика добавляет его в реестр пайщиков. Свободное решение исполняют люди, совет следит за исполнением сам.

## Предложить вопрос

Кнопка «Предложить» в шапке повестки ставит в повестку свободный вопрос. Председатель или член совета вводит вопрос и проект решения, платформа собирает документ предложения и ставит вопрос в повестку. Дальше вопрос идёт тем же путём: голоса совета, утверждение председателем, протокол в реестре документов.

## Разработчикам

{{ dev_schema_source() }}

### Повестка совета

{{ get_sdk_doc("Queries", "Agenda", "GetAgenda") }} | {{ get_graphql_doc("query.getAgenda") }}

{{ get_typedoc_desc("Queries.Agenda.GetAgenda") }}

{{ get_typedoc_input("Queries.Agenda.GetAgenda") }}

Результат:

{{ get_typedoc_definition("Queries.Agenda.GetAgenda", "IOutput") }}

### Документы (контекст вопросов)

{{ get_sdk_doc("Queries", "Documents", "GetDocuments") }} | {{ get_graphql_doc("query.getDocuments") }}

{{ get_typedoc_desc("Queries.Documents.GetDocuments") }}

{{ get_typedoc_input("Queries.Documents.GetDocuments") }}

Результат:

{{ get_typedoc_definition("Queries.Documents.GetDocuments", "IOutput") }}

### Свободное решение: создать проект

{{ get_sdk_doc("Mutations", "FreeDecisions", "CreateProjectOfFreeDecision") }} | {{ get_graphql_doc("Mutation.createProjectOfFreeDecision") }}

{{ get_typedoc_desc("Mutations.FreeDecisions.CreateProjectOfFreeDecision") }}

{{ get_typedoc_input("Mutations.FreeDecisions.CreateProjectOfFreeDecision") }}

Результат:

{{ get_typedoc_definition("Mutations.FreeDecisions.CreateProjectOfFreeDecision", "IOutput") }}

### Свободное решение: сгенерировать документ

{{ get_sdk_doc("Mutations", "FreeDecisions", "GenerateFreeDecision") }} | {{ get_graphql_doc("Mutation.generateFreeDecision") }}

{{ get_typedoc_desc("Mutations.FreeDecisions.GenerateFreeDecision") }}

{{ get_typedoc_input("Mutations.FreeDecisions.GenerateFreeDecision") }}

Результат:

{{ get_typedoc_definition("Mutations.FreeDecisions.GenerateFreeDecision", "IOutput") }}

### Свободное решение: сгенерировать проект

{{ get_sdk_doc("Mutations", "FreeDecisions", "GenerateProjectOfFreeDecision") }} | {{ get_graphql_doc("Mutation.generateProjectOfFreeDecision") }}

{{ get_typedoc_desc("Mutations.FreeDecisions.GenerateProjectOfFreeDecision") }}

{{ get_typedoc_input("Mutations.FreeDecisions.GenerateProjectOfFreeDecision") }}

Результат:

{{ get_typedoc_definition("Mutations.FreeDecisions.GenerateProjectOfFreeDecision", "IOutput") }}

### Свободное решение: опубликовать проект

{{ get_sdk_doc("Mutations", "FreeDecisions", "PublishProjectOfFreeDecision") }} | {{ get_graphql_doc("Mutation.publishProjectOfFreeDecision") }}

{{ get_typedoc_desc("Mutations.FreeDecisions.PublishProjectOfFreeDecision") }}

{{ get_typedoc_input("Mutations.FreeDecisions.PublishProjectOfFreeDecision") }}

Результат:

{{ get_typedoc_definition("Mutations.FreeDecisions.PublishProjectOfFreeDecision", "IOutput") }}

{{ dev_blockchain_note() }}

