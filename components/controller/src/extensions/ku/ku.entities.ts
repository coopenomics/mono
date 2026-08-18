/**
 * Сущности расширения «Кооперативные участки»: явная декларация состава таблиц.
 *
 * Раньше TypeORM находил их файловым глобом по `src/extensions/**`. Глоб
 * привязывает расширение к его месту на диске: тот же код, установленный
 * пакетом в `node_modules`, под него не попадает — таблицы не создаются,
 * репозитории не поднимаются, расширение не стартует. Поэтому состав
 * объявляется здесь и попадает в подключение через запись реестра.
 */
import { KuDecisionQuestionTypeormEntity } from './infrastructure/entities/ku-decision-question.typeorm-entity';
import { KuDecisionTypeormEntity } from './infrastructure/entities/ku-decision.typeorm-entity';
import { KuTrustRequestTypeormEntity } from './infrastructure/entities/ku-trust-request.typeorm-entity';

export const kuEntities = [
  KuDecisionQuestionTypeormEntity,
  KuDecisionTypeormEntity,
  KuTrustRequestTypeormEntity,
];
