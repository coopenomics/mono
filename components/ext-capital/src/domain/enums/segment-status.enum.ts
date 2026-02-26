import { registerEnumType } from '@nestjs/graphql';

/**
 * Перечисление статусов сегментов участника в проекте
 * Синхронизировано с константами из segments.hpp блокчейн контракта
 */
export enum SegmentStatus {
  GENERATION = 'generation', // Сегмент находится в стадии генерации
  READY = 'ready', // Проект завершен, ожидает внесения результата
  STATEMENT = 'statement', // Заявление о результате подано
  APPROVED = 'approved', // Результат одобрен председателем
  AUTHORIZED = 'authorized', // Результат авторизован советом
  ACT1 = 'act1', // Первый акт подписан участником
  CONTRIBUTED = 'contributed', // Результат внесён и принят (второй акт подписан)
  FINALIZED = 'finalized', // Сегмент конвертирован и удалён из блокчейна
  SKIPPED = 'skipped', // Внесение сегмента пропущено за отсутствием интеллектуальной части
  UNDEFINED = 'undefined', // Неопределенный статус
}

registerEnumType(SegmentStatus, {
  name: 'SegmentStatus',
  description: 'Статус сегмента участника в проекте CAPITAL',
});
