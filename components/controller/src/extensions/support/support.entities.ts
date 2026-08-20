/**
 * Сущности расширения «Стол поддержки»: явная декларация состава таблиц.
 *
 * Раньше TypeORM находил их файловым глобом по `src/extensions/**`. Глоб
 * привязывает расширение к его месту на диске: тот же код, установленный
 * пакетом в `node_modules`, под него не попадает — таблицы не создаются,
 * репозитории не поднимаются, расширение не стартует. Поэтому состав
 * объявляется здесь и попадает в подключение через запись реестра.
 */
import { SupportTicketTypeormEntity } from './infrastructure/entities/support-ticket.typeorm-entity';
import { SupportTicketMessageTypeormEntity } from './infrastructure/entities/support-ticket-message.typeorm-entity';
import { SupportTicketAttachmentTypeormEntity } from './infrastructure/entities/support-ticket-attachment.typeorm-entity';

export const supportEntities = [
  SupportTicketTypeormEntity,
  SupportTicketMessageTypeormEntity,
  SupportTicketAttachmentTypeormEntity,
];
