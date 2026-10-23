---
tags:
  - Член совета
  - Председатель
  - Разработчик
---

# Реестр пайщиков

Реестр пайщиков хранит анкеты всех пайщиков кооператива. Совет находит здесь пайщика, сверяет его личность и открывает его документы, кошельки и платежи.

![Реестр пайщиков](/assets/new/council/participants/01-registry.png)

Вкладка «Пайщики» показывает ФИО или наименование, учётное имя, почту, дату добавления в реестр и дату вступления. Счётчик у вкладки считает пайщиков. Отбор «Верификация» оставляет пайщиков по состоянию сверки личности: с базовой сверкой по паспорту, без неё или без сверки вовсе. Кнопка «Добавить» вносит в реестр действующего пайщика, кнопка «Импорт» загружает пайщиков списком.

![Верификации](/assets/new/council/participants/02-verifications.png)

Вкладка «Верификации» ведёт журнал сверок личности: пайщик, где и кто сверял, дата и состояние. Сверку проводит председатель участка или совет при личной встрече с пайщиком по паспорту.

![Правая панель пайщика](/assets/new/council/participants/03-panel.png)

Нажатие на строку открывает правую панель с анкетой пайщика. Сверху состояние верификации. «Начальный» означает, что личность подтверждена платежом паевого взноса с банковского счёта пайщика. Кнопка «Подтвердить личность» фиксирует сверку паспорта. Ниже состояние приложения двойной аутентификации и поля анкеты: почта, ФИО, дата рождения, телефон, данные паспорта. Ссылка «Открыть страницу» ведёт на страницу пайщика.

![Страница пайщика](/assets/new/council/participants/04-participant.png)

Страница пайщика собирает всё о нём в одном месте. В шапке ФИО, учётное имя, почта и состояние членства. Под шапкой та же анкета с верификацией, что и в панели. Ссылка «К реестру пайщиков» возвращает в список.

## Добавление пайщика

Кнопка «Добавить» вносит в реестр пайщика, который уже принят в кооператив по бумажному заявлению. Совет вводит его анкету, пайщик получает приглашение на почту и заводит себе ключ подписи. Приём нового пайщика идёт другим путём, через заявление на вступление и решение совета в повестке.

## Разработчикам

{{ dev_schema_source() }}

### Кандидаты на вступление (`candidates`)

{{ get_graphql_doc("query.candidates") }}

Селектор запроса и типы входа — в `src/queries/registration/getCandidates.ts` (модуль `Queries.Registration` в рантайме SDK). В сгенерированной документации TypeDoc этот запрос может не иметь отдельной страницы модуля — ориентируйтесь на поле `candidates` в GraphQL и типы `CandidateFilterInput`, `PaginationInput`.

### Поиск по приватным данным аккаунтов

{{ get_sdk_doc("Queries", "Accounts", "SearchPrivateAccounts") }} | {{ get_graphql_doc("query.searchPrivateAccounts") }}

{{ get_typedoc_desc("Queries.Accounts.SearchPrivateAccounts") }}

{{ get_typedoc_input("Queries.Accounts.SearchPrivateAccounts") }}

Результат:

{{ get_typedoc_definition("Queries.Accounts.SearchPrivateAccounts", "IOutput") }}

### Список аккаунтов

{{ get_sdk_doc("Queries", "Accounts", "GetAccounts") }} | {{ get_graphql_doc("query.getAccounts") }}

{{ get_typedoc_desc("Queries.Accounts.GetAccounts") }}

{{ get_typedoc_input("Queries.Accounts.GetAccounts") }}

Результат:

{{ get_typedoc_definition("Queries.Accounts.GetAccounts", "IOutput") }}

### Добавить пайщика

{{ get_sdk_doc("Mutations", "Participants", "AddParticipant") }} | {{ get_graphql_doc("Mutation.addParticipant") }}

{{ get_typedoc_desc("Mutations.Participants.AddParticipant") }}

{{ get_typedoc_input("Mutations.Participants.AddParticipant") }}

Результат:

{{ get_typedoc_definition("Mutations.Participants.AddParticipant", "IOutput") }}

### Обновить аккаунт

{{ get_sdk_doc("Mutations", "Accounts", "UpdateAccount") }} | {{ get_graphql_doc("Mutation.updateAccount") }}

{{ get_typedoc_desc("Mutations.Accounts.UpdateAccount") }}

{{ get_typedoc_input("Mutations.Accounts.UpdateAccount") }}

Результат:

{{ get_typedoc_definition("Mutations.Accounts.UpdateAccount", "IOutput") }}

### Заявление на вступление (генерация)

{{ get_sdk_doc("Mutations", "Participants", "GenerateParticipantApplication") }} | {{ get_graphql_doc("Mutation.generateParticipantApplication") }}

{{ get_typedoc_desc("Mutations.Participants.GenerateParticipantApplication") }}

{{ get_typedoc_input("Mutations.Participants.GenerateParticipantApplication") }}

Результат:

{{ get_typedoc_definition("Mutations.Participants.GenerateParticipantApplication", "IOutput") }}

### Начальный платёж (в контексте регистрации пайщика)

{{ get_sdk_doc("Mutations", "Participants", "CreateInitialPayment") }} | {{ get_graphql_doc("Mutation.createInitialPayment") }}

{{ get_typedoc_desc("Mutations.Participants.CreateInitialPayment") }}

{{ get_typedoc_input("Mutations.Participants.CreateInitialPayment") }}

Результат:

{{ get_typedoc_definition("Mutations.Participants.CreateInitialPayment", "IOutput") }}


