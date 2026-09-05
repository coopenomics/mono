/**
 * Сущности расширения «Робот совета»: явная декларация состава таблиц —
 * файловый глоб по `src/extensions/**` не находит расширение, установленное
 * пакетом, поэтому состав объявляется здесь и уходит в реестр.
 */
import { RobotDecisionTypeormEntity } from './infrastructure/entities/robot-decision-typeorm.entity';
import { RobotKeyTypeormEntity } from './infrastructure/entities/robot-key-typeorm.entity';

export const sovietRobotEntities = [
  RobotDecisionTypeormEntity,
  RobotKeyTypeormEntity,
];
