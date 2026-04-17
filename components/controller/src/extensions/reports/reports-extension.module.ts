import { Module } from '@nestjs/common';
import { TypeOrmModule as NestTypeOrmModule } from '@nestjs/typeorm';
import { ReportRegistryService } from './domain/services/report-registry.service';
import { ReportPreviewService } from './domain/services/report-preview.service';
import { ReportRequisitesService } from './domain/services/report-requisites.service';
import { ReportInitService } from './infrastructure/services/report-init.service';
import { XsdValidatorService } from './infrastructure/services/xsd-validator.service';
import { ReportResolver } from './application/resolvers/report.resolver';
import { ReportRequisitesResolver } from './application/resolvers/report-requisites.resolver';
import { LedgerModule } from '~/application/ledger/ledger.module';
import { GeneratedReportEntity } from './infrastructure/entities/generated-report.entity';
import { BalanceCorrectionEntity } from './infrastructure/entities/balance-correction.entity';
import { ReportRequisitesEntity } from './infrastructure/entities/report-requisites.entity';
import { GeneratedReportTypeormRepository } from './infrastructure/repositories/generated-report.typeorm-repository';
import { BalanceCorrectionTypeormRepository } from './infrastructure/repositories/balance-correction.typeorm-repository';
import { ReportRequisitesTypeormRepository } from './infrastructure/repositories/report-requisites.typeorm-repository';
import { GENERATED_REPORT_REPOSITORY } from './domain/repositories/generated-report.repository';
import { BALANCE_CORRECTION_REPOSITORY } from './domain/repositories/balance-correction.repository';
import { REPORT_REQUISITES_REPOSITORY } from './domain/repositories/report-requisites.repository';

// ORGANIZATION_REPOSITORY приходит из @Global() GeneratorRepositoriesModule,
// поэтому его явно импортировать в imports не надо.
@Module({
  imports: [
    LedgerModule,
    NestTypeOrmModule.forFeature([GeneratedReportEntity, BalanceCorrectionEntity, ReportRequisitesEntity]),
  ],
  providers: [
    ReportRegistryService,
    ReportPreviewService,
    ReportRequisitesService,
    ReportInitService,
    XsdValidatorService,
    ReportResolver,
    ReportRequisitesResolver,
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
  ],
  exports: [
    ReportRegistryService,
    XsdValidatorService,
    ReportRequisitesService,
    GENERATED_REPORT_REPOSITORY,
    BALANCE_CORRECTION_REPOSITORY,
    REPORT_REQUISITES_REPOSITORY,
  ],
})
export class ReportsExtensionModule {}
