/** Детализировать существующий в core кооперативный участок как ПВЗ Стола заказов */
export * as DetailKU from './detailKU'
/** Активировать или деактивировать ПВЗ Стола заказов */
export * as SetKUStatus from './setKUStatus'
/** Повторно запустить геокодинг адреса ПВЗ */
export * as RetryKUGeocode from './retryKUGeocode'
/** Оформить заказ по предложению и заблокировать средства */
export * as CreateOrder from './createOrder'
/** Отменить свой заказ до приёма поставщиком */
export * as CancelOrder from './cancelOrder'
/** Опубликовать новое предложение поставщика на модерацию */
export * as CreateOffer from './createOffer'
/** Эпик 5: сформировать партии поставки из акцептованной заявки */
export * as CreateShipment from './createShipment'
/** Эпик 5: наклеить штрих-коды на единицы заказа (оператор КУ) */
export * as LabelInventory from './labelInventory'
/** Эпик 5: создать акт приёмки партии (оператор КУ) */
export * as CreateAplReception from './createAplReception'
/** Эпик 5: первая подпись поставщика на акте приёмки */
export * as SignAplReceptionAsSupplier from './signAplReceptionAsSupplier'
/** Эпик 5: закрывающая подпись председателя КУ */
export * as SignAplReceptionAsChairman from './signAplReceptionAsChairman'
/** Эпик 6: председатель КУ открывает выдачу первой подписью акта */
export * as OpenIssuance from './openIssuance'
/** Эпик 6: заказчик закрывает выдачу финальной подписью с указанием фактического количества */
export * as FinalizeIssuance from './finalizeIssuance'
/** Эпик 7: заказчик подаёт заявление на гарантийный возврат имущества */
export * as CreateReturnClaim from './createReturnClaim'
/** Эпик 7: председатель КУ удалённо приглашает заказчика на очный осмотр */
export * as ApproveReturnVisit from './approveReturnVisit'
/** Эпик 7: председатель КУ удалённо отказывает в гарантийном возврате */
export * as RejectReturnRemote from './rejectReturnRemote'
/** Эпик 7: председатель КУ принимает гарантийный возврат на очном осмотре (compensating forward) */
export * as AcceptReturnAtVisit from './acceptReturnAtVisit'
/** Эпик 7: председатель КУ отказывает в гарантийном возврате на очном осмотре */
export * as RejectReturnAtVisit from './rejectReturnAtVisit'
