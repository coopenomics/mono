import './i18n';
import { Module } from '@nestjs/common';
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
import { ReportsRegistriesResolver } from './application/resolvers/registries.resolver';
import { ReportsRegistriesService } from './application/services/registries.service';
import { WithheldTaxService } from './application/services/withheld-tax.service';
import { ReportsLiveFeedService } from './application/services/reports-live-feed.service';
import { WithheldTaxPayoutSyncService } from './application/services/withheld-tax-payout-sync.service';
import { WithheldTaxBlockchainAdapter } from './infrastructure/adapters/withheld-tax-blockchain.adapter';
import { WITHHELD_TAX_BLOCKCHAIN_PORT } from './domain/ports/withheld-tax-blockchain.port';
import { GeneratedReportKyselyRepository } from './infrastructure/repositories/generated-report.kysely-repository';
import { BalanceCorrectionKyselyRepository } from './infrastructure/repositories/balance-correction.kysely-repository';
import { ReportRequisitesKyselyRepository } from './infrastructure/repositories/report-requisites.kysely-repository';
import { ReportDraftKyselyRepository } from './infrastructure/repositories/report-draft.kysely-repository';
import { ReportSubmissionMarkKyselyRepository } from './infrastructure/repositories/report-submission-mark.kysely-repository';
import { GENERATED_REPORT_REPOSITORY } from './domain/repositories/generated-report.repository';
import { BALANCE_CORRECTION_REPOSITORY } from './domain/repositories/balance-correction.repository';
import { REPORT_REQUISITES_REPOSITORY } from './domain/repositories/report-requisites.repository';
import { REPORT_DRAFT_REPOSITORY } from './domain/repositories/report-draft.repository';
import { REPORT_SUBMISSION_MARK_REPOSITORY } from './domain/repositories/report-submission-mark.repository';
import { APP_RIGHTS, RightsGuard } from '@coopenomics/extension-kit';
import { ReportsRights } from './application/access/reports-rights';

// ORGANIZATION_REPOSITORY и INDIVIDUAL_REPOSITORY приходят из @Global()
// GeneratorRepositoriesModule, поэтому их явно импортировать в imports не надо.
@Module({
  imports: [
  ],
  providers: [
    // Права стола: описание для общего гарда операций и прав страниц
    ReportsRights,
    { provide: APP_RIGHTS, useExisting: ReportsRights },
    RightsGuard,

    ReportsLiveFeedService,
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
    ReportsRegistriesService,
    ReportsRegistriesResolver,
    WithheldTaxService,
    WithheldTaxPayoutSyncService,
    WithheldTaxBlockchainAdapter,
    { provide: WITHHELD_TAX_BLOCKCHAIN_PORT, useExisting: WithheldTaxBlockchainAdapter },
    {
      provide: GENERATED_REPORT_REPOSITORY,
      useClass: GeneratedReportKyselyRepository,
    },
    {
      provide: BALANCE_CORRECTION_REPOSITORY,
      useClass: BalanceCorrectionKyselyRepository,
    },
    {
      provide: REPORT_REQUISITES_REPOSITORY,
      useClass: ReportRequisitesKyselyRepository,
    },
    {
      provide: REPORT_DRAFT_REPOSITORY,
      useClass: ReportDraftKyselyRepository,
    },
    {
      provide: REPORT_SUBMISSION_MARK_REPOSITORY,
      useClass: ReportSubmissionMarkKyselyRepository,
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
