/**
 * Сущности расширения «Отчёты»: явная декларация состава таблиц.
 *
 * Раньше TypeORM находил их файловым глобом по `src/extensions/**`. Глоб
 * привязывает расширение к его месту на диске: тот же код, установленный
 * пакетом в `node_modules`, под него не попадает — таблицы не создаются,
 * репозитории не поднимаются, расширение не стартует. Поэтому состав
 * объявляется здесь и попадает в подключение через запись реестра.
 */
import { BalanceCorrectionEntity } from './infrastructure/entities/balance-correction.entity';
import { GeneratedReportEntity } from './infrastructure/entities/generated-report.entity';
import { ReportDraftEntity } from './infrastructure/entities/report-draft.entity';
import { ReportRequisitesEntity } from './infrastructure/entities/report-requisites.entity';
import { ReportSubmissionMarkEntity } from './infrastructure/entities/report-submission-mark.entity';

export const reportsEntities = [
  BalanceCorrectionEntity,
  GeneratedReportEntity,
  ReportDraftEntity,
  ReportRequisitesEntity,
  ReportSubmissionMarkEntity,
];
