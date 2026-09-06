/** Детализировать существующий в core кооперативный участок как ПВЗ Стола заказов */
export * as DetailKU from './detailKU'
/** Активировать или деактивировать ПВЗ Стола заказов */
export * as SetKUStatus from './setKUStatus'
/** Повторно запустить геокодинг адреса ПВЗ */
export * as RetryKUGeocode from './retryKUGeocode'
/** Оформить заказ по предложению и заблокировать средства */
/** Отменить свой заказ до приёма поставщиком */
export * as CancelOrder from './cancelOrder'

/** Компонент 68: оператор отмечает заказ готовым к выдаче (имущество на участке) */
export * as ReadyIssue from './readyIssue'
/** Компонент 68: оператор фиксирует факт выдачи — рождается сага и заявление к подписи */
export * as FixIssuanceFact from './fixIssuanceFact'
/** Компонент 68: заказчик подписывает заявление о возврате паевого взноса имуществом (на повестку совета) */
export * as SignIssuanceStatement from './signIssuanceStatement'
/** Компонент 68: заказчик подписывает акт приёма-передачи после решения совета */
export * as SignIssuanceAct from './signIssuanceAct'
/** Компонент 68: оператор закрывает выдачу второй подписью акта — имущество выдано */
export * as CloseIssuance from './closeIssuance'
/** Компонент 68: оператор снимает выдачу до решения совета / до акта */
export * as CancelIssuance from './cancelIssuance'
/** Эпик 15: поставщик принимает к поставке выбранные заказы (offer × КУ) единым массивом */
export * as AcceptOrdersBatch from './acceptOrdersBatch'
/** Эпик 15: поставщик отклоняет выбранные активные заказы — средства разблокируются */
export * as DeclineOrdersBatch from './declineOrdersBatch'
/** Опубликовать новое предложение поставщика на модерацию */
export * as CreateOffer from './createOffer'
/** Эпик 5: сформировать партии поставки из акцептованной заявки */
export * as CreateShipment from './createShipment'
/** Склад КУ: назначить позиции полку (оператор КУ) */
export * as AssignInventoryPlacement from './assignInventoryPlacement'
export * as CreateStorageCell from './createStorageCell'
export * as CreateStorageGrid from './createStorageGrid'
export * as RenameStorageSection from './renameStorageSection'
export * as RetireStorageCells from './retireStorageCells'
export * as UpdateStorageCell from './updateStorageCell'
export * as CreateContainerType from './createContainerType'
export * as CreateContainers from './createContainers'
export * as MoveContainer from './moveContainer'
export * as UpdateContainer from './updateContainer'
/** Склад КУ: разложить принятую позицию по нескольким полкам (оператор КУ) */
export * as SplitInventory from './splitInventory'
/** Склад КУ: наклеить штрих-код на позицию для быстрого поиска (оператор КУ) */
export * as GenerateInventoryLabel from './generateInventoryLabel'
/** Склад КУ: привязать к позиции отсканированный штрих-код с печатной этикетки (оператор КУ) */
export * as BindInventoryBarcode from './bindInventoryBarcode'
/** Склад КУ: снять штрих-код с позиции для переклейки (оператор КУ) */
export * as ClearInventoryLabel from './clearInventoryLabel'
/** Эпик 5: создать акт приёмки партии (оператор КУ) */
export * as CreateAplReception from './createAplReception'
/** Эпик 14 (14.2): express-приёмка самовывоза по факту присутствия поставщика */
export * as CreateExpressReception from './createExpressReception'
/** Эпик 5: отмена акта приёмки оператором до подписи поставщика (пересборка) */
export * as CancelAplReception from './cancelAplReception'
/** Эпик 5: первая подпись поставщика на акте приёмки */
export * as SignAplReceptionAsSupplier from './signAplReceptionAsSupplier'
/** Эпик 5: закрывающая подпись председателя КУ */
export * as SignAplReceptionAsChairman from './signAplReceptionAsChairman'
/** Эпик 7: заказчик подаёт заявление на гарантийный возврат имущества */
export * as CreateReturnClaim from './createReturnClaim'
/** Эпик 7: председатель КУ удалённо приглашает заказчика на очный осмотр */
export * as ApproveReturnVisit from './approveReturnVisit'
/** Эпик 7: председатель КУ удалённо отказывает в гарантийном возврате */
export * as RejectReturnRemote from './rejectReturnRemote'
/** Эпик 7 + компонент 68: оператор принял имущество у стойки — заявление уходит на повестку совета */
export * as AcceptReturnAtVisit from './acceptReturnAtVisit'
/** Эпик 7: оператор не принимает имущество по результатам осмотра */
export * as RejectReturnAtVisit from './rejectReturnAtVisit'
/** Компонент 68: оператор выдал имущество обратно после отказа совета или по истечении срока ожидания */
export * as HandBackReturn from './handBackReturn'
/** Эпик 8: общий администратор создаёт черновик проекта списания скоропорта */
export * as CreateWriteoffDraft from './createWriteoffDraft'
/** Эпик 8: общий администратор изменяет состав черновика проекта списания */
export * as UpdateWriteoffDraft from './updateWriteoffDraft'
/** Эпик 8: удаление черновика проекта списания до отправки в совет */
export * as CancelWriteoffDraft from './cancelWriteoffDraft'
/** Эпик 8: председатель отправляет черновик с подписанным Заявлением 1106 в совет */
export * as SubmitWriteoffDraft from './submitWriteoffDraft'
/** Эпик 8: председатель КУ подтверждает списание подписанной Служебной запиской 1111 */
export * as ConfirmWriteoff from './confirmWriteoff'
/** Эпик 1 / Story 1.9: принятие ЦПП Marketplace кооперативом (L1 onboarding, chairman-only) */
export * as MarketplaceAcceptCpp from './marketplaceAcceptCpp'
/** Эпик 1 фоллоуап: L3-подпись оферты ЦПП «Стол заказов» пайщиком прямо со стола */
export * as MarketplaceSignOnboardingOffer from './marketplaceSignOnboardingOffer'
/** Добавить категории в whitelist кооператива (chairman-only) */
export * as AddAvailableCategories from './addAvailableCategories'
/** Удалить категории из whitelist кооператива (chairman-only) */
export * as RemoveAvailableCategories from './removeAvailableCategories'
/** Эпик 16: заменить весь список доступных категорий кооператива (chairman-only) */
export * as ReplaceAvailableItems from './replaceAvailableItems'
/** Эпик 16: очистить whitelist — открыть весь каталог категорий (chairman-only) */
export * as ClearAvailableCategories from './clearAvailableCategories'
/** Эпик 16: добавить собственную категорию кооператива (chairman-only) */
export * as CreateCustomCategory from './createCustomCategory'
/** Эпик 16: удалить собственную категорию кооператива (chairman-only) */
export * as DeleteCustomCategory from './deleteCustomCategory'
/** Эпик 3 / Story 3.6: председатель одобряет offer (PENDING_MODERATION → APPROVED) */
export * as ApproveOffer from './approveOffer'
/** Эпик 3 / Story 3.6: председатель отклоняет offer (PENDING_MODERATION → REJECTED) */
export * as RejectOffer from './rejectOffer'
/** Модератор меняет гарантийный срок возврата уже одобренного offer'а */
export * as SetOfferWarranty from './setOfferWarranty'
/** Поставщик меняет содержимое своего offer'а до модерации */
export * as UpdateOffer from './updateOffer'
/** Поставщик отзывает свой offer (любой статус, кроме APPROVED/REJECTED) */
export * as WithdrawOffer from './withdrawOffer'
/** Поставщик возвращает снятый offer на публикацию (WITHDRAWN → PENDING_MODERATION) */
export * as RepublishOffer from './republishOffer'
/** Эпик 16: добавить товар в корзину (привязка корзины к пункту выдачи) */
export * as AddToCart from './addToCart'
/** Эпик 16: изменить количество позиции в корзине */
export * as UpdateCartItem from './updateCartItem'
/** Эпик 16: убрать позицию из корзины */
export * as RemoveFromCart from './removeFromCart'
/** Эпик 16: очистить корзину */
export * as ClearCart from './clearCart'
/** Эпик 16: сменить пункт выдачи (КУ) корзины */
export * as SetCartDeliveryPoint from './setCartDeliveryPoint'
/** Эпик 16: оформить заказ из корзины (per-line, общий checkout_id) */
export * as CheckoutCart from './checkoutCart'
/** Склад кооператива (requirement 76): публикация остатка в каталог оффером кооператива */
export * as PublishStock from './publishStock'
/** Склад кооператива: снятие свободного остатка с витрины */
export * as UnpublishStock from './unpublishStock'
/** Бандл выдачи у стойки: оператор собирает заказы к выдаче и докладку со склада, фиксируя факт */
export * as CreateStockProposal from './createStockProposal'
/** Докладка: оператор отзывает неотвеченное предложение */
export * as CancelStockProposal from './cancelStockProposal'
/** Бандл выдачи: пайщик одной подписью подписывает заявления по строкам — заказы из остатка и повестки совета */
export * as FinalizeStockIssuance from './finalizeStockIssuance'
/** Докладка: пайщик отказывается от предложения */
export * as DeclineStockProposal from './declineStockProposal'
/** Склад кооператива: отмена заказа со склада до открытия выдачи */
export * as CancelStockOrder from './cancelStockOrder'

// requirement b6 «Экономика КУ»
export * as SetMembershipFee from './setMembershipFee'
export * as DistributeBranchFunds from './distributeBranchFunds'
/** Поставщик выбирает реквизиты, на которые получает выплаты по актам приёмки */
export * as SetSupplierPayoutMethod from './setSupplierPayoutMethod'
export * as SetTrusteeWeight from './setTrusteeWeight'
export * as DeleteTrusteeWeight from './deleteTrusteeWeight'
/** Паевая модель: пайщик отзывает свободный паевой взнос со Стола заказов в Кошелёк */
export * as RecallShare from './recallShare'
export * as CreateAid from './createAid'
/** Подать расход кооперативного участка на решение совета через шасси расходов */
export * as CreateBranchExpense from './createBranchExpense'

// Реестр поставщиков
/** Заявка пайщика на допуск поставщика (членская модель, путь 1) */
export * as RequestSupplier from './requestSupplier'
/** Прямое добавление поставщика администратором (путь 2) */
export * as AddSupplier from './addSupplier'
/** Одобрение заявки поставщика (председатель) */
export * as ApproveSupplier from './approveSupplier'
/** Отклонение заявки поставщика (председатель) */
export * as RejectSupplier from './rejectSupplier'
/** Смена модели работы поставщика (переподписание договора) */
export * as SwitchSupplierModel from './switchSupplierModel'
