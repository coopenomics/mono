import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { UseGuards, Logger } from '@nestjs/common';
import { GqlJwtAuthGuard } from '~/application/auth/guards/graphql-jwt-auth.guard';
import { RolesGuard } from '~/application/auth/guards/roles.guard';
import { AuthRoles } from '~/application/auth/decorators/auth.decorator';
import { ReportRegistryService } from '../../domain/services/report-registry.service';
import { XsdValidatorService } from '../../infrastructure/services/xsd-validator.service';
import { AvailableReportDTO, GenerateReportInputDTO, GeneratedReportDTO, OrganizationDataInputDTO } from '../dto/report.dto';
import { config } from '~/config';
import type { ReportInput, LedgerAccountData } from '../../domain/interfaces/report-generator.interface';
import { LedgerInteractor } from '~/application/ledger/interactors/ledger.interactor';

@Resolver()
export class ReportResolver {
  private readonly logger = new Logger(ReportResolver.name);

  constructor(
    private readonly reportRegistry: ReportRegistryService,
    private readonly ledgerInteractor: LedgerInteractor,
    private readonly xsdValidator: XsdValidatorService,
  ) {}

  @Query(() => [AvailableReportDTO], {
    name: 'getAvailableReports',
    description: 'Получить список доступных типов отчётов',
  })
  @UseGuards(GqlJwtAuthGuard)
  async getAvailableReports(): Promise<AvailableReportDTO[]> {
    return this.reportRegistry.getAvailableReports();
  }

  @Mutation(() => GeneratedReportDTO, {
    name: 'generateReport',
    description: 'Генерация отчёта для ФНС/ФСС',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
  async generateReport(
    @Args('data') data: GenerateReportInputDTO,
    @Args('organization') org: OrganizationDataInputDTO,
  ): Promise<GeneratedReportDTO> {
    const coopname = config.coopname;

    let ledgerData: LedgerAccountData[] = [];
    try {
      const ledgerState = await this.ledgerInteractor.getLedger({ coopname });
      ledgerData = ledgerState.chartOfAccounts.map(acc => {
        const amount = this.parseAmount(acc.available);
        return {
          accountId: acc.id,
          name: acc.name,
          balanceCurrent: amount,
          balancePrevious: 0,
          balancePrePrevious: 0,
        };
      });
    } catch (e: any) {
      this.logger.warn(`Не удалось загрузить данные ledger: ${e.message}`);
    }

    const input: ReportInput = {
      reportType: data.reportType,
      year: data.year,
      period: data.period,
      correctionNumber: data.correctionNumber ?? 0,
      inn: org.inn,
      kpp: org.kpp,
      orgName: org.orgName,
      ogrn: org.ogrn,
      okved: org.okved,
      okpo: org.okpo,
      okfs: org.okfs || '16',
      okopf: org.okopf || '20200',
      oktmo: org.oktmo,
      address: org.address,
      phone: org.phone,
      signerFio: {
        lastName: org.signerLastName,
        firstName: org.signerFirstName,
        middleName: org.signerMiddleName,
      },
      signerType: org.signerType ?? 'chairman',
      signerRepDoc: org.signerRepDoc,
      signerSnils: org.signerSnils,
      ledgerData,
      corrections: data.corrections?.map((c) => ({
        accountDisplayId: c.accountDisplayId,
        balancePrevious: c.balancePrevious,
        balancePrePrevious: c.balancePrePrevious,
      })),
    };

    const generated = this.reportRegistry.generate(input);

    if (!generated.xml) {
      return generated;
    }

    const xsdResult = this.xsdValidator.validateByReportType(generated.xml, data.reportType);
    const combinedErrors = [
      ...generated.errors,
      ...xsdResult.errors.map((e) => (e.line ? `[строка ${e.line}] ${e.message}` : e.message)),
    ];

    return {
      ...generated,
      isValid: generated.isValid && xsdResult.isValid,
      errors: combinedErrors,
    };
  }

  private parseAmount(amountStr: string): number {
    const match = amountStr.match(/([\d.]+)/);
    return match ? parseFloat(match[1]) : 0;
  }
}
