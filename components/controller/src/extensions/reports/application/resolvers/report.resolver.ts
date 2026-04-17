import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { UseGuards, Logger, Inject } from '@nestjs/common';
import { GqlJwtAuthGuard } from '~/application/auth/guards/graphql-jwt-auth.guard';
import { RolesGuard } from '~/application/auth/guards/roles.guard';
import { AuthRoles } from '~/application/auth/decorators/auth.decorator';
import { CurrentUser } from '~/application/auth/decorators/current-user.decorator';
import type { MonoAccountDomainInterface } from '~/domain/account/interfaces/mono-account-domain.interface';
import { ReportRegistryService } from '../../domain/services/report-registry.service';
import { XsdValidatorService } from '../../infrastructure/services/xsd-validator.service';
import {
  AvailableReportDTO,
  GenerateReportInputDTO,
  GeneratedReportDTO,
  GeneratedReportSummaryDTO,
  OrganizationDataInputDTO,
  ReportHistoryFilterInputDTO,
  ReportHistoryPageDTO,
} from '../dto/report.dto';
import { config } from '~/config';
import type { BalanceCorrectionInput, LedgerAccountData, ReportInput } from '../../domain/interfaces/report-generator.interface';
import { LedgerInteractor } from '~/application/ledger/interactors/ledger.interactor';
import {
  GENERATED_REPORT_REPOSITORY,
  type GeneratedReportRepository,
} from '../../domain/repositories/generated-report.repository';
import {
  BALANCE_CORRECTION_REPOSITORY,
  type BalanceCorrectionRepository,
} from '../../domain/repositories/balance-correction.repository';

const HISTORY_MAX_LIMIT = 100;
const HISTORY_DEFAULT_LIMIT = 20;

@Resolver()
export class ReportResolver {
  private readonly logger = new Logger(ReportResolver.name);

  constructor(
    private readonly reportRegistry: ReportRegistryService,
    private readonly ledgerInteractor: LedgerInteractor,
    private readonly xsdValidator: XsdValidatorService,
    @Inject(GENERATED_REPORT_REPOSITORY)
    private readonly reportRepo: GeneratedReportRepository,
    @Inject(BALANCE_CORRECTION_REPOSITORY)
    private readonly correctionRepo: BalanceCorrectionRepository,
  ) {}

  @Query(() => [AvailableReportDTO], {
    name: 'getAvailableReports',
    description: 'Получить список доступных типов отчётов',
  })
  @UseGuards(GqlJwtAuthGuard)
  async getAvailableReports(): Promise<AvailableReportDTO[]> {
    return this.reportRegistry.getAvailableReports();
  }

  @Query(() => ReportHistoryPageDTO, {
    name: 'getReportHistory',
    description: 'История сгенерированных отчётов (постраничная, без XML)',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
  async getReportHistory(
    @Args('filter', { type: () => ReportHistoryFilterInputDTO, nullable: true })
    filter?: ReportHistoryFilterInputDTO,
  ): Promise<ReportHistoryPageDTO> {
    const coopname = config.coopname;
    const limit = Math.min(filter?.limit ?? HISTORY_DEFAULT_LIMIT, HISTORY_MAX_LIMIT);
    const offset = Math.max(filter?.offset ?? 0, 0);

    const { items, total } = await this.reportRepo.list(
      {
        coopname,
        report_type: filter?.reportType,
        year: filter?.year,
        period: filter?.period ?? undefined,
      },
      limit,
      offset
    );

    return {
      items: items.map<GeneratedReportSummaryDTO>((r) => ({
        id: r.id,
        reportType: r.report_type,
        year: r.year,
        period: r.period ?? undefined,
        fileName: r.file_name,
        isValid: r.is_valid,
        generatedBy: r.generated_by,
        createdAt: r.created_at,
      })),
      total,
    };
  }

  @Query(() => GeneratedReportDTO, {
    name: 'getReport',
    description: 'Получить сгенерированный отчёт по UUID — XML возвращается дословно',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
  async getReport(@Args('id', { type: () => String }) id: string): Promise<GeneratedReportDTO> {
    const coopname = config.coopname;
    const record = await this.reportRepo.findById(id);
    if (!record || record.coopname !== coopname) {
      throw new Error(`Отчёт с id=${id} не найден`);
    }
    return {
      id: record.id,
      reportType: record.report_type,
      year: record.year,
      period: record.period ?? undefined,
      xml: record.xml,
      fileName: record.file_name,
      isValid: record.is_valid,
      errors: this.extractErrors(record.validation_errors),
      createdAt: record.created_at,
    };
  }

  @Mutation(() => GeneratedReportDTO, {
    name: 'generateReport',
    description: 'Генерация отчёта для ФНС/ФСС с сохранением истории',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
  async generateReport(
    @Args('data') data: GenerateReportInputDTO,
    @Args('organization') org: OrganizationDataInputDTO,
    @CurrentUser() currentUser: MonoAccountDomainInterface,
  ): Promise<GeneratedReportDTO> {
    const coopname = config.coopname;

    const ledgerData = await this.loadLedger(coopname);
    const effectiveCorrections = await this.resolveCorrections(coopname, data.year, data.corrections);

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
      corrections: effectiveCorrections,
    };

    const generated = this.reportRegistry.generate(input);

    const xsdResult = generated.xml
      ? this.xsdValidator.validateByReportType(generated.xml, data.reportType)
      : { isValid: false, errors: [{ message: 'XML не сгенерирован' }] };

    const combinedErrors = [
      ...generated.errors,
      ...xsdResult.errors.map((e) => (e.line ? `[строка ${e.line}] ${e.message}` : e.message)),
    ];
    const finalIsValid = generated.isValid && xsdResult.isValid;

    if (!generated.xml) {
      return {
        reportType: generated.reportType,
        year: data.year,
        period: data.period ?? undefined,
        xml: '',
        fileName: generated.fileName,
        isValid: false,
        errors: combinedErrors,
      };
    }

    const saved = await this.reportRepo.create({
      coopname,
      report_type: data.reportType,
      year: data.year,
      period: data.period ?? null,
      xml: generated.xml,
      file_name: generated.fileName,
      is_valid: finalIsValid,
      validation_errors: combinedErrors.length ? combinedErrors : null,
      organization_snapshot: org,
      corrections_snapshot: data.corrections ?? null,
      generated_by: currentUser?.username ?? 'system',
    });

    if (data.corrections?.length) {
      await this.correctionRepo.upsertMany(
        data.corrections.map((c) => ({
          coopname,
          year: data.year,
          account_display_id: c.accountDisplayId,
          balance_previous: c.balancePrevious,
          balance_pre_previous: c.balancePrePrevious,
          updated_by: currentUser?.username ?? 'system',
        }))
      );
    }

    return {
      id: saved.id,
      reportType: saved.report_type,
      year: saved.year,
      period: saved.period ?? undefined,
      xml: saved.xml,
      fileName: saved.file_name,
      isValid: saved.is_valid,
      errors: combinedErrors,
      createdAt: saved.created_at,
    };
  }

  private async loadLedger(coopname: string): Promise<LedgerAccountData[]> {
    try {
      const ledgerState = await this.ledgerInteractor.getLedger({ coopname });
      return ledgerState.chartOfAccounts.map((acc) => ({
        accountId: acc.id,
        name: acc.name,
        balanceCurrent: this.parseAmount(acc.available),
        balancePrevious: 0,
        balancePrePrevious: 0,
      }));
    } catch (e) {
      this.logger.warn(`Не удалось загрузить данные ledger: ${e instanceof Error ? e.message : String(e)}`);
      return [];
    }
  }

  /**
   * Если корректировки не переданы в input — подтягиваем сохранённые
   * для данного года из `balance_corrections`. Это даёт UX «предзаполнения
   * формы» при повторной генерации: председатель ввёл раз, в следующий
   * раз значения уже есть.
   */
  private async resolveCorrections(
    coopname: string,
    year: number,
    fromInput?: Array<{ accountDisplayId: string; balancePrevious: number; balancePrePrevious: number }>
  ): Promise<BalanceCorrectionInput[] | undefined> {
    if (fromInput && fromInput.length) {
      return fromInput.map((c) => ({
        accountDisplayId: c.accountDisplayId,
        balancePrevious: c.balancePrevious,
        balancePrePrevious: c.balancePrePrevious,
      }));
    }
    const stored = await this.correctionRepo.findForYear(coopname, year);
    if (stored.length === 0) return undefined;
    return stored.map((s) => ({
      accountDisplayId: s.account_display_id,
      balancePrevious: Number(s.balance_previous),
      balancePrePrevious: Number(s.balance_pre_previous),
    }));
  }

  private parseAmount(amountStr: string): number {
    const match = amountStr.match(/([\d.]+)/);
    return match ? parseFloat(match[1]) : 0;
  }

  private extractErrors(raw: unknown): string[] {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw.map((e) => String(e));
    return [String(raw)];
  }
}
