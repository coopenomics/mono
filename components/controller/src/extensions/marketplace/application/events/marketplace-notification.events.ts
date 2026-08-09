/**
 * Per-contract event-bus каналы marketplace для push-уведомлений (Эпик 5).
 * Эмитятся ПОСЛЕ commit'а в PG (INV-12) — listener доставляет уведомление
 * через Novu провайдер без обратного влияния на основной flow.
 */
export const MARKETPLACE_APL_SUPPLIER_SIGN_REQUEST_EVENT =
  'marketplace.aplReception.b.supplier.signRequested';

/**
 * Очная приёмка (Вариант А): поставщик ЛИЧНО стоит у стойки оператора, и
 * других документов о передаче имущества (бумажной ТТН, как у экспедитора)
 * нет — подпись нужна немедленно, пока поставщик здесь. Это сигнал realtime-
 * каналу, чтобы у поставщика моментально всплыл перекрывающий гейт «Подпишите
 * документ». Вариант Б (экспедитор) сюда НЕ относится: там есть бумажная ТТН,
 * передача подтверждена, экран не перекрываем.
 */
export const MARKETPLACE_APL_SUPPLIER_ONSITE_SIGN_REQUEST_EVENT =
  'marketplace.aplReception.a.supplier.onsiteSignRequested';

/**
 * Поставщик у стойки отменил черновик приёмки (не согласен с фактом / отказывается
 * подписывать) — акт CANCELLED, партия снова SUPPLY_PREPARED. Оповещение только
 * оператору, который сформировал акт (`created_by_operator_account`): он на
 * месте и должен повторить приёмку либо оформить отказ в приёмке по партии.
 */
export const MARKETPLACE_APL_RECEPTION_CANCELLED_BY_SUPPLIER_EVENT =
  'marketplace.aplReception.operator.cancelledBySupplier';

export interface MarketplaceAplReceptionCancelledBySupplierEvent {
  coopname: string;
  apl_reception_id: string;
  braname: string;
  /** Поставщик, отменивший приёмку — для текста уведомления. */
  supplier_account: string;
  /** Оператор, сформировавший акт — единственный адресат уведомления. */
  operator_account: string;
}

export const MARKETPLACE_CASHIER_NEW_PAYMENT_EVENT =
  'marketplace.outgoingPayment.cashier.newTask';

export const MARKETPLACE_SUPPLIER_PAYMENT_CONFIRMED_EVENT =
  'marketplace.outgoingPayment.supplier.confirmed';

export const MARKETPLACE_SUPPLIER_PAYMENT_DECLINED_EVENT =
  'marketplace.outgoingPayment.supplier.declined';

/**
 * Story 6.4 / FR22: пайщику-заказчику отправляется multi-channel
 * уведомление, что его заказ готов на ПВЗ к получению. Эмитится после
 * успешной первой подписи АПП-выдачи председателем КУ (`signiss1`).
 */
export const MARKETPLACE_ORDER_READY_TO_RECEIVE_EVENT =
  'marketplace.order.orderer.readyToReceive';

/**
 * Карта уведомлений (пробел A): поставщику ушло уведомление, что по его
 * предложению поступил новый заказ — повод заглянуть на стол и акцептовать.
 * Эмитится ПОСЛЕ записи Order'а в PG (INV-12). Каналы — только in-app + push
 * (без email): новые заказы частые, письмо на каждый было бы спамом.
 */
export const MARKETPLACE_NEW_ORDER_FOR_SUPPLIER_EVENT =
  'marketplace.order.supplier.newOrder';

export interface MarketplaceNewOrderForSupplierEvent {
  coopname: string;
  order_id: string;
  order_hash: string;
  /** Поставщик — адресат уведомления. */
  supplier_account: string;
  /** Заказчик — для человекочитаемого текста уведомления. */
  orderer_account: string;
  /** Кол-во заказанных единиц. */
  quantity: number;
  /** Полная сумма заказа (для подписи уведомления). */
  total_cost: string;
}

/**
 * Поставщик отклонил активный заказ до приёма к поставке (`declineorder`).
 * Заказчику уходит multi-channel уведомление с причиной отказа — заблокированные
 * средства возвращаются ему. Эмитится по одному событию на каждый отклонённый
 * заказ (у каждого свой заказчик) ПОСЛЕ записи статуса в PG (INV-12).
 */
export const MARKETPLACE_ORDER_DECLINED_BY_SUPPLIER_EVENT =
  'marketplace.order.orderer.declinedBySupplier';

export interface MarketplaceOrderDeclinedBySupplierEvent {
  coopname: string;
  order_id: string;
  /** Заказчик — адресат уведомления. */
  orderer_account: string;
  /** КУ доставки — для человекочитаемого текста (резолвится в имя участка). */
  delivery_braname: string;
  /** Название товара из предложения. */
  product_name: string;
  /** Причина отказа, указанная поставщиком. */
  reason: string;
}

/**
 * Остаток предложения изменился (заказ заблокировал/освободил/списал единицы).
 * Сигнал широковещательному каналу каталога, чтобы у всех пайщиков карточка
 * обновила доступное количество без перехода по страницам.
 */
export const MARKETPLACE_OFFER_COUNTERS_CHANGED_EVENT = 'marketplace.offer.counters.changed';

/**
 * Предложение прошло модерацию и стало активным — попадает в каталог. Сигнал
 * широковещательному каналу каталога, чтобы витрина показала новое предложение.
 */
export const MARKETPLACE_OFFER_APPROVED_EVENT = 'marketplace.offer.approved';

/**
 * Статус заказа сменился (принял поставщик, подготовил партию, принял КУ,
 * выдан, отменён, возвращён). Адресный сигнал персональным каналам обеих
 * сторон заказа — заказчику и поставщику, — чтобы их столы заказов мгновенно
 * перечитали состояние без поллинга. Эмитится из единой точки синхронизации с
 * цепью (chain-as-source-of-truth) ПОСЛЕ commit'а в PG (INV-12).
 */
export const MARKETPLACE_ORDER_STATUS_CHANGED_EVENT = 'marketplace.order.status.changed';

/**
 * Статус акта приёмки (АПП) сменился: акт создан и ждёт подписи поставщика,
 * поставщик подписал, председатель закрыл, акт отменён. Подпись поставщика
 * НЕ двигает статусы заказов — поэтому отдельное событие: оператор у стойки
 * ждёт именно эту подпись и не может отпустить поставщика без неё. Адресаты:
 * служебный канал персонала КУ + персональный канал поставщика.
 */
export const MARKETPLACE_APL_RECEPTION_STATUS_CHANGED_EVENT =
  'marketplace.aplReception.status.changed';

export interface MarketplaceAplSupplierSignRequestEvent {
  coopname: string;
  apl_reception_id: string;
  supplier_account: string;
  ku_name: string;
  ttn_number: string;
  expeditor_name: string;
}

export interface MarketplaceAplSupplierOnsiteSignRequestEvent {
  coopname: string;
  apl_reception_id: string;
  supplier_account: string;
  ku_name: string;
}

export interface MarketplaceCashierNewPaymentEvent {
  coopname: string;
  apl_reception_id: string;
  payment_request_id: string;
  supplier_account: string;
  amount: string;
}

export interface MarketplaceSupplierPaymentConfirmedEvent {
  coopname: string;
  apl_reception_id: string;
  payment_request_id: string;
  supplier_account: string;
  amount: string;
  payment_reference: string;
}

export interface MarketplaceSupplierPaymentDeclinedEvent {
  coopname: string;
  apl_reception_id: string;
  payment_request_id: string;
  supplier_account: string;
  amount: string;
  reason: string;
}

export interface MarketplaceOrderReadyToReceiveEvent {
  coopname: string;
  order_id: string;
  order_hash: string;
  orderer_account: string;
  /** Кооперативный участок, где имущество готово к выдаче. */
  braname: string;
}

/**
 * requirement 76 (двухфазная докладка): оператор у стойки накидал пайщику
 * предложение из опубликованного остатка склада КУ. Пайщику немедленно
 * уходит персональный websocket-сигнал — у него всплывает экран принятия
 * предложения. Неакцептованное предложение ничего не резервирует.
 */
export const MARKETPLACE_STOCK_PROPOSAL_CREATED_EVENT =
  'marketplace.stockProposal.member.created';

/**
 * requirement 76: предложение докладки разрешилось — пайщик принял (созданы
 * заказы из остатка, у стойки можно открывать выдачу), отказался либо
 * оператор отозвал его для переформирования. Сигнал персоналу КУ (стойка
 * видит live-статус) и пайщику (его экран предложения закрывается/обновляется).
 */
export const MARKETPLACE_STOCK_PROPOSAL_RESOLVED_EVENT =
  'marketplace.stockProposal.resolved';

export interface MarketplaceStockProposalCreatedEvent {
  coopname: string;
  proposal_id: string;
  member_account: string;
  braname: string;
}

export interface MarketplaceStockProposalResolvedEvent {
  coopname: string;
  proposal_id: string;
  member_account: string;
  braname: string;
  /** ACCEPTED / DECLINED / CANCELLED — клиент дочитывает состояние query по сигналу. */
  resolution: string;
}

export interface MarketplaceOfferCountersChangedEvent {
  offer_id: string;
  supplier_account: string;
  op: 'block' | 'unblock' | 'consume' | 'rollback';
  qty: number;
  quantity_available: number;
  quantity_blocked: number;
  quantity_consumed: number;
  unlimited_flag: boolean;
}

export interface MarketplaceOfferApprovedEvent {
  offer_id: string;
  supplier_account: string;
  approved_by: string;
  /** Категория предложения — каталог решает, нужно ли обновлять текущую вкладку. */
  category_id: number;
}

/**
 * Предложение поступило на модерацию (создано, значимо изменено или
 * возвращено на публикацию без прошлого одобрения). Сигнал служебному каналу
 * модерации, чтобы стол председателя показал новую заявку без поллинга.
 */
export const MARKETPLACE_OFFER_MODERATION_REQUESTED_EVENT =
  'marketplace.offer.moderationRequested';

export interface MarketplaceOfferModerationRequestedEvent {
  offer_id: string;
  supplier_account: string;
}

/**
 * Предложение отклонено модератором. Имя события исторически закреплено в
 * `MarketplaceModerationService.EVENT_REJECTED` — константа вынесена сюда,
 * чтобы realtime-мост подписался: поставщик и стол модерации видят отказ
 * сразу, без поллинга.
 */
export const MARKETPLACE_OFFER_REJECTED_EVENT = 'marketplace.offer.rejected';

export interface MarketplaceOfferRejectedEvent {
  offer_id: string;
  supplier_account: string;
  rejected_by: string;
  reason: string;
}

export interface MarketplaceOrderStatusChangedEvent {
  coopname: string;
  order_id: string;
  /** Новый статус заказа (значение из `MarketplaceOrderStatuses`). */
  status: string;
  /** Предыдущий статус — клиенту хватает для решения, нужно ли реагировать. */
  previous_status: string;
  /** Аккаунт заказчика — адресат персонального сигнала. */
  orderer_account: string;
  /** Аккаунт поставщика — второй адресат персонального сигнала. */
  supplier_account: string;
}

export interface MarketplaceAplReceptionStatusChangedEvent {
  coopname: string;
  apl_reception_id: string;
  /** Новый статус акта (значение из `MarketplaceAplReceptionStatuses`). */
  status: string;
  /** КУ приёмки — стол оператора фильтрует чужие участки. */
  braname: string;
  /** Аккаунт поставщика — адресат персонального сигнала. */
  supplier_account: string;
}

/**
 * Story 7.1 (Эпик 7): пайщик подал заявление на гарантийный возврат —
 * председатель КУ доставки заказа получает multi-channel уведомление на
 * рассмотрение.
 */
export const MARKETPLACE_RETURN_CLAIM_SUBMITTED_EVENT =
  'marketplace.returnClaim.chairman.submitted';

/**
 * Story 7.2 / 7.3 (Эпик 7): председатель принял промежуточное решение
 * (одобрить очный визит / отказать удалённо / принять / отказать на
 * месте) — заказчик получает уведомление о текущем состоянии заявления.
 */
export const MARKETPLACE_RETURN_CLAIM_DECIDED_EVENT =
  'marketplace.returnClaim.orderer.decided';

/**
 * Story 7.4 (Эпик 7): заявление достигло финального статуса
 * (ACCEPTED_AT_VISIT / REJECTED_REMOTELY / REJECTED_AT_VISIT) — отдельное
 * событие для финализации orderer-стола и обновления карточки Order'а.
 */
export const MARKETPLACE_RETURN_CLAIM_FINALIZED_EVENT =
  'marketplace.returnClaim.orderer.finalized';

export interface MarketplaceReturnClaimSubmittedEvent {
  coopname: string;
  claim_id: string;
  order_id: string;
  orderer_account: string;
  delivery_braname: string;
  reason_text: string;
}

/**
 * Карта уведомлений (пробел B): гарантийный возврат принят в кооператив на
 * очном осмотре (`accretrn`) — имущество принято на счёт 10, претензия
 * зафиксирована. Поставщику уходит multi-channel уведомление: дальше
 * председатель КУ свяжется с ним по претензии за пределами системы. Эмитится
 * ПОСЛЕ commit'а решения в PG (INV-12).
 */
export const MARKETPLACE_RETURN_ACCEPTED_FOR_SUPPLIER_EVENT =
  'marketplace.returnClaim.supplier.acceptedToCoop';

export interface MarketplaceReturnAcceptedForSupplierEvent {
  coopname: string;
  claim_id: string;
  order_id: string;
  /** Поставщик — адресат уведомления. */
  supplier_account: string;
  /** КУ доставки, где имущество принято обратно. */
  braname: string;
  /** Результат очного осмотра (краткая причина претензии). */
  inspection_result: string;
}

export interface MarketplaceReturnClaimDecidedEvent {
  coopname: string;
  claim_id: string;
  orderer_account: string;
  stage: 'remote' | 'on_site';
  decision: 'approve_visit' | 'reject_remote' | 'accept_at_visit' | 'reject_at_visit';
  comment: string;
  braname: string;
}

export interface MarketplaceReturnClaimFinalizedEvent {
  coopname: string;
  claim_id: string;
  orderer_account: string;
  /** Финальный статус заявления (значение из `MarketplaceReturnClaimStatuses`). */
  final_status: string;
  /** Действие, приведшее к финальному состоянию (approve_visit здесь не появляется). */
  decision: 'approve_visit' | 'reject_remote' | 'accept_at_visit' | 'reject_at_visit';
  comment: string;
  ledger_snapshot: {
    amount: string;
    returned_quantity: number;
    tx_hash: string;
  } | null;
}

// ── Эпик 8: списание скоропорта ─────────────────────────────────────

/**
 * Cron / админ сформировал DRAFT-проект списания — председатель приглашён
 * проверить корзину и подписать Заявление о списании (1106).
 */
export const MARKETPLACE_WRITEOFF_DRAFT_BUILT_EVENT = 'marketplace.writeoff.chairman.draftBuilt';

/**
 * Председатель подписал Заявление и отправил проект в совет —
 * `propwroff` + `soviet::createagenda(mktwroff)` отработали. Совет
 * получает приглашение проголосовать.
 */
export const MARKETPLACE_WRITEOFF_PROPOSED_EVENT = 'marketplace.writeoff.council.proposed';

/**
 * Совет авторизовал Протокол списания (1105) — председатель и общий
 * админ узнают, что backend запускает списание per-item.
 */
export const MARKETPLACE_WRITEOFF_AUTHORIZED_EVENT = 'marketplace.writeoff.admin.authorized';

/**
 * Все позиции проекта успешно списаны через atomic execwroff per-item —
 * проект финализирован.
 */
export const MARKETPLACE_WRITEOFF_EXECUTED_EVENT = 'marketplace.writeoff.admin.executed';

/**
 * Совет отказал в проекте списания (или срок повестки истёк) — общий
 * админ получает причину отказа.
 */
export const MARKETPLACE_WRITEOFF_REJECTED_EVENT = 'marketplace.writeoff.admin.rejected';

export interface MarketplaceWriteoffDraftBuiltPayload {
  coopname: string;
  proposal_id: string;
  trigger: 'cron' | 'manual';
  items_count: number;
  total_amount: string;
}

export interface MarketplaceWriteoffProposedPayload {
  coopname: string;
  proposal_id: string;
  proposal_hash: string;
  items_count: number;
  total_amount: string;
}

export interface MarketplaceWriteoffAuthorizedPayload {
  coopname: string;
  proposal_id: string;
  proposal_hash: string;
  items_count: number;
  total_amount: string;
}

export interface MarketplaceWriteoffExecutedPayload {
  coopname: string;
  proposal_id: string;
  proposal_hash: string;
  items_count: number;
  total_amount: string;
}

export interface MarketplaceWriteoffRejectedPayload {
  coopname: string;
  proposal_id: string;
  proposal_hash: string;
  reason: string;
}

/**
 * Пайщик подал заявку на допуск поставщика (членская модель). Председатель
 * получает multi-channel уведомление — заявку нужно рассмотреть и одобрить либо
 * отклонить в реестре поставщиков. Эмитится ПОСЛЕ записи заявки в PG (INV-12);
 * адресат (председатель) и человекочитаемые имена резолвятся в listener'е.
 */
export const MARKETPLACE_NEW_SUPPLIER_REQUEST_EVENT =
  'marketplace.supplier.chairman.requestSubmitted';

export interface MarketplaceNewSupplierRequestEvent {
  coopname: string;
  /** Пайщик-заявитель — для человекочитаемого текста уведомления. */
  member_account: string;
  /** Номер договора из заявки. */
  contract_number: string;
}

/**
 * Председатель одобрил заявку поставщика на допуск (членская модель).
 * Поставщик получает multi-channel уведомление — заявка рассмотрена, открыт
 * доступ в личный кабинет Стола поставщика. Эмитится ПОСЛЕ записи решения в
 * PG (INV-12); адресат (заявитель) и человекочитаемое имя резолвятся в
 * listener'е.
 */
export const MARKETPLACE_SUPPLIER_APPROVED_EVENT =
  'marketplace.supplier.member.approved';

export interface MarketplaceSupplierApprovedEvent {
  coopname: string;
  /** Пайщик, чью заявку одобрили — адресат уведомления. */
  member_account: string;
  /** Номер договора из заявки. */
  contract_number: string;
}

/**
 * requirement b6: кассир подтвердил выплату материальной помощи
 * (`branch::aidconfirm`). Парного отказа нет — одобренную советом выплату
 * отменить нельзя. Эмитится из `MarketplaceAidPayoutSyncService` ПОСЛЕ
 * `setPaymentStatus` в core (INV-12).
 */
export const MARKETPLACE_AID_PAYOUT_CONFIRMED_EVENT =
  'marketplace.aidPayout.member.confirmed';


export interface MarketplaceAidPayoutConfirmedEvent {
  coopname: string;
  /** Получатель материальной помощи — адресат уведомления. */
  member_account: string;
  amount: string;
  /** Маскированные реквизиты получения («Сбербанк •1234»), если доступны. */
  payment_destination: string | null;
}

/**
 * requirement b6: совет принял решение по заявлению на материальную помощь.
 * Одобрение переводит заявку кассиру, отказ закрывает её. Эмитится из
 * `MarketplaceAidCouncilSyncService` ПОСЛЕ смены статуса платежа (INV-12).
 */
export const MARKETPLACE_AID_COUNCIL_DECIDED_EVENT =
  'marketplace.aidPayout.member.councilDecided';

export interface MarketplaceAidCouncilDecidedEvent {
  coopname: string;
  /** Получатель материальной помощи — адресат уведомления. */
  member_account: string;
  amount: string;
  /** true — совет одобрил выплату; false — отказал либо повестка просрочена. */
  approved: boolean;
  reason?: string;
}
