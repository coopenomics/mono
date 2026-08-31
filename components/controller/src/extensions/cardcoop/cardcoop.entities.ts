/**
 * Сущности расширения «Карта пайщика»: явная декларация состава таблиц.
 *
 * Состав объявляется здесь, а не находится глобом по каталогу: то же расширение,
 * установленное пакетом в `node_modules`, под файловый глоб не попадёт — таблицы
 * не создадутся, репозитории не поднимутся, расширение не стартует.
 */
import { CardcoopAttestationTypeormEntity } from './infrastructure/entities/cardcoop-attestation.typeorm-entity';
import { CardcoopPendingExitTypeormEntity } from './infrastructure/entities/cardcoop-pending-exit.typeorm-entity';
import { CardcoopPendingLinkTypeormEntity } from './infrastructure/entities/cardcoop-pending-link.typeorm-entity';

export const cardcoopEntities = [
  CardcoopAttestationTypeormEntity,
  CardcoopPendingExitTypeormEntity,
  CardcoopPendingLinkTypeormEntity,
];
