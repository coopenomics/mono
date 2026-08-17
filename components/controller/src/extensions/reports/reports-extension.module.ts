import { Module } from '@nestjs/common';
import { TypeOrmModule as NestTypeOrmModule } from '@nestjs/typeorm';
import { ReportRegistryService } from './domain/services/report-registry.service';
import { ReportPreviewService } from './domain/services/report-preview.service';
import { ReportRequisitesService } from './domain/services/report-requisites.service';
import { ReportEditsBuilderService } from './domain/services/report-edits-builder.service';
import { Ndfl6DataService } from './domain/services/ndfl6-data.service';
import { ReportInitService } from './infrastructure/services/report-init.service';
import { XsdValidatorService } from './infrastructure/services/xsd-validator.service';
import { ReportResolver } from './application/resolvers/report.resolver';
import { ReportRequisitesResolver } from './application/resolvers/report-requisites.resolver';
import { ReportDraftResolver } from './application/resolvers/report-draft.resolver';
import { ReportCalendarResolver } from './application/resolvers/report-calendar.resolver';
import { WithheldTaxResolver } from './application/resolvers/withheld-tax.resolver';
import { WithheldTaxService } from './application/services/withheld-tax.service';
import { GeneratedReportEntity } from './infrastructure/entities/generated-report.entity';
import { BalanceCorrectionEntity } from './infrastructure/entities/balance-correction.entity';
import { ReportRequisitesEntity } from './infrastructure/entities/report-requisites.entity';
import { ReportDraftEntity } from './infrastructure/entities/report-draft.entity';
import { ReportSubmissionMarkEntity } from './infrastructure/entities/report-submission-mark.entity';
import { GeneratedReportTypeormRepository } from './infrastructure/repositories/generated-report.typeorm-repository';
import { BalanceCorrectionTypeormRepository } from './infrastructure/repositories/balance-correction.typeorm-repository';
import { ReportRequisitesTypeormRepository } from './infrastructure/repositories/report-requisites.typeorm-repository';
import { ReportDraftTypeormRepository } from './infrastructure/repositories/report-draft.typeorm-repository';
import { ReportSubmissionMarkTypeormRepository } from './infrastructure/repositories/report-submission-mark.typeorm-repository';
import { GENERATED_REPORT_REPOSITORY } from './domain/repositories/generated-report.repository';
import { BALANCE_CORRECTION_REPOSITORY } from './domain/repositories/balance-correction.repository';
import { REPORT_REQUISITES_REPOSITORY } from './domain/repositories/report-requisites.repository';
import { REPORT_DRAFT_REPOSITORY } from './domain/repositories/report-draft.repository';
import { REPORT_SUBMISSION_MARK_REPOSITORY } from './domain/repositories/report-submission-mark.repository';

// ORGANIZATION_REPOSITORY и INDIVIDUAL_REPOSITORY приходят из @Global()
// GeneratorRepositoriesModule, поэтому их явно импортировать в imports не надо.
@Module({
  imports: [
    NestTypeOrmModule.forFeature([
      GeneratedReportEntity,
      BalanceCorrectionEntity,
      ReportRequisitesEntity,
      ReportDraftEntity,
      ReportSubmissionMarkEntity,
    ]),
  ],
  providers: [
    ReportRegistryService,
    ReportPreviewService,
    ReportRequisitesService,
    ReportEditsBuilderService,
    Ndfl6DataService,
    ReportInitService,
    XsdValidatorService,
    ReportResolver,
    ReportRequisitesResolver,
    ReportDraftResolver,
    ReportCalendarResolver,
    WithheldTaxResolver,
    WithheldTaxService,
    {
      provide: GENERATED_REPORT_REPOSITORY,
      useClass: GeneratedReportTypeormRepository,
    },
    {
      provide: BALANCE_CORRECTION_REPOSITORY,
      useClass: BalanceCorrectionTypeormRepository,
    },
    {
      provide: REPORT_REQUISITES_REPOSITORY,
      useClass: ReportRequisitesTypeormRepository,
    },
    {
      provide: REPORT_DRAFT_REPOSITORY,
      useClass: ReportDraftTypeormRepository,
    },
    {
      provide: REPORT_SUBMISSION_MARK_REPOSITORY,
      useClass: ReportSubmissionMarkTypeormRepository,
    },
  ],
  exports: [
    ReportRegistryService,
    XsdValidatorService,
    ReportRequisitesService,
    GENERATED_REPORT_REPOSITORY,
    BALANCE_CORRECTION_REPOSITORY,
    REPORT_REQUISITES_REPOSITORY,
    REPORT_DRAFT_REPOSITORY,
    REPORT_SUBMISSION_MARK_REPOSITORY,
  ],
})
export class ReportsExtensionModule {
  // Lifecycle-сервис вызывает moduleInstance.initialize(config) после миграций схемы.
  // У reports нет собственного состояния/крона — initialize-стаб, как у BuiltinExtensionModule.
  async initialize(): Promise<void> {
    // no-op: reports-extension не имеет собственного crontab/state'а.
  }
}
