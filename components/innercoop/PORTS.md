# Каталог портов `@coopenomics/innercoop`

Расширение разговаривает с ядром и соседями только через порты: контракт
плюс DI-токен, реализация подставляется мостом. Этот файл отвечает на
вопрос «что мне доступно» — без него разработчик расширения идёт читать
ядро, то есть ровно туда, откуда порты и уводят.

**Файл собирается из кода**: `node scripts/generate-ports-catalog.mjs`.
Править руками бессмысленно — правка потеряется при следующей сборке.

Звёздочка у потребителя означает необязательный порт: расширение переживает
его отсутствие, часть возможностей при этом выключена.

## Порты ядра

Реализует контроллер, потребляют расширения.

| Порт | Контракт | Реализует | Потребители | Назначение |
|---|---|---|---|---|
| `ACCOUNT_PORT` | `IAccountPort` (4)<br><sub>core-ports/account.port.ts</sub> | `AccountInnercoopAdapter` | capital, cardcoop, chairman, chatcoop, ku, marketplace, participant, reports, soviet-robot | Учётные записи пайщиков кооператива: найти по имени, перечислить с пагинацией, получить человеческое имя для показа. |
| `AGREEMENT_CATALOG_PORT` | `IAgreementCatalogPort` (1)<br><sub>core-ports/agreement-catalog.port.ts</sub> | `AgreementCatalogInnercoopAdapter` | marketplace | Справочник оферт кооператива — что вообще предлагается подписать. |
| `BRANCH_PORT` | `IBranchPort` (2)<br><sub>core-ports/branch.port.ts</sub> | `BranchInnercoopAdapter` | ku, marketplace | Кооперативные участки — территориальные подразделения кооператива. |
| `CANDIDATE_PORT` | `ICandidatePort` (2)<br><sub>core-ports/candidate.port.ts</sub> | `CandidateInnercoopAdapter` | capital | Заявки на вступление в кооператив. |
| `CHAIN_RESOURCES_PORT` | `IChainResourcesPort` (2)<br><sub>core-ports/chain-resources.port.ts</sub> | `ChainResourcesInnercoopAdapter` | powerup | Ресурсы аккаунта в цепи: оперативная память, полоса, процессорное время. |
| `CHAIN_PORT` | `IChainPort` (4)<br><sub>core-ports/chain.port.ts</sub> | `ChainInnercoopAdapter` | capital, cardcoop, chairman, expenses, ku, marketplace, reports, soviet-robot | Проводка действий в цепь и чтение её таблиц. |
| `COOP_CREDENTIAL_PORT` | `ICoopCredentialPort` (4)<br><sub>core-ports/coop-credential.port.ts</sub> | `CoopCredentialInnercoopAdapter` | cardcoop | Удостоверение кооператива в сети: чем он подписывает свои свидетельства и чем доказывает, что сеть его признаёт. |
| `COOPERATIVE_VARS_PORT` | `ICooperativeVarsPort` (1)<br><sub>core-ports/cooperative-vars.port.ts</sub> | `CooperativeVarsInnercoopAdapter` | chairman, chatcoop | Реквизиты кооператива, которому принадлежит контур: как он называется и как его называть в текстах. |
| `COUNCIL_PORT` | `ICouncilPort` (5)<br><sub>core-ports/council.port.ts</sub> | `CouncilInnercoopAdapter` | capital, chairman, marketplace | Совет кооператива: решения и типовые соглашения. |
| `DECISION_TRACKING_PORT` | `IDecisionTrackingPort` (7)<br><sub>core-ports/decision-tracking.port.ts</sub> | `DecisionTrackingAdapter` | capital, chairman | Отслеживание решений: расширение регистрирует правило «когда примут решение с этим хэшем — обновить такое-то поле параметров кооператива», и дальше ядро следит само. |
| `DOCUMENT_PORT` | `IDocumentPort` (5)<br><sub>core-ports/document.port.ts</sub> | `DocumentInnercoopAdapter` | capital, chairman, expenses, ku, marketplace, soviet-robot | Реестр документов кооператива: сгенерировать документ по шаблону, найти его по хэшу, собрать агрегат вокруг подписанного документа, сохранить приватную часть. |
| `EXTENSION_CONFIG_PORT` | `IExtensionConfigPort` (1)<br><sub>core-ports/extension-config.port.ts</sub> | `ExtensionConfigInnercoopAdapter` | marketplace, soviet-robot | Настройка установленного расширения. |
| `EXTENSION_DATABASE_PORT` | `IExtensionDatabasePort` (1)<br><sub>core-ports/extension-database.port.ts</sub> | `ExtensionDatabaseInnercoopAdapter` | marketplace | Отдельная база расширения. |
| `FILE_STORAGE_PORT` | `IFileStoragePort` (1)<br><sub>core-ports/file-storage.port.ts</sub> | — | expenses, marketplace | Универсальное файловое хранилище контура кооператива. |
| `FREE_DECISION_PORT` | `IFreeDecisionPort` (3)<br><sub>core-ports/free-decision.port.ts</sub> | `FreeDecisionAdapter` | capital, chairman | Свободные решения совета: расширение заводит проект решения, получает его документ и публикует в цепь. |
| `INTEGRATION_SETTINGS_PORT` | `IIntegrationSettingsPort` (1)<br><sub>core-ports/integration-settings.port.ts</sub> | `IntegrationSettingsInnercoopAdapter` | capital, cardcoop, chatcoop, marketplace | Доступы к внешним службам: мессенджер, распознавание речи, видеосвязь, геокодер, хостинг репозиториев. |
| `LEDGER2_HISTORY_PORT` | `ILedger2HistoryPort` (2)<br><sub>core-ports/ledger2-history.port.ts</sub> | `Ledger2InnercoopHistoryAdapter` | marketplace, reports | Ledger2 (ядро): read-only контракт истории операций/движений по кошельку из журнала `blockchain_actions`. |
| `LOGGER_PORT` | `ILoggerPort` (6)<br><sub>core-ports/logger.port.ts</sub> | `WinstonLoggerService` | builtin, capital, cardcoop, chairman, chatcoop, expenses, ku, marketplace, participant, powerup, qrpay, reports, sberpoll, soviet-robot, yookassa | Журналирование контура кооператива. |
| `MEET_PORT` | `IMeetPort` (3)<br><sub>core-ports/meet.port.ts</sub> | `MeetDataAdapter` | chairman, participant | Собрания пайщиков: перечислить и получить по идентификатору. |
| `MESSAGE_CHANNEL_PORT` | `IMessageChannelPort` (2)<br><sub>core-ports/message-channel.port.ts</sub> | `RedisService` | sberpoll, yookassa | Именованный канал сообщений контура кооператива: публикация и подписка. |
| `MUTATION_LOG_PORT` | `IMutationLogPort` (2)<br><sub>core-ports/mutation-log.port.ts</sub> | `MutationLogInnercoopAdapter` | capital | Журнал изменений: кто, что и когда менял через интерфейс кооператива. |
| `NOTIFICATION_PORT` | `INotificationPort` (2)<br><sub>core-ports/notification.port.ts</sub> | `NotificationInnercoopAdapter` | chairman, chatcoop, expenses, ku, marketplace, participant, soviet-robot* | Центр уведомлений: расширение говорит, ЧТО и КОМУ отправить, не зная про каналы, шаблоны и провайдеров. |
| `ONBOARDING_STEP_REGISTRY_PORT` | `IOnboardingStepRegistryPort` (2)<br><sub>core-ports/onboarding.port.ts</sub> | `OnboardingStepsRegistryService` | capital, chairman, marketplace | Подключение расширения к кооперативу — шаги, которые совет проходит один раз, прежде чем расширением можно пользоваться. |
| `ORGANIZATION_PORT` | `IOrganizationPort` (2)<br><sub>core-ports/party-card.port.ts</sub> | `OrganizationInnercoopAdapter` | cardcoop, ku, marketplace, qrpay, reports, sberpoll | Карточки сторон — реквизиты организации и данные физического лица. |
| `INDIVIDUAL_PORT` | `IOrganizationPort` (2)<br><sub>core-ports/party-card.port.ts</sub> | `IndividualInnercoopAdapter` | cardcoop, ku, reports | Карточки сторон — реквизиты организации и данные физического лица. |
| `PAYMENT_DESK_PORT` | `IPaymentDeskPort` (3)<br><sub>core-ports/payment-desk.port.ts</sub> | `PaymentDeskInnercoopAdapter` | marketplace, reports | Кассирский стол — операции над платежом, а не записи о нём. |
| `PAYMENT_METHOD_PORT` | `IPaymentMethodPort` (4)<br><sub>core-ports/payment-method.port.ts</sub> | `PaymentMethodInnercoopAdapter` | expenses, ku, marketplace, qrpay, sberpoll | Платёжные методы пайщика — куда кооперативу отправлять деньги. |
| `PAYMENT_PROVIDER_REGISTRY_PORT` | `IPaymentProviderRegistryPort` (2)<br><sub>core-ports/payment-provider.port.ts</sub> | `PaymentProviderRegistryInnercoopAdapter` | qrpay, yookassa | Реестр способов оплаты. |
| `PAYMENT_POLLING_STATE_PORT` | `IPaymentProviderRegistryPort` (2)<br><sub>core-ports/payment-provider.port.ts</sub> | `PaymentPollingStateInnercoopAdapter` | sberpoll | Реестр способов оплаты. |
| `PAYMENT_NOTICE_LOG_PORT` | `IPaymentProviderRegistryPort` (2)<br><sub>core-ports/payment-provider.port.ts</sub> | `PaymentNoticeLogInnercoopAdapter` | yookassa | Реестр способов оплаты. |
| `PAYMENT_PORT` | `IPaymentPort` (4)<br><sub>core-ports/payment.port.ts</sub> | `PaymentInnercoopAdapter` | expenses, qrpay, sberpoll, yookassa | Платежи кооператива: найти по хэшу, завести новый, обновить состояние. |
| `PROGRAM_AGREEMENT_PORT` | `IProgramAgreementPort` (2)<br><sub>core-ports/program-agreement.port.ts</sub> | `ProgramAgreementInnercoopAdapter` | marketplace | Подписание пайщиком соглашения об участии в целевой программе. |
| `REALTIME_CHANNEL_PORT` | `IRealtimeChannelPort` (2)<br><sub>core-ports/realtime.port.ts</sub> | `RealtimeChannelInnercoopAdapter` | marketplace | Шина событий реального времени — то, из чего кормятся подписки клиента. |
| `REGISTRATION_REGISTRY_PORT` | `IRegistrationRegistryPort` (4)<br><sub>core-ports/registration.port.ts</sub> | `AgreementRegistryService` | capital, marketplace* | Оферты и программы участия, которые расширение предлагает вступающему пайщику. |
| `SECRET_CIPHER_PORT` | `ISecretCipherPort` (2)<br><sub>core-ports/secret-cipher.port.ts</sub> | `SecretCipherInnercoopAdapter` | capital, chatcoop, soviet-robot | Шифрование секретов расширения. |
| `USER_CERTIFICATE_PORT` | `IUserCertificatePort` (1)<br><sub>core-ports/user-certificate.port.ts</sub> | `UserCertificateInnercoopAdapter` | marketplace | Сертификат пайщика — как его подписывать в документах и показывать в интерфейсе. |
| `USER_DATA_PORT` | `IUserDataPort` (5)<br><sub>core-ports/user-data.port.ts</sub> | `UserDataInnercoopAdapter` | capital, marketplace | Пользовательские данные пайщика — записи «ключ→значение» в разрезе кооператива. |
| `USER_DIRECTORY_PORT` | `IUserDirectoryPort` (3)<br><sub>core-ports/user-directory.port.ts</sub> | `UserDirectoryInnercoopAdapter` | capital, cardcoop, chatcoop, marketplace | Справочник пользователей кооператива — учётные имена и роли. |
| `VAULT_PORT` | `IVaultPort` (1)<br><sub>core-ports/vault.port.ts</sub> | `VaultInnercoopAdapter` | capital, chairman, expenses, ku, marketplace, reports, soviet-robot | Ключи подписи, хранимые кооперативом. |
| `VERIFICATION_PORT` | `IVerificationPort` (2)<br><sub>core-ports/verification.port.ts</sub> | `VerificationInnercoopAdapter` | marketplace | Верификация личности пайщика — уровни подтверждения, которыми ядро отвечает на вопрос расширения «можно ли этому пайщику доверить действие». |
| `PROGRAM_WALLET_PORT` | `IProgramWalletPort` (2)<br><sub>core-ports/wallet.port.ts</sub> | `ProgramWalletInnercoopAdapter` | capital | Кошельки пайщика. |
| `USER_WALLET_PORT` | `IProgramWalletPort` (2)<br><sub>core-ports/wallet.port.ts</sub> | `UserWalletInnercoopAdapter` | marketplace | Кошельки пайщика. |

## Межрасширенческие порты

Реализует одно расширение, потребляют другие.

| Порт | Контракт | Реализует | Потребители | Назначение |
|---|---|---|---|---|
| `CHATCOOP_CALENDAR_PORT` | `IChatCoopCalendarPort` (1)<br><sub>cross-plugin-ports/chatcoop-calendar.port.ts</sub> | `ChatcoopInnercoopChatCoopCalendarAdapter` | — | Read-модель события календаря ChatCoop для межмодульного контракта (Capital и др.). |
| `COOP_CALENDAR_EVENT_NOTIFICATION_PORT` | `ICoopCalendarEventNotificationPort` (2)<br><sub>cross-plugin-ports/coop-calendar-event-notification.port.ts</sub> | — | chatcoop | Оповещения пайщиков о событиях кооперативного календаря (Novu / стол связи). |
| `EXPENSE_CHASSIS_PORT` | `IExpenseChassisPort` (11)<br><sub>cross-plugin-ports/expense-chassis.port.ts</sub> | `ExpensesInnercoopExpenseChassisAdapter` | capital, marketplace | Шасси расходов (контракт `expense`): read-side для приложений-потребителей (capital, marketplace, EMP). |
| `MATRIX_ROOM_MESSAGING_PORT` | `IMatrixRoomMessagingPort` (4)<br><sub>cross-plugin-ports/matrix-room-messaging.port.ts</sub> | `ChatcoopInnercoopMatrixRoomMessagingAdapter` | capital* | Отправка сообщений в Matrix (Client-Server API) от имени сервисной учётки. |
| `PROJECT_CAPITAL_CLEARANCE_PORT` | `IProjectCapitalClearancePort` (2)<br><sub>cross-plugin-ports/project-capital-clearance.port.ts</sub> | `CapitalInnercoopProjectCapitalClearanceAdapter` | chatcoop* | Допуск к проекту Capital (подтверждённый appendix / makeClearance). |
| `PROJECT_COMMUNICATION_ARTIFACTS_PORT` | `IProjectCommunicationArtifactsPort` (8)<br><sub>cross-plugin-ports/project-communication-artifacts.port.ts</sub> | `ChatcoopInnercoopProjectCommunicationArtifactsAdapter` | capital*, chatcoop* | Сообщения Matrix в истории (текст и расшифрованное аудио). |

## Хуки

Реализует расширение, вызывает ядро: обратное направление.

| Порт | Контракт | Реализует | Потребители | Назначение |
|---|---|---|---|---|
| `DESKTOP_GRANTS_REGISTRY_PORT` | `IDesktopGrantsRegistryPort` (1)<br><sub>hooks/desktop-grants.hook.ts</sub> | `ExtensionGrantsRegistry` | marketplace, soviet-robot | Права пайщика на рабочем столе расширения. |
| `REGISTRATION_DOCUMENT_PARAMETERS_REGISTRY_PORT` | `IRegistrationDocumentParametersRegistryPort` (2)<br><sub>hooks/registration-document-parameters.hook.ts</sub> | `RegistrationDocumentParametersRegistry` | capital, marketplace | Параметры оферты, которые расширение выдаёт вступающему пайщику. |

Всего портов: 50.
