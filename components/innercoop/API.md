# Публичный API `@coopenomics/innercoop`

Снимок контракта: имена экспортов и состав каждого из них. Расширение,
уехавшее в свой репозиторий, собирается против этих объявлений, поэтому
изменение здесь — событие версии, а не деталь правки.

**Файл собирается из кода**: `node scripts/check-innercoop-api.mjs`.
Изменился — проверьте, ломает ли это потребителей: удаление или переименование
экспорта, исчезнувший метод, новый обязательный параметр требуют major, а
снятое старое — периода устаревания не меньше одного minor (INV-009).

Всего экспортов: 267.

## ACCOUNT_PORT

`const` · core-ports

- `Symbol.for('Innercoop.CorePort.Account')`

## AGREEMENT_CATALOG_PORT

`const` · core-ports

- `Symbol.for('Innercoop.CorePort.AgreementCatalog')`

## BRANCH_PORT

`const` · core-ports

- `Symbol.for('Innercoop.CorePort.Branch')`

## CANDIDATE_PORT

`const` · core-ports

- `Symbol.for('Innercoop.CorePort.Candidate')`

## CAPITAL_PROJECT_CREATED_EVENT

`const` · cross-plugin-ports


## CAPITAL_PROJECT_MATRIX_ROOM_ASSIGNED_EVENT

`const` · cross-plugin-ports


## CHAIN_PORT

`const` · core-ports

- `Symbol.for('Innercoop.CorePort.Chain')`

## CHAIN_RESOURCES_PORT

`const` · core-ports

- `Symbol.for('Innercoop.CorePort.ChainResources')`

## CHATCOOP_CALENDAR_PORT

`const` · cross-plugin-ports

- `Symbol.for('Innercoop.CrossPlugin.ChatCoopCalendar')`

## CHATCOOP_CAPITAL_PROJECT_ROOM_ENSURE_MEMBER_EVENT

`const` · cross-plugin-ports


## CHATCOOP_MATRIX_USER_LINKED_FOR_CAPITAL_PROJECT_ROOMS_EVENT

`const` · cross-plugin-ports


## COOP_CALENDAR_EVENT_NOTIFICATION_PORT

`const` · cross-plugin-ports

- `Symbol.for('Innercoop.CrossPlugin.CoopCalendarEventNotification')`

## COOPERATIVE_VARS_PORT

`const` · core-ports

- `Symbol.for('Innercoop.CorePort.CooperativeVars')`

## COUNCIL_PORT

`const` · core-ports

- `Symbol.for('Innercoop.CorePort.Council')`

## CreateTrackingRuleInput

`interface` · core-ports

- `hash: string`
- `event_type: DecisionEventType`
- `vars_field: string`
- `metadata: Record<string, any>`

## DECISION_TRACKING_PORT

`const` · core-ports

- `Symbol.for('Innercoop.CorePort.DecisionTracking')`

## DecisionEventType

`enum` · core-ports

- `SOVIET_DECISION = 'soviet_decision',`
- `MEET_DECISION = 'meet_decision',`

## DecisionEventTypeString

`type` · core-ports

- `'soviet_decision' | 'meet_decision'`

## DecisionProcessedResult

`interface` · core-ports

- `matched: boolean`
- `rule_id?: string`
- `hash: string`
- `event_type: DecisionEventType`
- `vars_field?: string`
- `decision_id?: string`
- `decision_date?: string`
- `metadata: Record<string, any>`

## DESKTOP_GRANTS_FILTER_REGISTRY_PORT

`const` · hooks

- `Symbol.for('Innercoop.CorePort.DesktopGrantsFilterRegistry')`

## DESKTOP_GRANTS_REGISTRY_PORT

`const` · hooks

- `Symbol.for('Innercoop.CorePort.DesktopGrantsRegistry')`

## DOCUMENT_PORT

`const` · core-ports

- `Symbol.for('Innercoop.CorePort.Document')`

## EXPENSE_CHASSIS_PORT

`const` · cross-plugin-ports

- `Symbol.for('Innercoop.CrossPlugin.ExpenseChassis')`

## ExtendedMeetStatus

`enum` · core-ports

- `NONE = 'none',`
- `CREATED = 'created',`
- `AUTHORIZED = 'authorized',`
- `PRECLOSED = 'preclosed',`
- `CLOSED = 'closed',`
- `WAITING_FOR_OPENING = 'waitingForOpening',`
- `VOTING_IN_PROGRESS = 'votingInProgress',`
- `EXPIRED_NO_QUORUM = 'expiredNoQuorum',`
- `VOTING_COMPLETED = 'votingCompleted',`
- `ONRESTART = 'onrestart',`

## EXTENSION_CONFIG_PORT

`const` · core-ports

- `Symbol.for('Innercoop.CorePort.ExtensionConfig')`

## EXTENSION_DATABASE_PORT

`const` · core-ports

- `Symbol.for('Innercoop.CorePort.ExtensionDatabase')`

## FILE_STORAGE_PORT

`const` · core-ports

- `Symbol.for('Innercoop.CorePort.FileStorage')`

## FREE_DECISION_PORT

`const` · core-ports

- `Symbol.for('Innercoop.CorePort.FreeDecision')`

## IAccountPort

`interface` · core-ports

- `getAccount(username: string): Promise<InnerAccount>`
- `getAccounts(filter: InnerGetAccountsFilter, options?: InnerPaginationOptions): Promise<InnerPaginatedAccounts>`
- `getDisplayName(username: string): Promise<string>`
- `getChainAccount(username: string): Promise<InnerChainAccountRow | null>`

## IAgreementCatalogPort

`interface` · core-ports

- `getAgreementById(id: string): InnerAgreementCatalogItem | null`

## IBranchPort

`interface` · core-ports

- `getBranches(coopname: string): Promise<InnerBranch[]>`
- `getBranch(coopname: string, braname: string): Promise<InnerBranch | null>`

## ICandidatePort

`interface` · core-ports

- `findByUsername(username: string): Promise<(InnerCandidate & { documents?: Record<string, InnerCandidateDocument> }) | null>`
- `getCandidates(`
- `currentUser: IMonoAccount,`
- `filter?: InnerCandidateFilter,`
- `page?: InnerPageRequest`
- `): Promise<InnerPage<InnerCandidate>>`

## ICapitalProjectCreatedPayload

`interface` · cross-plugin-ports

- `project_hash: string`
- `title: string`

## ICapitalProjectMatrixRoomAssignedPayload

`interface` · cross-plugin-ports

- `project_hash: string`
- `matrix_room_id: string`

## IChainPort

`interface` · core-ports

- `initialize(username: string, wif: string): void`
- `transact(action: InnerChainAction | InnerChainAction[], broadcast?: boolean): Promise<InnerTransactResult>`
- `getAllRows<T = any>(code: string, scope: string, tableName: string): Promise<T[]>`
- `getSingleRow<T = any>(`
- `code: string,`
- `scope: string,`
- `tableName: string,`
- `primaryKey: unknown,`
- `indexPosition?: string,`
- `keyType?: string`
- `): Promise<T | null>`

## IChainResourcesPort

`interface` · core-ports

- `getAccount(username: string): Promise<InnerChainAccountResources | null>`
- `powerUp(username: string, quantity: string): Promise<void>`

## IChatCoopCalendarPort

`interface` · cross-plugin-ports

- `listEventsByProjectHash(input: {`
- `projectHash: string`
- `window?: InnerCalendarEventWindow`
- `}): Promise<InnerCoopCalendarEventRead[]>`

## IChatCoopCapitalProjectRoomEnsureMemberPayload

`interface` · cross-plugin-ports

- `username: string`
- `matrix_room_id: string`

## IChatCoopMatrixUserLinkedForCapitalProjectRoomsPayload

`interface` · cross-plugin-ports

- `username: string`

## ICoopCalendarEventNotificationPort

`interface` · cross-plugin-ports

- `notifyEventCreated(input: InnerCoopCalendarEventNotificationInput): Promise<void>`
- `notifyEventUpdated(input: InnerCoopCalendarEventNotificationInput): Promise<void>`

## ICooperativeVarsPort

`interface` · core-ports

- `get(): Promise<InnerCooperativeVars | null>`

## ICouncilPort

`interface` · core-ports

- `getDecisions(coopname: string): Promise<InnerCouncilDecision[]>`
- `getCoagreement(coopname: string, agreementType: string): Promise<InnerCoopAgreement | null>`
- `getPrograms(coopname: string): Promise<InnerCoopProgram[]>`
- `ensureProgram(params: InnerEnsureProgramParams): Promise<InnerEnsureProgramResult>`
- `cancelExpiredDecision(input: { coopname: string`
- `decision_id: string | number }): Promise<InnerTransactResult>`

## IDecisionTrackingPort

`interface` · core-ports

- `registerTrackingRule(input: CreateTrackingRuleInput): Promise<TrackingRule>`
- `updateTrackingRuleHash(oldHash: string, newHash: string): Promise<void>`
- `getActiveRules(): Promise<TrackingRule[]>`
- `getRuleByHash(hash: string): Promise<TrackingRule | null>`
- `getRuleById(id: string): Promise<TrackingRule | null>`
- `deactivateRule(id: string): Promise<void>`
- `deleteRule(id: string): Promise<void>`

## IDesktopGrantsFilterHook

`interface` · hooks

- `readonly extensionName: string`
- `filterGrants(target: InnerDesktopGrantsFilterTarget, context: InnerDesktopGrantsContext): Promise<readonly string[]>`

## IDesktopGrantsFilterRegistryPort

`interface` · hooks

- `register(filter: IDesktopGrantsFilterHook): void`
- `unregister(extensionName: string): void`

## IDesktopGrantsHook

`interface` · hooks

- `readonly extensionName: string`
- `resolveGrants(context: InnerDesktopGrantsContext): Promise<string[]>`

## IDesktopGrantsRegistryPort

`interface` · hooks

- `register(provider: IDesktopGrantsHook): void`

## IDocumentPort

`interface` · core-ports

- `generate(request: InnerGenerateDocumentRequest): Promise<InnerGeneratedDocument>`
- `getByHash(hash: string): Promise<InnerGeneratedDocument | null>`
- `buildAggregate(signedDocument: ISignedDocument): Promise<InnerDocumentAggregate | null>`
- `saveData(payload: Record<string, unknown>, registryId: number): Promise<{ hash: string }>`
- `validateSigned(id: string, signedDocument: ISignedDocument): Promise<InnerDocumentValidation>`

## IExpenseChassisPort

`interface` · cross-plugin-ports

- `readProposalByHash(coopname: string, proposalHash: string): Promise<InnerExpenseProposalRead | null>`
- `readProposalsByHashes(coopname: string, proposalHashes: string[]): Promise<InnerExpenseProposalRead[]>`
- `listProposalsByOwner(`
- `coopname: string,`
- `ownerContract: string,`
- `ownerAction?: string,`
- `pagination?: InnerExpensePagination,`
- `): Promise<InnerExpensePaginatedResult<InnerExpenseProposalRead>>`
- `validateRequisites(coopname: string, items: InnerExpenseRequisiteItemInput[]): Promise<void>`
- `snapshotRequisites(coopname: string, items: InnerExpenseRequisiteItemInput[]): Promise<void>`
- `payItem(coopname: string, proposalHash: string, itemHash: string, actualAmount: string): Promise<void>`
- `returnItem(coopname: string, proposalHash: string, itemHash: string, returnAmount: string): Promise<void>`
- `overspendItem(coopname: string, proposalHash: string, itemHash: string, overspendAmount: string): Promise<void>`
- `reportItem(coopname: string, proposalHash: string, itemHash: string): Promise<void>`
- `getPlannedReserve(coopname: string, branchName: string | null): Promise<InnerExpensePlannedReserve>`
- `attachPlanToProposal(coopname: string, planId: number, proposalHash: string): Promise<void>`

## IExtensionConfigPort

`interface` · core-ports

- `get<T = Record<string, any>>(extensionName: string): Promise<T | null>`

## IExtensionDatabasePort

`interface` · core-ports

- `getConnection(extensionName: string): InnerExtensionDatabaseConnection | null`

## IFileStoragePort

`interface` · core-ports

- `getBucket(spec: InnerFileStorageBucketSpec): InnerFileStorageBucket`

## IFreeDecisionPort

`interface` · core-ports

- `createProjectOfFreeDecision(data: InnerFreeDecisionProject): Promise<unknown>`
- `generateProjectOfFreeDecisionDocument(`
- `data: InnerGenerateProjectFreeDecisionData,`
- `options?: Record<string, any>`
- `): Promise<InnerFreeDecisionDocument>`
- `publishProjectOfFreeDecision(data: InnerPublishProjectFreeDecisionInput): Promise<boolean>`

## IIndividualPort

`interface` · core-ports

- `findByUsername(username: string): Promise<InnerIndividual>`
- `create(individual: InnerIndividual): Promise<void>`

## IIntegrationSettingsPort

`interface` · core-ports

- `get<T = Record<string, any>>(extensionName: string, integration: string): T | null`

## ILedger2HistoryPort

`interface` · core-ports

- `getHistory(filter: InnerLedger2HistoryFilter): Promise<InnerLedger2HistoryResult>`
- `getAccounts(coopname: string): Promise<InnerLedger2Account[]>`

## ILoggerPort

`interface` · core-ports

- `setContext(context: string): void`
- `log(message: string, metaOrError?: InnerLogMeta): void`
- `info(message: string, metaOrError?: InnerLogMeta): void`
- `warn(message: string, metaOrError?: InnerLogMeta): void`
- `debug(message: string, metaOrError?: InnerLogMeta): void`
- `error(message: string, errorOrTrace?: InnerLogMeta, meta?: string | Record<string, any>): void`

## IMarketplaceDocumentParametersHook

`interface` · hooks

- `generateMarketplaceOfferParameters(coopname: string, username: string): Promise<void>`

## IMatrixRoomMessagingPort

`interface` · cross-plugin-ports

- `sendTextMessage(input: InnerMatrixSendTextMessageInput): Promise<string>`
- `sendTextMessageAndPin(input: InnerMatrixSendTextAndPinInput): Promise<string>`
- `replaceTextMessage(input: InnerMatrixReplaceTextMessageInput): Promise<void>`
- `unpinAndRedactAnnouncement(input: InnerMatrixUnpinAndRedactAnnouncementInput): Promise<void>`

## IMeetPort

`interface` · core-ports

- `getMeets(data: InnerGetMeetsInput, username?: string): Promise<InnerMeet[]>`
- `getMeet(data: InnerGetMeetInput, username?: string): Promise<InnerMeet>`
- `getMeetDraft(hash: string): Promise<InnerMeetDraft | null>`

## IMessageChannelPort

`interface` · core-ports

- `publish(channel: string, message: unknown): Promise<void>`
- `subscribe(channel: string, handler: (message: unknown) => void): void`

## IMetaDocument

`interface` · core-ports

- `title: string`
- `registry_id: number`
- `lang: string`
- `generator: string`
- `version: string`
- `coopname: string`
- `username: string`
- `created_at: string`
- `block_num: number`
- `timezone: string`
- `links: string[]`

## IMonoAccount

`interface` · core-ports

- `username: string`
- `status: MonoAccountStatus`
- `message?: string`
- `is_registered: boolean`
- `has_account: boolean`
- `type: 'individual' | 'entrepreneur' | 'organization'`
- `public_key: string`
- `referer: string`
- `email: string`
- `role: string`
- `is_email_verified: boolean`
- `initial_order?: string`
- `subscriber_id: string`
- `subscriber_hash: string`

## IMutationLogPort

`interface` · core-ports

- `findAll(`
- `filter?: InnerMutationLogFilter,`
- `page?: InnerPageRequest`
- `): Promise<InnerPage<InnerMutationLogEntry>>`
- `findById(id: string): Promise<InnerMutationLogEntry | null>`

## INDIVIDUAL_PORT

`const` · core-ports

- `Symbol.for('Innercoop.CorePort.Individual')`

## InnerAccount

`interface` · core-ports

- `username: string`
- `provider_account: IMonoAccount | null`
- `private_account: InnerPrivateAccount | null`
- `account_kind: string`
- `blockchain_account: Record<string, any> | null`
- `user_account: Record<string, any> | null`
- `participant_account: Record<string, any> | null`
- `registration_payment?: Record<string, any> | null`

## InnerAccountType

`enum` · core-ports

- `individual = 'individual',`
- `entrepreneur = 'entrepreneur',`
- `organization = 'organization',`

## InnerAgreementCatalogItem

`interface` · core-ports

- `id: string`
- `registry_id: number`
- `title: string`
- `[key: string]: any`

## InnerAgreementRegistration

`interface` · core-ports

- `id: string`
- `registry_id: number`
- `agreement_type: string`
- `title: string`
- `checkbox_text: string`
- `link_text: string`
- `applicable_account_types: InnerAccountType[]`
- `order: number`
- `extension_name: string`
- `resolve_doc_data_hash?: () => Promise<string | undefined>`

## InnerBankTransferData

`interface` · core-ports

- `account_number: string`
- `bank_name: string`
- `card_number?: string`
- `currency: string`
- `details: {`
- `bik: string`
- `corr: string`
- `}`

## InnerBranch

`interface` · core-ports

- `braname: string`
- `trustee: string`
- `trusted: string[]`
- `is_private?: boolean`
- `whitelist?: string[]`
- `[key: string]: any`

## InnerCalendarEventWindow

`interface` · cross-plugin-ports

- `fromInclusive: string`
- `toExclusive: string`

## InnerCandidate

`interface` · core-ports

- `username: string`
- `coopname: string`
- `status: string`
- `type: string`
- `created_at: Date`
- `public_key: string`
- `username_display_name?: string`
- `braname?: string`
- `registered_at?: Date`
- `referer?: string`
- `referer_display_name?: string`
- `program_key?: string`

## InnerCandidateDocument

`interface` · core-ports

- `doc_hash: string`
- `[key: string]: any`

## InnerCandidateFilter

`interface` · core-ports

- `referer?: string`
- `[key: string]: any`

## InnerChainAccountResources

`interface` · core-ports

- `[key: string]: any`

## InnerChainAccountRow

`interface` · core-ports

- `username?: string`
- `registered_at?: string`
- `[key: string]: any`

## InnerChainAction

`interface` · core-ports

- `account: string`
- `name: string`
- `authorization: Array<{ actor: string`
- `permission: string }>`
- `data: Record<string, any>`

## InnerChainActionRecord

`interface` · core-ports

- `id?: string`
- `transaction_id: string`
- `account: string`
- `block_num: number`
- `block_id: string`
- `block_time?: string`
- `chain_id: string`
- `name: string`
- `receiver: string`
- `authorization: Array<{ actor: string`
- `permission: string }>`
- `data: Record<string, any>`
- `action_ordinal: number`
- `global_sequence: string`
- `account_ram_deltas: Array<{ account: string`
- `delta: number }>`
- `console?: string`
- `receipt: {`
- `receiver: string`
- `act_digest: string`
- `global_sequence: string`
- `recv_sequence: string`
- `auth_sequence: Array<{ account: string`
- `sequence: string }>`
- `code_sequence: number`
- `abi_sequence: number`
- `}`
- `creator_action_ordinal: number`
- `context_free: boolean`
- `elapsed: number`
- `repeat?: boolean`
- `created_at?: Date`

## InnerCompletedCallTranscriptionHead

`interface` · cross-plugin-ports

- `id: string`
- `matrixRoomId: string`
- `roomName: string`
- `startedAt: Date`
- `endedAt: Date | null`

## InnerCoopAgreement

`interface` · core-ports

- `program_id: string | number`
- `[key: string]: any`

## InnerCoopCalendarEventNotificationInput

`interface` · cross-plugin-ports

- `title: string`
- `description: string | null`
- `startsAt: Date`
- `endsAt: Date | null`
- `roomDisplayLabel: string`
- `eventUrl: string`
- `actorUsername: string`
- `roomKind: InnerCoopCalendarNotificationRoomKind`
- `projectHash: string | null`

## InnerCoopCalendarEventRead

`interface` · cross-plugin-ports

- `id: string`
- `matrixRoomId: string`
- `projectHash: string | null`
- `title: string`
- `description: string | null`
- `startsAtIso: string`
- `endsAtIso: string | null`
- `createdByUsername: string`
- `icsSequence: number`

## InnerCoopCalendarNotificationRoomKind

`type` · cross-plugin-ports

- `'members' | 'council' | 'capital_project' | 'secretary'`

## InnerCooperativeVars

`interface` · core-ports

- `coopname: string`
- `name: string`
- `shortAbbr: string`

## InnerCoopProgram

`interface` · core-ports

- `id: string | number`
- `draft_id: string | number`
- `[key: string]: any`

## InnerCoopUser

`interface` · core-ports

- `username: string`
- `email: string`
- `role: string`
- `[key: string]: any`

## InnerCouncilDecision

`interface` · core-ports

- `id: string | number`
- `expired_at?: string`
- `[key: string]: any`

## InnerDesktopGrantsContext

`interface` · hooks

- `coopname: string`
- `username?: string`
- `userRole?: string`
- `userStatus?: string`
- `config?: Record<string, any>`

## InnerDesktopGrantsFilterTarget

`interface` · hooks

- `extensionName: string`
- `grants: readonly string[]`

## InnerDocumentAggregate

`interface` · core-ports

- `hash: string`
- `document: ISignedDocument & Record<string, any>`
- `rawDocument?: InnerGeneratedDocument`

## InnerDocumentValidation

`interface` · core-ports

- `id: string | number`
- `is_valid: boolean`
- `error_message?: string`
- `original_found: boolean`
- `hash_matches: boolean`
- `signatures_valid: boolean`

## InnerEnsureProgramParams

`interface` · core-ports

- `coopname: string`
- `type: string`
- `title: string`
- `is_can_coop_spend_share_contributions?: boolean`

## InnerEnsureProgramResult

`interface` · core-ports

- `created: boolean`
- `program_id: number`

## InnerExpenseCallbackHandler

`interface` · cross-plugin-ports

- `contract: string`
- `action: string`
- `data: string`

## InnerExpenseItem

`interface` · cross-plugin-ports

- `itemHash: string`
- `mechanics: number`
- `recipientType: number`
- `recipient: string`
- `description: string`
- `plannedAmount: string`
- `actualAmount: string`
- `status: number`

## InnerExpenseItemInput

`interface` · cross-plugin-ports

- `item_hash: string`
- `mechanics: InnerExpenseMechanics`
- `recipient_type: InnerExpenseRecipientType`
- `recipient: string`
- `description: string`
- `planned_amount: string`
- `payment_method_id?: string`
- `requisites?: string`
- `payment_purpose?: string`

## InnerExpenseItemState

`enum` · cross-plugin-ports

- `APPROVED = 'APPROVED',`
- `PAID = 'PAID',`
- `REPORTED = 'REPORTED',`
- `RETURNED = 'RETURNED',`
- `OVERSPENT = 'OVERSPENT',`
- `UNDEFINED = 'UNDEFINED',`

## InnerExpenseMechanics

`enum` · cross-plugin-ports

- `ADVANCE = 'ADVANCE',`
- `DIRECT = 'DIRECT',`

## InnerExpensePaginatedResult

`interface` · cross-plugin-ports

- `items: T[]`
- `totalCount: number`

## InnerExpensePagination

`interface` · cross-plugin-ports

- `limit?: number`
- `offset?: number`
- `sortBy?: 'createdAt' | 'updatedAt'`
- `sortOrder?: 'ASC' | 'DESC'`

## InnerExpensePlannedReserve

`interface` · cross-plugin-ports

- `amount: number`
- `horizonDays: number`

## InnerExpenseProposalRead

`interface` · cross-plugin-ports

- `coopname: string`
- `proposalHash: string`
- `sourceWalletCode: string`
- `creator: string`
- `status: InnerExpenseProposalStatus`
- `callback?: InnerExpenseCallbackHandler`
- `items: InnerExpenseItem[]`
- `totalPlanned: string`
- `totalActual: string`
- `createdAt: string`
- `updatedAt: string`

## InnerExpenseProposalState

`enum` · cross-plugin-ports

- `CREATED = 'CREATED',`
- `AUTHORIZED = 'AUTHORIZED',`
- `PARTIALLY_PAID = 'PARTIALLY_PAID',`
- `REPORT_SUBMITTED = 'REPORT_SUBMITTED',`
- `CLOSED = 'CLOSED',`
- `DECLINED = 'DECLINED',`
- `UNDEFINED = 'UNDEFINED',`

## InnerExpenseProposalStatus

`type` · cross-plugin-ports

- `| 'CREATED' | 'AUTHORIZED' | 'PARTIALLY_PAID' | 'REPORT_SUBMITTED' | 'CLOSED' | 'DECLINED' | 'UNDEFINED'`

## InnerExpenseRecipientType

`enum` · cross-plugin-ports

- `SELF = 'SELF',`
- `MEMBER = 'MEMBER',`
- `ORG = 'ORG',`

## InnerExpenseRequisiteItemInput

`interface` · cross-plugin-ports

- `proposalHash: string`
- `itemHash: string`
- `recipient: string`
- `isOrganization: boolean`
- `mechanics: 'ADVANCE' | 'DIRECT'`
- `paymentMethodId?: string`
- `requisites?: string`
- `paymentPurpose?: string`

## InnerExtensionDatabaseConnection

`interface` · core-ports

- `host: string`
- `port: number`
- `username: string`
- `password: string`
- `database: string`

## InnerFileStorageBody

`type` · core-ports

- `ReadableStream<Uint8Array> | Uint8Array`

## InnerFileStorageBucket

`interface` · core-ports

- `put(`
- `key: string,`
- `body: InnerFileStorageBody,`
- `opts: InnerFileStoragePutOptions,`
- `): Promise<InnerFileStoragePutResult>`
- `getReadUrl(`
- `key: string,`
- `opts?: InnerFileStorageGetReadUrlOptions,`
- `): Promise<string>`
- `delete(key: string): Promise<void>`
- `head(key: string): Promise<InnerFileStorageObjectMetadata>`

## InnerFileStorageBucketSpec

`interface` · core-ports

- `name: string`
- `maxBytes: number`
- `allowedMime: readonly string[]`
- `metadataSchema?: Readonly<Record<string, 'required' | 'optional'>>`
- `defaultUrlTtlSeconds?: number`

## InnerFileStorageGetReadUrlOptions

`interface` · core-ports

- `ttlSeconds?: number`

## InnerFileStorageObjectMetadata

`interface` · core-ports

- `size: number`
- `etag: string`
- `contentType: string`
- `lastModified: Date`
- `metadata: Readonly<Record<string, string>>`

## InnerFileStoragePutOptions

`interface` · core-ports

- `contentType: string`
- `metadata?: Readonly<Record<string, string>>`

## InnerFileStoragePutResult

`interface` · core-ports

- `key: string`
- `etag: string`
- `size: number`

## InnerFreeDecisionDocument

`interface` · core-ports

- `hash: string`
- `meta: IMetaDocument & { [key: string]: any }`
- `[key: string]: any`

## InnerFreeDecisionProject

`interface` · core-ports

- `id: string`
- `title?: string`
- `question: string`
- `decision: string`

## InnerGeneratedDocument

`interface` · core-ports

- `full_title: string`
- `html: string`
- `hash: string`
- `meta: Record<string, any>`
- `binary: string`

## InnerGenerateDocumentData

`interface` · core-ports

- `registry_id: number`
- `coopname: string`
- `username: string`
- `doc_data?: Record<string, unknown>`
- `doc_data_hash?: string`
- `[key: string]: any`

## InnerGenerateDocumentOptions

`interface` · core-ports

- `skip_save?: boolean`
- `lang?: string`

## InnerGenerateDocumentRequest

`interface` · core-ports

- `data: InnerGenerateDocumentData`
- `options?: InnerGenerateDocumentOptions`

## InnerGenerateProjectFreeDecisionData

`interface` · core-ports

- `project_id: string`
- `coopname: string`
- `username: string`
- `registry_id: number`
- `title?: string`
- `[key: string]: any`

## InnerGetAccountsFilter

`interface` · core-ports

- `[key: string]: any`

## InnerGetMeetInput

`interface` · core-ports

- `coopname: string`
- `hash: string`

## InnerGetMeetsInput

`interface` · core-ports

- `coopname: string`
- `username?: string`

## InnerIndividual

`interface` · core-ports

- `username: string`
- `first_name: string`
- `last_name: string`
- `middle_name: string`
- `birthdate: string`
- `full_address: string`
- `phone: string`
- `email: string`
- `passport?: InnerPassport`

## InnerKeyPermission

`enum` · core-ports

- `ACTIVE = 'active',`

## InnerLedger2Account

`interface` · core-ports

- `id: number`
- `name: string`
- `balance: string`
- `debitBalance: string`
- `creditBalance: string`
- `[key: string]: any`

## InnerLedger2HistoryFilter

`interface` · core-ports

- `coopname: string`
- `accountId?: number`
- `walletName?: string`
- `actionNames?: string[]`
- `operationCodes?: string[]`
- `username?: string`
- `processHash?: string`
- `parentApplyGlobalSequence?: string`
- `applyGlobalSequence?: string`
- `walletopGlobalSequence?: string`
- `dateFrom?: Date`
- `dateTo?: Date`
- `page?: number`
- `limit?: number`
- `sortOrder?: 'ASC' | 'DESC'`

## InnerLedger2HistoryResult

`interface` · core-ports

- `items: InnerLedger2Operation[]`
- `totalCount: number`
- `totalPages: number`
- `currentPage: number`

## InnerLedger2Operation

`interface` · core-ports

- `globalSequence: string`
- `blockNum: number`
- `coopname: string`
- `action: string`
- `operationCode?: string | null`
- `processHash?: string | null`
- `username?: string | null`
- `accountId?: number | null`
- `walletFrom?: string | null`
- `walletTo?: string | null`
- `quantity?: string | null`
- `memo?: string | null`
- `parentApplyGlobalSequence?: string | null`
- `createdAt: Date`

## InnerLogMeta

`type` · core-ports

- `string | Error | Record<string, any>`

## InnerMatrixReplaceTextMessageInput

`interface` · cross-plugin-ports

- `matrixRoomId: string`
- `rootEventId: string`
- `plainTextBody: string`

## InnerMatrixSendTextAndPinInput

`interface` · cross-plugin-ports

- `matrixRoomId: string`
- `plainTextBody: string`

## InnerMatrixSendTextMessageInput

`type` · cross-plugin-ports

- `InnerMatrixSendTextAndPinInput`

## InnerMatrixUnpinAndRedactAnnouncementInput

`interface` · cross-plugin-ports

- `matrixRoomId: string`
- `rootEventId: string`

## InnerMeet

`interface` · core-ports

- `hash: string`
- `pre?: Record<string, any> | null`
- `processing?: InnerMeetProcessing | null`
- `processed?: Record<string, any> | null`

## InnerMeetDraft

`interface` · core-ports

- `hash: string`
- `details?: string | null`
- `[key: string]: any`

## InnerMeetProcessing

`interface` · core-ports

- `hash: string`
- `extendedStatus: ExtendedMeetStatus`
- `meet: InnerMeetRow`

## InnerMeetRow

`interface` · core-ports

- `id: number`
- `coopname: string`
- `status: string`
- `open_at: Date`
- `close_at: Date`
- `[key: string]: any`

## InnerMutationLogEntry

`interface` · core-ports

- `_id: string`
- `coopname?: string`
- `mutation_name: string`
- `username: string`
- `arguments: Record<string, any>`
- `duration_ms: number`
- `status: 'success' | 'error'`
- `error_message?: string`
- `created_at: Date`
- `[key: string]: any`

## InnerMutationLogFilter

`interface` · core-ports

- `coopname?: string`
- `username?: string`
- `mutation_names?: string[]`
- `date_from?: string | Date`
- `date_to?: string | Date`
- `status?: 'success' | 'error'`
- `[key: string]: any`

## InnerNonProjectCommunicationRoomRef

`interface` · cross-plugin-ports

- `matrixRoomId: string`
- `displayLabel: string`
- `kind: InnerNonProjectRoomKind`

## InnerNonProjectRoomKind

`type` · cross-plugin-ports

- `'members' | 'council' | 'secretary'`

## InnerNotifyActor

`interface` · core-ports

- `subscriberId: string`
- `email?: string`

## InnerNotifyInput

`interface` · core-ports

- `coopname: string`
- `workflowId: string`
- `to: InnerNotifyRecipient | InnerNotifyRecipient[]`
- `payload?: Record<string, unknown>`
- `actor?: InnerNotifyActor`

## InnerNotifyRecipient

`interface` · core-ports

- `subscriberId: string`
- `email?: string`
- `username?: string`

## InnerNotifyResult

`interface` · core-ports

- `acknowledged: boolean`
- `outboxIds: string[]`

## InnerOnboardingCompletedPayload

`interface` · core-ports

- `extension_name: string`

## InnerOnboardingDecisionKind

`type` · core-ports

- `'SOVIET_DECISION' | 'MEET_DECISION'`

## InnerOnboardingGenerator

`type` · core-ports

- `'free_decision' | 'meet'`

## InnerOnboardingStep

`interface` · core-ports

- `extension_name: string`
- `step_key: string`
- `event_type: InnerOnboardingDecisionKind`
- `vars_field: string`
- `generator: InnerOnboardingGenerator`
- `default_title?: string`
- `order: number`

## InnerOrganization

`interface` · core-ports

- `username: string`
- `type: string`
- `short_name: string`
- `full_name: string`
- `represented_by: InnerRepresentative`
- `country: string`
- `city: string`
- `full_address: string`
- `fact_address: string`
- `phone: string`
- `email: string`
- `details: InnerOrganizationDetails`

## InnerOrganizationDetails

`interface` · core-ports

- `inn: string`
- `ogrn: string`
- `kpp: string`

## InnerOrganizationType

`enum` · core-ports

- `COOP = 'coop',`
- `PRODCOOP = 'prodcoop',`
- `OOO = 'ooo',`
- `OAO = 'oao',`
- `ZAO = 'zao',`
- `PAO = 'pao',`
- `AO = 'ao',`

## InnerPage

`interface` · core-ports

- `items: T[]`
- `totalCount: number`
- `totalPages: number`
- `currentPage: number`

## InnerPageRequest

`interface` · core-ports

- `page: number`
- `limit: number`
- `sortBy?: string`
- `sortOrder: 'ASC' | 'DESC'`

## InnerPaginatedAccounts

`interface` · core-ports

- `items: InnerAccount[]`
- `totalCount: number`
- `totalPages: number`
- `currentPage: number`

## InnerPaginationOptions

`interface` · core-ports

- `page?: number`
- `limit?: number`
- `sortBy?: string`
- `sortOrder?: 'ASC' | 'DESC'`

## InnerParticipantRegisteredEvent

`interface` · core-ports

- `username: string`
- `program_key?: ProgramKey`
- `braname?: string`
- `account_type: string`
- `blagorost_offer_hash?: string`
- `generator_offer_hash?: string`

## InnerPassport

`interface` · core-ports

- `series: number`
- `number: number`
- `issued_by: string`
- `issued_at: string`
- `code: string`

## InnerPayment

`interface` · core-ports

- `id?: string`
- `hash: string`
- `coopname: string`
- `username: string`
- `quantity: number`
- `symbol: string`
- `type: PaymentType`
- `direction: PaymentDirection`
- `status: PaymentStatus`
- `provider?: string`
- `payment_method_id?: string`
- `secret?: string`
- `message?: string`
- `memo?: string`
- `expired_at?: Date`
- `completed_at?: Date`
- `failed_at?: Date`
- `created_at: Date`
- `updated_at?: Date`
- `payment_details?: InnerPaymentDetails`
- `blockchain_data?: Record<string, any>`
- `statement?: ISignedDocument`
- `related_extension?: string | null`
- `related_entity_id?: string | null`

## InnerPaymentDetails

`interface` · core-ports

- `data: Record<string, any>`
- `amount_plus_fee: string`
- `amount_without_fee: string`
- `fee_amount: string`
- `fee_percent: number`
- `fact_fee_percent: number`
- `tolerance_percent: number`

## InnerPaymentDraft

`type` · core-ports

- `Omit<InnerPayment, 'id'>`

## InnerPaymentFilters

`interface` · core-ports

- `coopname?: string`
- `username?: string`
- `status?: PaymentStatus`
- `type?: PaymentType`
- `direction?: PaymentDirection`
- `provider?: string`
- `hash?: string`
- `secret?: string`

## InnerPaymentMethod

`interface` · core-ports

- `username: string`
- `method_id: string`
- `method_type: InnerPaymentMethodType`
- `data: TData`
- `is_default: boolean`
- `created_at: Date`
- `updated_at: Date`

## InnerPaymentMethodDraft

`interface` · core-ports

- `username: string`
- `method_id: string`
- `method_type: InnerPaymentMethodType`
- `data: TData`
- `is_default?: boolean`

## InnerPaymentMethodQuery

`interface` · core-ports

- `username: string`
- `method_type?: InnerPaymentMethodType`
- `method_id?: string`
- `is_default?: boolean`

## InnerPaymentMethodType

`type` · core-ports

- `'sbp' | 'bank_transfer'`

## InnerPaymentNotice

`interface` · core-ports

- `id?: string`
- `provider: string`
- `data: object`
- `created_at?: Date`
- `updated_at?: Date`

## InnerPaymentPollingState

`interface` · core-ports

- `accountNumber: string`
- `statementDate: string`
- `lastProcessedPage: number`

## InnerPrivateAccount

`interface` · core-ports

- `type: InnerAccountType`
- `individual_data?: Record<string, any>`
- `organization_data?: Record<string, any>`
- `entrepreneur_data?: Record<string, any>`

## InnerProgramRegistration

`interface` · core-ports

- `key: string`
- `title: string`
- `description: string`
- `image_url?: string`
- `requirements?: string`
- `applicable_account_types: InnerAccountType[]`
- `agreement_ids: string[]`
- `order: number`
- `extension_name: string`

## InnerProgramSignature

`interface` · core-ports

- `program_id: string | number`
- `signed_at?: string`
- `[key: string]: any`

## InnerProgramWallet

`interface` · core-ports

- `id?: string`
- `coopname?: string`
- `program_id?: string`
- `program_type?: ProgramType`
- `agreement_id?: string`
- `username?: string`
- `available?: string`
- `blocked?: string`
- `membership_contribution?: string`

## InnerProgramWalletFilter

`interface` · core-ports

- `coopname?: string`
- `username?: string`
- `program_id?: string`

## InnerProjectCommunicationRoomRef

`interface` · cross-plugin-ports

- `matrixRoomId: string`
- `displayLabel: string`

## InnerPublishProjectFreeDecisionInput

`interface` · core-ports

- `coopname: string`
- `username: string`
- `meta: string`
- `document: ISignedDocument`

## InnerRegistrationOfferFilterContext

`interface` · hooks

- `coopname?: string`
- `accountType?: InnerAccountType | string`

## InnerRepresentative

`interface` · core-ports

- `first_name: string`
- `last_name: string`
- `middle_name: string`
- `position: string`
- `based_on: string`

## InnerRoomMessageKind

`type` · cross-plugin-ports

- `'text' | 'audio'`

## InnerRoomMessageLine

`interface` · cross-plugin-ports

- `originServerTs: number`
- `authorLabel: string`
- `coopUsername: string | null`
- `kind: InnerRoomMessageKind`
- `bodyText: string`

## InnerSbpData

`interface` · core-ports

- `phone: string`

## InnerSetPaymentStatusInput

`interface` · core-ports

- `id: string`
- `status: PaymentStatus`
- `message?: string`

## InnerSignProgramAgreementInput

`interface` · core-ports

- `coopname: string`
- `username: string`
- `program_id: number`
- `draft_id: number`
- `document: ISignedDocument`

## InnerSystemOutgoingPaymentInput

`interface` · core-ports

- `coopname: string`
- `username: string`
- `quantity: number`
- `symbol: string`
- `memo: string`
- `type?: PaymentType`
- `status?: PaymentStatus`
- `related_extension: string`
- `related_entity_id: string`
- `payment_hash: string`
- `payment_method_id?: string`
- `payment_details?: InnerPaymentDetails`

## InnerTransactResult

`interface` · core-ports

- `response?: Record<string, any>`
- `resolved?: Record<string, any>`
- `[key: string]: any`

## InnerUserCertificate

`interface` · core-ports

- `username: string`
- `short_name?: string`
- `first_name?: string`
- `last_name?: string`
- `middle_name?: string`
- `[key: string]: any`

## InnerUserDataDraft

`interface` · core-ports

- `coopname: string`
- `username: string`
- `key: string`
- `value: string`
- `metadata?: Record<string, any>`

## InnerUserDataFilters

`interface` · core-ports

- `metadata?: Record<string, any>`
- `block_num?: number`
- `deleted?: boolean`

## InnerUserDataRecord

`interface` · core-ports

- `coopname: string`
- `username: string`
- `key: string`
- `value: string`
- `metadata?: Record<string, any>`
- `deleted?: boolean`
- `block_num?: number`

## InnerUserWallet

`interface` · core-ports

- `id?: string`
- `coopname?: string`
- `wallet_name?: string`
- `username?: string`
- `available?: string`
- `blocked?: string`

## InnerVerificationCheck

`interface` · core-ports

- `passed: boolean`
- `missing: string[]`

## InnerVerificationEntry

`interface` · core-ports

- `type: string`
- `verified_at: string`
- `attested_by?: string`

## INotificationPort

`interface` · core-ports

- `notify(input: InnerNotifyInput): Promise<InnerNotifyResult>`
- `notifyUser<T extends Record<string, unknown>>(`
- `username: string,`
- `workflowId: string,`
- `payload: T,`
- `actor?: InnerNotifyActor`
- `): Promise<InnerNotifyResult>`

## INTEGRATION_SETTINGS_PORT

`const` · core-ports

- `Symbol.for('Innercoop.CorePort.IntegrationSettings')`

## IOnboardingStepRegistryPort

`interface` · core-ports

- `registerStep(step: InnerOnboardingStep): void`
- `unregisterStepsByExtension(extensionName: string): void`

## IOrganizationPort

`interface` · core-ports

- `findByUsername(username: string): Promise<InnerOrganization>`
- `create(organization: InnerOrganization): Promise<void>`

## IPaymentDeskPort

`interface` · core-ports

- `getPayments(filters: InnerPaymentFilters, page: InnerPageRequest): Promise<InnerPage<InnerPayment>>`
- `setPaymentStatus(input: InnerSetPaymentStatusInput): Promise<InnerPayment>`
- `createSystemOutgoingPayment(input: InnerSystemOutgoingPaymentInput): Promise<InnerPayment>`

## IPaymentMethodPort

`interface` · core-ports

- `get(query: InnerPaymentMethodQuery): Promise<InnerPaymentMethod>`
- `list(username: string, page: InnerPageRequest): Promise<InnerPage<InnerPaymentMethod>>`
- `save(method: InnerPaymentMethodDraft): Promise<InnerPaymentMethod>`
- `remove(username: string, methodId: string): Promise<void>`

## IPaymentNoticeLogPort

`interface` · core-ports

- `find(criteria: Partial<InnerPaymentNotice>): Promise<InnerPaymentNotice | null>`
- `record(notice: Omit<InnerPaymentNotice, 'id' | 'created_at' | 'updated_at'>): Promise<InnerPaymentNotice>`

## IPaymentPollingStatePort

`interface` · core-ports

- `find(accountNumber: string, statementDate: string): Promise<InnerPaymentPollingState | null>`
- `save(state: InnerPaymentPollingState): Promise<InnerPaymentPollingState>`

## IPaymentPort

`interface` · core-ports

- `findByHash(hash: string): Promise<InnerPayment | null>`
- `create(payment: InnerPaymentDraft): Promise<InnerPayment>`
- `update(id: string, data: Partial<InnerPayment>): Promise<InnerPayment | null>`
- `list(filters: InnerPaymentFilters, page: InnerPageRequest): Promise<InnerPage<InnerPayment>>`

## IPaymentProvider

`interface` · core-ports

- `createPayment(hash: string): Promise<InnerPaymentDetails>`

## IPaymentProviderRegistryPort

`interface` · core-ports

- `registerProvider(name: string, provider: IPaymentProvider): void`
- `getProvider(name: string): IPaymentProvider | undefined`

## IProgramAgreementPort

`interface` · core-ports

- `findProgramSignature(coopname: string, username: string, programId: number): Promise<InnerProgramSignature | null>`
- `signProgramAgreement(input: InnerSignProgramAgreementInput): Promise<InnerTransactResult>`

## IProgramDocumentParametersHook

`interface` · hooks

- `generateBlagorostOfferParameters(coopname: string, username: string): Promise<void>`
- `generateGeneratorOfferParameters(coopname: string, username: string): Promise<void>`
- `generateGenerationContractParameters(coopname: string, username: string): Promise<void>`
- `generateStorageAgreementParameters(coopname: string, username: string): Promise<void>`
- `generateBlagorostAgreementParametersIfNotExist(coopname: string, username: string): Promise<void>`

## IProgramOfferParametersHook

`interface` · hooks

- `readonly programKey: string`
- `generateOfferParameters(coopname: string, username: string): Promise<void>`

## IProgramWalletPort

`interface` · core-ports

- `getProgramWallet(filter: InnerProgramWalletFilter): Promise<InnerProgramWallet | null>`
- `getProgramWallets(filter: InnerProgramWalletFilter): Promise<InnerProgramWallet[]>`

## IProjectCapitalClearancePort

`interface` · cross-plugin-ports

- `listUsernamesWithConfirmedProjectClearance(projectHash: string): Promise<string[]>`
- `canReadProjectCommunication(input: {`
- `username: string`
- `role?: string`
- `projectHash: string`
- `}): Promise<boolean>`

## IProjectCommunicationArtifactsPort

`interface` · cross-plugin-ports

- `listCommunicationRoomsForProject(projectHash: string): Promise<InnerProjectCommunicationRoomRef[]>`
- `listNonProjectCommunicationRooms(): Promise<InnerNonProjectCommunicationRoomRef[]>`
- `listUtcDatesWithNewMessages(`
- `matrixRoomId: string,`
- `afterOriginServerTsExclusive: number`
- `): Promise<string[]>`
- `getMessagesForRoomAndUtcDate(matrixRoomId: string, utcDate: string): Promise<InnerRoomMessageLine[]>`
- `getMaxOriginServerTsForRoom(matrixRoomId: string): Promise<number | null>`
- `listCompletedTranscriptionsEndedAfter(`
- `matrixRoomIds: string[],`
- `endedAfterExclusive: Date`
- `): Promise<InnerCompletedCallTranscriptionHead[]>`
- `getMaxCompletedEndedAtForRooms(matrixRoomIds: string[]): Promise<Date | null>`
- `renderCompletedCallTranscriptionMarkdown(transcriptionId: string): Promise<string | null>`

## IRealtimeChannelPort

`interface` · core-ports

- `publish(trigger: string, payload: Record<string, any>): Promise<void>`
- `asyncIterator<T = any>(trigger: string | string[]): AsyncIterator<T>`

## IRegistrationDocumentParametersRegistryPort

`interface` · hooks

- `registerProgramHook(hook: IProgramDocumentParametersHook): void`
- `registerMarketplaceHook(hook: IMarketplaceDocumentParametersHook): void`
- `registerProgramOfferHook(hook: IProgramOfferParametersHook): void`

## IRegistrationOfferFilterHook

`interface` · hooks

- `readonly extensionName: string`
- `filterPrograms(programs: readonly InnerProgramRegistration[], context: InnerRegistrationOfferFilterContext): readonly string[]`
- `filterAgreements(`
- `agreements: readonly InnerAgreementRegistration[],`
- `context: InnerRegistrationOfferFilterContext`
- `): readonly string[]`

## IRegistrationOfferFilterRegistryPort

`interface` · hooks

- `register(filter: IRegistrationOfferFilterHook): void`
- `unregister(extensionName: string): void`

## IRegistrationRegistryPort

`interface` · core-ports

- `registerAgreement(spec: InnerAgreementRegistration): void`
- `unregisterAgreement(id: string, extensionName: string): void`
- `registerProgram(spec: InnerProgramRegistration): void`
- `unregisterProgram(key: string, extensionName: string): void`

## ISecretCipherPort

`interface` · core-ports

- `encrypt(plaintext: string): string`
- `decrypt(ciphertext: string): string`

## ISignatureInfo

`interface` · core-ports

- `id: number`
- `signed_hash: string`
- `signer: string`
- `public_key: string`
- `signature: string`
- `signed_at: string`
- `meta: string`

## ISignedDocument

`type` · core-ports

- `{ version: string`

## IUserCertificatePort

`interface` · core-ports

- `getCertificateByUsername(username: string): Promise<InnerUserCertificate | null>`

## IUserDataPort

`interface` · core-ports

- `save(record: InnerUserDataDraft): Promise<void>`
- `get(`
- `coopname: string,`
- `username: string,`
- `key: string,`
- `filters?: InnerUserDataFilters`
- `): Promise<InnerUserDataRecord | null>`
- `getHistory(coopname: string, username: string, key: string): Promise<InnerUserDataRecord[]>`
- `getAll(coopname: string, username?: string): Promise<InnerUserDataRecord[]>`
- `remove(coopname: string, username: string, key: string): Promise<void>`

## IUserDirectoryPort

`interface` · core-ports

- `findByUsername(username: string): Promise<InnerCoopUser | null>`
- `findByRoles(roles: string[]): Promise<InnerCoopUser[]>`
- `findBySubject(subject: string): Promise<InnerCoopUser>`

## IUserWalletPort

`interface` · core-ports

- `findByWalletAndUsername(coopname: string, walletName: string, username: string): Promise<InnerUserWallet | null>`
- `findByUsername(coopname: string, username: string): Promise<InnerUserWallet[]>`
- `findByWallet(coopname: string, walletName: string): Promise<InnerUserWallet[]>`

## IVaultPort

`interface` · core-ports

- `getWif(username: string, permission?: InnerKeyPermission): Promise<string | null>`

## IVerificationPort

`interface` · core-ports

- `getVerificationTypes(username: string): Promise<InnerVerificationEntry[]>`
- `checkRequired(username: string, actionCode: string): Promise<InnerVerificationCheck>`

## LEDGER2_HISTORY_PORT

`const` · core-ports

- `Symbol.for('Innercoop.CorePort.Ledger2History')`

## LOGGER_PORT

`const` · core-ports

- `Symbol.for('Innercoop.CorePort.Logger')`

## MATRIX_ROOM_MESSAGING_PORT

`const` · cross-plugin-ports

- `Symbol.for('Innercoop.CrossPlugin.MatrixRoomMessaging')`

## MEET_PORT

`const` · core-ports

- `Symbol.for('Innercoop.CorePort.Meet')`

## MESSAGE_CHANNEL_PORT

`const` · core-ports

- `Symbol.for('Innercoop.CorePort.MessageChannel')`

## MonoAccountStatus

`enum` · core-ports

- `'Created' = 'created',`
- `'Joined' = 'joined',`
- `'Payed' = 'payed',`
- `'Registered' = 'registered',`
- `'Active' = 'active',`
- `'Failed' = 'failed',`
- `'Refunding' = 'refunding',`
- `'Refunded' = 'refunded',`
- `'Blocked' = 'blocked',`

## MUTATION_LOG_PORT

`const` · core-ports

- `Symbol.for('Innercoop.CorePort.MutationLog')`

## NOTIFICATION_PORT

`const` · core-ports

- `Symbol.for('Innercoop.CorePort.Notification')`

## ONBOARDING_COMPLETED_EVENT

`const` · core-ports


## ONBOARDING_STEP_REGISTRY_PORT

`const` · core-ports

- `Symbol.for('Innercoop.CorePort.OnboardingStepRegistry')`

## ORGANIZATION_PORT

`const` · core-ports

- `Symbol.for('Innercoop.CorePort.Organization')`

## PARTICIPANT_REGISTERED_EVENT

`const` · core-ports


## PAYMENT_DESK_PORT

`const` · core-ports

- `Symbol.for('Innercoop.CorePort.PaymentDesk')`

## PAYMENT_METHOD_PORT

`const` · core-ports

- `Symbol.for('Innercoop.CorePort.PaymentMethod')`

## PAYMENT_NOTICE_LOG_PORT

`const` · core-ports

- `Symbol.for('Innercoop.CorePort.PaymentNoticeLog')`

## PAYMENT_POLLING_STATE_PORT

`const` · core-ports

- `Symbol.for('Innercoop.CorePort.PaymentPollingState')`

## PAYMENT_PORT

`const` · core-ports

- `Symbol.for('Innercoop.CorePort.Payment')`

## PAYMENT_PROVIDER_REGISTRY_PORT

`const` · core-ports

- `Symbol.for('Innercoop.CorePort.PaymentProviderRegistry')`

## PaymentDirection

`enum` · core-ports

- `INCOMING = 'incoming',`
- `OUTGOING = 'outgoing',`

## PaymentStatus

`enum` · core-ports

- `AWAITING_AUTHORIZATION = 'awaiting_authorization',`
- `PENDING = 'pending',`
- `PROCESSING = 'processing',`
- `PAID = 'paid',`
- `COMPLETED = 'completed',`
- `FAILED = 'failed',`
- `EXPIRED = 'expired',`
- `CANCELLED = 'cancelled',`
- `REFUNDED = 'refunded',`

## PaymentType

`enum` · core-ports

- `REGISTRATION = 'registration',`
- `DEPOSIT = 'deposit',`
- `WITHDRAWAL = 'withdrawal',`
- `PAYMENT = 'payment',`
- `REGISTRATION_REFUND = 'registration_refund',`
- `MEMBERSHIP_EXIT = 'membership_exit',`
- `EXPENSE = 'expense',`
- `EXPENSE_RETURN = 'expense_return',`
- `EXPENSE_OVERSPEND = 'expense_overspend',`
- `AID = 'aid',`
- `TAX = 'tax',`

## PROGRAM_AGREEMENT_PORT

`const` · core-ports

- `Symbol.for('Innercoop.CorePort.ProgramAgreement')`

## PROGRAM_ID_BY_TYPE

`const` · core-ports


## PROGRAM_TYPE_BY_ID

`const` · core-ports


## PROGRAM_WALLET_PORT

`const` · core-ports

- `Symbol.for('Innercoop.CorePort.ProgramWallet')`

## ProgramKey

`enum` · core-ports

- `GENERATION = 'GENERATION',`
- `CAPITALIZATION = 'CAPITALIZATION',`
- `MARKETPLACE = 'MARKETPLACE',`
- `EDUCATION = 'EDUCATION',`
- `EDUCATION_TEACHING = 'EDUCATION_TEACHING',`
- `UNDEFINED = 'UNDEFINED',`

## ProgramType

`enum` · core-ports

- `MAIN = 'main',`
- `MARKETPLACE = 'marketplace',`
- `GENERATOR = 'generator',`
- `BLAGOROST = 'blagorost',`

## PROJECT_CAPITAL_CLEARANCE_PORT

`const` · cross-plugin-ports

- `Symbol.for('Innercoop.CrossPlugin.ProjectCapitalClearance')`

## PROJECT_COMMUNICATION_ARTIFACTS_PORT

`const` · cross-plugin-ports

- `Symbol.for('Innercoop.CrossPlugin.ProjectCommunicationArtifacts')`

## REALTIME_CHANNEL_PORT

`const` · core-ports

- `Symbol.for('Innercoop.CorePort.RealtimeChannel')`

## REGISTRATION_DOCUMENT_PARAMETERS_REGISTRY_PORT

`const` · hooks

- `Symbol.for('Innercoop.CorePort.RegistrationDocumentParametersRegistry')`

## REGISTRATION_OFFER_FILTER_REGISTRY_PORT

`const` · hooks

- `Symbol.for('Innercoop.CorePort.RegistrationOfferFilterRegistry')`

## REGISTRATION_REGISTRY_PORT

`const` · core-ports

- `Symbol.for('Innercoop.CorePort.RegistrationRegistry')`

## SECRET_CIPHER_PORT

`const` · core-ports

- `Symbol.for('Innercoop.CorePort.SecretCipher')`

## TrackingRule

`interface` · core-ports

- `id: string`
- `hash: string`
- `event_type: DecisionEventType`
- `vars_field: string`
- `metadata: Record<string, any>`
- `active: boolean`
- `created_at: Date`

## USER_CERTIFICATE_PORT

`const` · core-ports

- `Symbol.for('Innercoop.CorePort.UserCertificate')`

## USER_DATA_PORT

`const` · core-ports

- `Symbol.for('Innercoop.CorePort.UserData')`

## USER_DIRECTORY_PORT

`const` · core-ports

- `Symbol.for('Innercoop.CorePort.UserDirectory')`

## USER_WALLET_PORT

`const` · core-ports

- `Symbol.for('Innercoop.CorePort.UserWallet')`

## VAT_EXEMPT_NOTE

`const` · core-ports

- `Symbol.for('Innercoop.CorePort.Payment')`

## VAULT_PORT

`const` · core-ports

- `Symbol.for('Innercoop.CorePort.Vault')`

## VERIFICATION_PORT

`const` · core-ports

- `Symbol.for('Innercoop.CorePort.Verification')`
