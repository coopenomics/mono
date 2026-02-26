## Полный API Reference

### Queries (82)

| Запрос | Описание |
|--------|----------|
| `agreements` | Получение списка соглашений с фильтрацией и пагинацией |
| `candidates` | Получение списка кандидатов с пагинацией, отсортированных по дате регистрации |
| `capitalCandidates` | Получение списка кандидатов расширения CAPITAL с обогащенными данными |
| `capitalCommit` | Получение коммита по хэшу |
| `capitalCommits` | Получение списка коммитов кооператива с фильтрацией |
| `capitalContributor` | Получение участника по ID, имени пользователя или хешу участника |
| `capitalContributors` | Получение списка участников кооператива с фильтрацией |
| `capitalCycles` | Получение списка циклов кооператива с фильтрацией |
| `capitalDebt` | Получение долга по внутреннему ID базы данных |
| `capitalDebts` | Получение списка долгов кооператива с фильтрацией |
| `capitalExpense` | Получение расхода по внутреннему ID базы данных |
| `capitalExpenses` | Получение списка расходов кооператива с фильтрацией |
| `capitalGetProcessInstance` | Получение экземпляра процесса по ID |
| `capitalGetProcessInstances` | Получение экземпляров процессов для проекта |
| `capitalGetProcessTemplate` | Получение шаблона процесса по ID |
| `capitalGetProcessTemplates` | Получение шаблонов процессов для проекта |
| `capitalInvest` | Получение инвестиции по внутреннему ID базы данных |
| `capitalInvests` | Получение списка инвестиций кооператива с фильтрацией |
| `capitalIssue` | Получение задачи по хэшу |
| `capitalIssues` | Получение списка задач кооператива с фильтрацией |
| `capitalProgramInvest` | Получение программной инвестиции по внутреннему ID базы данных |
| `capitalProgramInvests` | Получение списка программных инвестиций кооператива с фильтрацией |
| `capitalProject` | Получение проекта по хешу с компонентами |
| `capitalProjectWithRelations` | Получение проекта с полными отношениями по хешу проекта |
| `capitalProjects` | Получение списка проектов кооператива с фильтрацией и компонентами |
| `capitalResult` | Получение результата по внутреннему ID базы данных |
| `capitalResults` | Получение списка результатов кооператива с фильтрацией |
| `capitalSegment` | Получение одного сегмента кооператива по фильтрам |
| `capitalSegments` | Получение списка сегментов кооператива с фильтрацией и пагинацией |
| `capitalState` | Получение полного состояния CAPITAL контракта кооператива |
| `capitalStories` | Получение списка историй кооператива с фильтрацией |
| `capitalStory` | Получение истории по хэшу |
| `capitalTimeEntries` | Получение пагинированного списка записей времени |
| `capitalTimeEntriesByIssues` | Получение пагинированного списка агрегированных записей времени по задачам с инф |
| `capitalTimeStats` | Гибкий запрос статистики времени участников по проектам с пагинацией |
| `capitalVote` | Получение голоса по внутреннему ID базы данных |
| `capitalVotes` | Получение списка голосов кооператива с фильтрацией |
| `chairmanApproval` | Получение одобрения по внутреннему ID базы данных |
| `chairmanApprovals` | Получение списка одобрений председателя совета с фильтрацией |
| `chatcoopCheckUsernameAvailability` | Проверяет доступность Matrix username |
| `chatcoopGetAccountStatus` | Проверить статус Matrix аккаунта пользователя и получить iframe URL |
| `chatcoopGetTranscription` | Получить детальную транскрипцию с сегментами |
| `chatcoopGetTranscriptions` | Получить список транскрипций звонков |
| `getAccount` | Получить сводную информацию о аккаунте |
| `getAccounts` | Получить сводную информацию о аккаунтах системы |
| `getActions` | Получить список действий блокчейна с возможностью фильтрации по аккаунту, имени  |
| `getAgenda` | Получить список вопросов совета кооператива для голосования |
| `getApiKeys` | Получить список API ключей кооператива |
| `getAvailableReports` | Получить список доступных типов отчётов |
| `getBranches` | Получить список кооперативных участков |
| `getCapitalIssueLogs` | Получить логи событий по задаче |
| `getCapitalOnboardingState` | Получить состояние онбординга capital |
| `getCapitalProjectLogs` | Получить логи событий по проекту с фильтрацией и пагинацией |
| `getChairmanOnboardingState` | Получить состояние онбординга председателя |
| `getCurrentInstance` | Получить текущий инстанс пользователя |
| `getCurrentTableStates` | Получить текущие состояния таблиц блокчейна с фильтрацией по контракту, области  |
| `getDeltas` | Получить список дельт блокчейна с возможностью фильтрации по контракту, таблице, |
| `getDesktop` | Получить состав приложений рабочего стола |
| `getDocuments` |  |
| `getExtensionLogs` | Получить логи расширений с фильтрацией и пагинацией |
| `getExtensions` | Получить список расширений |
| `getInstallationStatus` | Получить статус установки кооператива с приватными данными |
| `getLedger` | Получить полное состояние плана счетов кооператива. Возвращает все счета из стан |
| `getLedgerHistory` | Получить историю операций по счетам кооператива. Возвращает список операций с во |
| `getMarketplaceSettings` | Получить настройки маркетплейса |
| `getMeet` | Получить данные собрания по хешу |
| `getMeets` | Получить список всех собраний кооператива |
| `getMyShareLinks` | Получить созданные мной ссылки доступа |
| `getPaymentMethods` | Получить список методов оплаты |
| `getPayments` | Получить список платежей с возможностью фильтрации по типу, статусу и направлени |
| `getProgramWallet` | Получить один программный кошелек по фильтру |
| `getProgramWallets` | Получить список программных кошельков с фильтрацией и пагинацией |
| `getProviderSubscriptionById` | Получить подписку провайдера по ID |
| `getProviderSubscriptions` | Получить подписки пользователя у провайдера |
| `getRegistrationConfig` | Получить конфигурацию программ регистрации для кооператива |
| `getSharedWithMe` | Получить страницы, к которым мне предоставлен доступ |
| `getSystemInfo` | Получить сводную публичную информацию о системе |
| `getUserWebPushSubscriptions` | Получить веб-пуш подписки пользователя |
| `getWebPushSubscriptionStats` | Получить статистику веб-пуш подписок (только для председателя) |
| `onecoopGetDocuments` | Получение документов кооператива для синхронизации с 1С. Требует секретный ключ  |
| `searchDocuments` | Полнотекстовый поиск по документам кооператива |
| `searchPrivateAccounts` | Поиск приватных данных аккаунтов по запросу. Поиск осуществляется по полям ФИО,  |

### Mutations (179)

| Мутация | Описание |
|---------|----------|
| `acceptChildOrder` | Подтвердить поставку имущества на заявку |
| `acceptStock` | Принять предложение из запасов кооператива |
| `addParticipant` | Добавить активного пайщика, который вступил в кооператив, не используя платформу |
| `addPaymentMethod` | Добавить метод оплаты (банковский счёт или СБП) |
| `addToPublishWhitelist` | Добавить пайщика в белый список публикации |
| `addTrustedAccount` | Добавить доверенное лицо кооперативного участка |
| `cancelRequest` | Отменить заявку |
| `capitalAddAuthor` | Добавление автора проекта в CAPITAL контракте |
| `capitalApproveCommit` | Одобрение коммита в CAPITAL контракте |
| `capitalCalculateVotes` | Расчет голосов в CAPITAL контракте |
| `capitalCloseProject` | Закрытие проекта от инвестиций в CAPITAL контракте |
| `capitalCompleteProcessStep` | Завершение шага процесса |
| `capitalCompleteRegistration` | Завершение регистрации в Capital через отправку документов в блокчейн (regcontri |
| `capitalCompleteVoting` | Завершение голосования в CAPITAL контракте |
| `capitalConvertSegment` | Конвертация сегмента в CAPITAL контракте |
| `capitalCreateCommit` | Создание коммита в CAPITAL контракте |
| `capitalCreateCycle` | Создание цикла в CAPITAL контракте |
| `capitalCreateDebt` | Получение ссуды в CAPITAL контракте |
| `capitalCreateExpense` | Создание расхода в CAPITAL контракте |
| `capitalCreateIssue` | Создание задачи в CAPITAL контракте |
| `capitalCreateProcessTemplate` | Создание шаблона процесса |
| `capitalCreateProgramProperty` | Создание программного имущественного взноса в CAPITAL контракте |
| `capitalCreateProject` | Создание проекта в CAPITAL контракте |
| `capitalCreateProjectInvest` | Инвестирование в проект CAPITAL контракта |
| `capitalCreateProjectProperty` | Создание проектного имущественного взноса в CAPITAL контракте |
| `capitalCreateStory` | Создание истории в CAPITAL контракте |
| `capitalDeclineCommit` | Отклонение коммита в CAPITAL контракте |
| `capitalDeleteIssue` | Удаление задачи по хэшу |
| `capitalDeleteProcessTemplate` | Удаление шаблона процесса |
| `capitalDeleteProject` | Удаление проекта в CAPITAL контракте |
| `capitalDeleteStory` | Удаление истории по хэшу |
| `capitalEditContributor` | Редактирование параметров участника в CAPITAL контракте |
| `capitalEditProject` | Редактирование проекта в CAPITAL контракте |
| `capitalFinalizeProject` | Финализация проекта в CAPITAL контракте после завершения всех конвертаций участн |
| `capitalFundProgram` | Финансирование программы CAPITAL контракта |
| `capitalGenerateCapitalizationAgreement` | Сгенерировать соглашение о капитализации |
| `capitalGenerateCapitalizationMoneyInvestStatement` | Сгенерировать заявление об инвестировании в капитализацию |
| `capitalGenerateCapitalizationPropertyInvestAct` | Сгенерировать акт об инвестировании имуществом в капитализацию |
| `capitalGenerateCapitalizationPropertyInvestDecision` | Сгенерировать решение об инвестировании имуществом в капитализацию |
| `capitalGenerateCapitalizationPropertyInvestStatement` | Сгенерировать заявление об инвестировании имуществом в капитализацию |
| `capitalGenerateCapitalizationToMainWalletConvertStatement` | Сгенерировать заявление о конвертации из капитализации в основной кошелек |
| `capitalGenerateComponentGenerationContract` | Сгенерировать документ дополнения к приложению для компонента |
| `capitalGenerateExpenseDecision` | Сгенерировать решение о расходе |
| `capitalGenerateExpenseStatement` | Сгенерировать заявление о расходе |
| `capitalGenerateGenerationContract` | Сгенерировать генерационное соглашение |
| `capitalGenerateGenerationMoneyInvestStatement` | Сгенерировать заявление об инвестировании в генерацию |
| `capitalGenerateGenerationPropertyInvestAct` | Сгенерировать акт об инвестировании имуществом в генерацию |
| `capitalGenerateGenerationPropertyInvestDecision` | Сгенерировать решение об инвестировании имуществом в генерацию |
| `capitalGenerateGenerationPropertyInvestStatement` | Сгенерировать заявление об инвестировании имуществом в генерацию |
| `capitalGenerateGenerationToCapitalizationConvertStatement` | Сгенерировать заявление о конвертации из генерации в капитализацию |
| `capitalGenerateGenerationToMainWalletConvertStatement` | Сгенерировать заявление о конвертации из генерации в основной кошелек |
| `capitalGenerateGenerationToProjectConvertStatement` | Сгенерировать заявление о конвертации из генерации в проектный кошелек |
| `capitalGenerateGetLoanDecision` | Сгенерировать решение о получении займа |
| `capitalGenerateGetLoanStatement` | Сгенерировать заявление о получении займа |
| `capitalGenerateProjectGenerationContract` | Сгенерировать документ приложения к договору участия для проекта |
| `capitalGenerateRegistrationDocuments` | Генерация пачки документов для завершения регистрации в Capital (GenerationContr |
| `capitalGenerateResultContributionAct` | Сгенерировать акт о вкладе результатов |
| `capitalGenerateResultContributionDecision` | Сгенерировать решение о вкладе результатов |
| `capitalGenerateResultContributionStatement` | Сгенерировать заявление о вкладе результатов |
| `capitalImportContributor` | Импорт участника в CAPITAL контракт |
| `capitalMakeClearance` | Подписание приложения в CAPITAL контракте |
| `capitalOpenProject` | Открытие проекта для инвестиций в CAPITAL контракте |
| `capitalPushResult` | Внесение результата в CAPITAL контракте |
| `capitalRefreshProgram` | Обновление CRPS пайщика в программе CAPITAL контракта |
| `capitalRefreshSegment` | Обновление сегмента в CAPITAL контракте |
| `capitalRegisterContributor` | Регистрация участника в CAPITAL контракте |
| `capitalSetConfig` | Установка конфигурации CAPITAL контракта |
| `capitalSetMaster` | Установка мастера проекта в CAPITAL контракте |
| `capitalSetPlan` | Установка плана проекта в CAPITAL контракте |
| `capitalSignActAsChairman` | Подписание акта о вкладе результатов председателем |
| `capitalSignActAsContributor` | Подписание акта о вкладе результатов участником |
| `capitalStartProcess` | Запуск экземпляра процесса |
| `capitalStartProject` | Запуск проекта в CAPITAL контракте |
| `capitalStartVoting` | Запуск голосования в CAPITAL контракте |
| `capitalStopProject` | Остановка проекта в CAPITAL контракте |
| `capitalSubmitVote` | Голосование в CAPITAL контракте |
| `capitalUpdateIssue` | Обновление задачи в CAPITAL контракте |
| `capitalUpdateProcessTemplate` | Обновление шаблона процесса (шаги, рёбра, статус) |
| `capitalUpdateStory` | Обновление истории в CAPITAL контракте |
| `chairmanConfirmApprove` | Подтверждение одобрения документа председателем совета |
| `chairmanDeclineApprove` | Отклонение одобрения документа председателем совета |
| `chatcoopCreateAccount` | Создать Matrix аккаунт с именем пользователя и паролем |
| `completeCapitalOnboardingStep` | Выполнить шаг онбординга capital (создание предложения повестки) |
| `completeChairmanAgendaStep` | Выполнить один из шагов онбординга (создание предложения повестки) |
| `completeChairmanGeneralMeetStep` | Выполнить шаг онбординга по созданию общего собрания (сохранить hash повестки) |
| `completeRequest` | Завершить заявку по истечению гарантийного срока |
| `confirmAgreement` | Подтвердить соглашение пайщика администратором |
| `confirmReceiveOnRequest` | Подтвердить получение имущества Уполномоченным лицом от Заказчика по новации и а |
| `confirmSupplyOnRequest` | Подтвердить поставку имущества Поставщиком по заявке Заказчика и акту приёма-пер |
| `coopstock` | Создать предложение из запасов кооператива |
| `createAnnualGeneralMeet` | Сгенерировать документ предложения повестки очередного общего собрания пайщиков |
| `createApiKey` | Создать API ключ кооператива. Полный ключ показывается только при создании. |
| `createBranch` | Создать кооперативный участок |
| `createChildOrder` | Создать заявку на поставку имущества по предложению Поставщика |
| `createDepositPayment` | Создание объекта паевого платежа производится мутацией createDepositPayment. Вып |
| `createInitialPayment` | Создание объекта регистрационного платежа производится мутацией createInitialPay |
| `createParentOffer` | Создать предложение на поставку имущества |
| `createProjectOfFreeDecision` | Создать повестку дня и проект решения, и сохранить в хранилище для дальнейшей ге |
| `createShareLink` | Создать ссылку доступа к странице |
| `createShipment` | Создать перевозку (КУ отправителя) |
| `createWebPushSubscription` | Создать веб-пуш подписку для пользователя |
| `createWithdraw` | Создать заявку на вывод средств |
| `deactivateWebPushSubscriptionById` | Деактивировать веб-пуш подписку по ID |
| `declineAgreement` | Отклонить соглашение пайщика администратором |
| `declineRequest` | Отклонить заявку |
| `deleteBranch` | Удалить кооперативный участок |
| `deletePaymentMethod` | Удалить метод оплаты |
| `deleteTrustedAccount` | Удалить доверенное лицо кооперативного участка |
| `deliverOnRequest` | Подтвердить доставку имущества Заказчику по заявке |
| `destroyRequest` | Уничтожить просроченное имущество |
| `disputeOnRequest` | Открыть спор по заявке |
| `editBranch` | Изменить кооперативный участок |
| `generateAnnualGeneralMeetAgendaDocument` | Сгенерировать предложение повестки общего собрания пайщиков |
| `generateAnnualGeneralMeetDecisionDocument` | Сгенерировать документ решения общего собрания пайщиков |
| `generateAnnualGeneralMeetNotificationDocument` | Сгенерировать документ уведомления о проведении общего собрания пайщиков |
| `generateAssetContributionAct` | Сгенерировать документ акта приема-передачи. |
| `generateAssetContributionDecision` | Сгенерировать документ решения о вступлении в кооператив. |
| `generateAssetContributionStatement` | Сгенерировать документ заявления о вступлении в кооператив. |
| `generateBallotForAnnualGeneralMeetDocument` | Сгенерировать бюллетень для голосования на общем собрании пайщиков |
| `generateConvertToAxonStatement` | Генерирует заявление на конвертацию паевого взноса в членский взнос |
| `generateDocument` | Универсальная генерация документа с произвольными данными (только для председате |
| `generateFreeDecision` | Сгенерировать протокол решения по предложенной повестке |
| `generateParticipantApplication` | Сгенерировать документ заявления о вступлении в кооператив. |
| `generateParticipantApplicationDecision` | Сгенерировать документ протокол решения собрания совета |
| `generatePrivacyAgreement` | Сгенерировать документ согласия с политикой конфиденциальности. |
| `generateProjectOfFreeDecision` | Сгенерировать документ проекта свободного решения |
| `generateRegistrationDocuments` | Генерирует пакет документов для регистрации пайщика. Возвращает список документо |
| `generateReport` | Генерация отчёта для ФНС/ФСС |
| `generateReturnByAssetAct` | Сгенерировать документ акта возврата имущества. |
| `generateReturnByAssetDecision` | Сгенерировать документ решения о возврате имущества. |
| `generateReturnByAssetStatement` | Сгенерировать документ заявления о возврате имущества. |
| `generateReturnByMoneyDecisionDocument` | Сгенерировать документ решения совета о возврате паевого взноса |
| `generateReturnByMoneyStatementDocument` | Сгенерировать документ заявления на возврат паевого взноса |
| `generateSelectBranchDocument` | Сгенерировать документ, подтверждающий выбор кооперативного участка |
| `generateSignatureAgreement` | Сгенерировать документ соглашения о порядка и правилах использования простой эле |
| `generateSovietDecisionOnAnnualMeetDocument` | Сгенерировать документ решения Совета по проведению общего собрания пайщиков |
| `generateUserAgreement` | Сгенерировать документ пользовательского соглашения. |
| `generateWalletAgreement` | Сгенерировать документ соглашения о целевой потребительской программе "Цифровой  |
| `initSystem` | Произвести инициализацию программного обеспечения перед установкой совета методо |
| `installExtension` | Установить расширение |
| `installSystem` | Произвести установку членов совета перед началом работы |
| `login` | Войти в систему с помощью цифровой подписи и получить JWT-токены доступа |
| `logout` | Выйти из системы и заблокировать JWT-токены |
| `notifyOnAnnualGeneralMeet` | Уведомление о проведении общего собрания пайщиков |
| `processConvertToAxonStatement` | Обрабатывает подписанное заявление на конвертацию и выполняет блокчейн-транзакци |
| `publishProjectOfFreeDecision` | Опубликовать предложенную повестку и проект решения для дальнейшего голосования  |
| `receiveOnRequest` | Подтвердить получение имущества Уполномоченным лицом от Заказчика по акту приёмк |
| `receiveShipment` | Приём перевозки на складе КУ получателя |
| `refresh` | Обновить токен доступа аккаунта |
| `registerAccount` | Зарегистрировать аккаунт пользователя в системе |
| `registerParticipant` | Зарегистрировать заявление и подписанные положения, подготовив пакет документов  |
| `removeFromPublishWhitelist` | Удалить пайщика из белого списка публикации |
| `reofferRequest` | Перепредложить имущество по новой цене |
| `reqReturn` | Запросить возврат паевого взноса имуществом (перед получением) |
| `resetKey` | Заменить приватный ключ аккаунта |
| `restartAnnualGeneralMeet` | Перезапуск общего собрания пайщиков |
| `revokeApiKey` | Отозвать API ключ |
| `revokeShareLink` | Отозвать ссылку доступа |
| `selectBranch` | Выбрать кооперативный участок |
| `sendAgreement` | Отправить соглашение |
| `setPaymentStatus` | Управление статусом платежа осущствляется мутацией setPaymentStatus. При переход |
| `setWif` | Сохранить приватный ключ в зашифрованном серверном хранилище |
| `shipmentArrived` | Водитель отмечает прибытие |
| `signByPresiderOnAnnualGeneralMeet` | Подписание решения председателем на общем собрании пайщиков |
| `signBySecretaryOnAnnualGeneralMeet` | Подписание решения секретарём на общем собрании пайщиков |
| `signShipmentByDriver` | Подпись водителя на перевозке |
| `startInstall` | Начать процесс установки кооператива, установить ключ и получить код установки |
| `startResetKey` | Выслать токен для замены приватного ключа аккаунта на электронную почту |
| `supplyOnRequest` | Подтвердить поставку имущества Поставщиком по заявке Заказчика и акту приёма-пер |
| `triggerNotificationWorkflow` | Запустить воркфлоу уведомлений (только для председателя или server-secret) |
| `uninstallExtension` | Удалить расширение |
| `updateAccount` | Обновить аккаунт в системе провайдера. Обновление аккаунта пользователя производ |
| `updateBankAccount` | Обновить банковский счёт |
| `updateExtension` | Обновить расширение |
| `updateMarketplaceSettings` | Обновить настройки маркетплейса (только chairman) |
| `updateSettings` | Обновить настройки системы (рабочие столы и маршруты по умолчанию) |
| `updateSystem` | Обновить параметры системы |
| `verifyEmail` | Подтвердить email адрес пользователя |
| `voteOnAnnualGeneralMeet` | Голосование на общем собрании пайщиков |
