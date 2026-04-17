import { Module } from '@nestjs/common';
import { TypeOrmModule as NestTypeOrmModule } from '@nestjs/typeorm';
import { ReportRegistryService } from './domain/services/report-registry.service';
import { ReportInitService } from './infrastructure/services/report-init.service';
import { XsdValidatorService } from './infrastructure/services/xsd-validator.service';
import { ReportResolver } from './application/resolvers/report.resolver';
import { LedgerModule } from '~/application/ledger/ledger.module';
import { GeneratedReportEntity } from './infrastructure/entities/generated-report.entity';
import { BalanceCorrectionEntity } from './infrastructure/entities/balance-correction.entity';
import { GeneratedReportTypeormRepository } from './infrastructure/repositories/generated-report.typeorm-repository';
import { BalanceCorrectionTypeormRepository } from './infrastructure/repositories/balance-correction.typeorm-repository';
import { GENERATED_REPORT_REPOSITORY } from './domain/repositories/generated-report.repository';
import { BALANCE_CORRECTION_REPOSITORY } from './domain/repositories/balance-correction.repository';

@Module({
  imports: [
    LedgerModule,
    NestTypeOrmModule.forFeature([GeneratedReportEntity, BalanceCorrectionEntity]),
  ],
  providers: [
    ReportRegistryService,
    ReportInitService,
    XsdValidatorService,
    ReportResolver,
    {
      provide: GENERATED_REPORT_REPOSITORY,
      useClass: GeneratedReportTypeormRepository,
    },
    {
      provide: BALANCE_CORRECTION_REPOSITORY,
      useClass: BalanceCorrectionTypeormRepository,
    },
  ],
  exports: [
    ReportRegistryService,
    XsdValidatorService,
    GENERATED_REPORT_REPOSITORY,
    BALANCE_CORRECTION_REPOSITORY,
  ],
})
export class ReportsExtensionModule {}
