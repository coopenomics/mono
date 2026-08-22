// Отдельной страницы «Гарантийные возвраты» больше нет — подача заявления и
// его статус живут внутри страницы конкретного заказа (OrdererOrderDetail).
// Диалоги переиспользуются оттуда напрямую.
export { SubmitReturnClaimDialog, ReturnClaimDetailsDialog } from './ui';
export * from './api';
