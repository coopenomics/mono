/** Подтвердить поставку имущества на заявку */
export * as AcceptChildOrder from './acceptChildOrder'
/** Отменить заявку */
export * as CancelRequest from './cancelRequest'
export * as CompleteReceiveOnRequest from './completeReceiveOnRequest'
/** Завершить заявку по истечению гарантийного срока */
export * as CompleteRequest from './completeRequest'
/** Подтвердить поставку имущества Поставщиком по заявке Заказчика и акту приёма-передачи */
export * as ConfirmSupplyOnRequest from './confirmSupplyOnRequest'
/** Создать заявку на поставку имущества по предложению Поставщика */
export * as CreateChildOrder from './createChildOrder'
/** Создать предложение на поставку имущества */
export * as CreateParentOffer from './createParentOffer'
/** Отклонить заявку */
export * as DeclineRequest from './declineRequest'
/** Подтвердить доставку имущества Заказчику по заявке */
export * as DeliverOnRequest from './deliverOnRequest'
/** Открыть спор по заявке */
export * as DisputeOnRequest from './disputeOnRequest'
/** Сгенерировать документ акта приема-передачи. */
export * as GenerateAssetContributionAct from './generateAssetContributionAct'
/** Сгенерировать документ решения о вступлении в кооператив. */
export * as GenerateAssetContributionDecision from './generateAssetContributionDecision'
/** Сгенерировать документ заявления о вступлении в кооператив. */
export * as GenerateAssetContributionStatement from './generateAssetContributionStatement'
/** Сгенерировать документ акта возврата имущества. */
export * as GenerateReturnByAssetAct from './generateReturnByAssetAct'
/** Сгенерировать документ решения о возврате имущества. */
export * as GenerateReturnByAssetDecision from './generateReturnByAssetDecision'
/** Сгенерировать документ заявления о возврате имущества. */
export * as GenerateReturnByAssetStatement from './generateReturnByAssetStatement'
/** Модерировать заявку */
export * as ModerateRequest from './moderateRequest'
/** Отклонить модерацию по заявке */
export * as ProhibitRequest from './prohibitRequest'
/** Опубликовать заявку */
export * as PublishRequest from './publishRequest'
/** Подтвердить получение имущества Уполномоченным лицом от Заказчика по акту приёмки-передачи */
export * as ReceiveOnRequest from './receiveOnRequest'
/** Подтвердить поставку имущества Поставщиком по заявке Заказчика и акту приёма-передачи */
export * as SupplyOnRequest from './supplyOnRequest'
/** Снять с публикации заявку */
export * as UnpublishRequest from './unpublishRequest'
/** Обновить заявку */
export * as UpdateRequest from './updateRequest'
