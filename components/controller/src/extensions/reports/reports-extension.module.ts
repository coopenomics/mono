import { Module } from '@nestjs/common';
import { ReportRegistryService } from './domain/services/report-registry.service';
import { ReportInitService } from './infrastructure/services/report-init.service';
import { ReportResolver } from './application/resolvers/report.resolver';
import { LedgerModule } from '~/application/ledger/ledger.module';

@Module({
  imports: [LedgerModule],
  providers: [
    ReportRegistryService,
    ReportInitService,
    ReportResolver,
  ],
  exports: [ReportRegistryService],
})
export class ReportsExtensionModule {}
