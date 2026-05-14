import { Resolver, Query, Mutation, Args, Int } from '@nestjs/graphql';
import { UseGuards, Logger, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { GqlJwtAuthGuard } from '~/application/auth/guards/graphql-jwt-auth.guard';
import { RolesGuard } from '~/application/auth/guards/roles.guard';
import { AuthRoles } from '~/application/auth/decorators/auth.decorator';
import { CurrentUser } from '~/application/auth/decorators/current-user.decorator';
import type { MonoAccountDomainInterface } from '~/domain/account/interfaces/mono-account-domain.interface';
import { ReportRegistryService } from '../../domain/services/report-registry.service';
import { ReportPreviewService } from '../../domain/services/report-preview.service';
import { ReportRequisitesService } from '../../domain/services/report-requisites.service';
import { XsdValidatorService } from '../../infrastructure/services/xsd-validator.service';
import { ReportType } from '../../domain/enums/report-type.enum';
import {
  AvailableReportDTO,
  GeneratedReportDTO,
  GeneratedReportSummaryDTO,
  ReportHistoryFilterInputDTO,
  ReportHistoryPageDTO,
  ReportPreviewDTO,
  ReportPreviewInputDTO,
} from '../dto/report.dto';
import { config } from '~/config';
import type { LedgerAccountData } from '../../domain/interfaces/report-generator.interface';
import { Ledger2Service } from '~/application/ledger2/services/ledger2.service';
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

/**
 * Типы отчётов вне MVP (скрываются через feature-flag).
 * Генераторы существуют и работают, но в UI/availableReports пока не светятся.
 *
 * MVP-5 (подтверждено Восходом): BUHOTCH, NDFL6, RSV, PSV, FSS4.
 * DUSN/UUSN/UV_VZNOSY — специфичны для кооперативов на УСН, в MVP не входят.
 */
const HIDDEN_IN_MVP: ReadonlySet<ReportType> = new Set([
  ReportType.DUSN,
  ReportType.UV_VZNOSY,
  ReportType.UUSN,
]);

@Resolver()
export class ReportResolver {
  private readonly logger = new Logger(ReportResolver.name);

  constructor(
    private readonly reportRegistry: ReportRegistryService,
    private readonly previewService: ReportPreviewService,
    private readonly requisitesService: ReportRequisitesService,
    private readonly ledger2Service: Ledger2Service,
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
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
  async getAvailableReports(): Promise<AvailableReportDTO[]> {
    const coopname = config.coopname;
    const available = this.reportRegistry.getAvailableReports();
    const visible = available.filter((r) => !HIDDEN_IN_MVP.has(r.type));
    const year = new Date().getFullYear();

    // Параллелим строки — не строчный цикл с последовательным await.
    // Иначе на 5-8 формах дашборд делает 10-16 серийных запросов к БД.
    return Promise.all(
      visible.map(async (r) => {
        const [latest, readiness] = await Promise.all([
          // period=undefined — берём последний отчёт за год независимо от периода
          // (квартальные формы как NDFL6 теперь показывают «last generated» тоже).
          this.reportRepo.findLatest(coopname, r.type, year),
          this.requisitesService.checkReadiness(coopname, r.type),
        ]);
        return {
          ...r,
          lastGeneratedAt: latest?.created_at,
          readyToGenerate: readiness.ready,
          missingFields: readiness.missingFields.map((m) => m.key),
        };
      }),
    );
  }

  @Query(() => ReportPreviewDTO, {
    name: 'getReportPreview',
    description: 'Предрасчёт полей отчёта без XML — для отображения формы перед генерацией',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
  async getReportPreview(
    @Args('input', { type: () => ReportPreviewInputDTO }) input: ReportPreviewInputDTO,
  ): Promise<ReportPreviewDTO> {
    if (HIDDEN_IN_MVP.has(input.reportType)) {
      throw new BadRequestException(`Тип отчёта ${input.reportType} скрыт в MVP (feature-flag).`);
    }
    const coopname = config.coopname;
    const ledgerData = await this.loadLedger(coopname);
    const stored = await this.correctionRepo.findForYear(coopname, input.year);
    const correctionsMap = new Map<string, { prev: number; pre: number }>();
    for (const s of stored) {
      correctionsMap.set(s.account_display_id, {
        prev: Number(s.balance_previous),
        pre: Number(s.balance_pre_previous),
      });
    }

    const sections = this.previewService.build({
      reportType: input.reportType,
      year: input.year,
      period: input.period ?? undefined,
      ledgerData,
      corrections: correctionsMap,
    });

    return {
      reportType: input.reportType,
      year: input.year,
      period: input.period ?? undefined,
      sections,
    };
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
      throw new NotFoundException(`Отчёт с id=${id} не найден`);
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
    name: 'generateReportFromEdits',
    description:
      'Сгенерировать XML отчёта из edits-состояния формы (результат редактора). ' +
      'Перед записью XML проходит XSD-валидацию; всё сохраняется в архив отчётов.',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
  async generateReportFromEdits(
    @Args('reportType', { type: () => ReportType }) reportType: ReportType,
    @Args('year', { type: () => Int }) year: number,
    @Args('period', { type: () => Int, nullable: true }) period: number | null | undefined,
    @Args('editsJson') editsJson: string,
    @CurrentUser() currentUser: MonoAccountDomainInterface,
  ): Promise<GeneratedReportDTO> {
    const coopname = config.coopname;

    if (HIDDEN_IN_MVP.has(reportType)) {
      throw new BadRequestException(
        `Тип отчёта ${reportType} скрыт в MVP (feature-flag) и не может быть сгенерирован.`,
      );
    }

    if (!currentUser?.username) {
      throw new BadRequestException('generateReportFromEdits: не удалось определить пользователя');
    }

    let edits: unknown;
    try {
      edits = JSON.parse(editsJson);
    } catch (err) {
      throw new BadRequestException(
        `editsJson: невалидный JSON (${err instanceof Error ? err.message : String(err)})`,
      );
    }

    const generated = this.reportRegistry.generate(reportType, edits);

    const xsdResult = generated.xml
      ? await this.xsdValidator.validateByReportType(generated.xml, reportType)
      : { isValid: false, errors: [{ message: 'XML не сгенерирован' }] };

    const combinedErrors = [
      ...generated.errors,
      ...xsdResult.errors.map((e) => (e.line ? `[строка ${e.line}] ${e.message}` : e.message)),
    ];
    const finalIsValid = generated.isValid && xsdResult.isValid;

    if (!generated.xml) {
      return {
        reportType: generated.reportType,
        year,
        period: period ?? undefined,
        xml: '',
        fileName: generated.fileName,
        isValid: false,
        errors: combinedErrors,
      };
    }

    // organization_snapshot — реквизиты из edits. Позволяет в архиве увидеть
    // состояние шапки на момент генерации без обратного парсинга XML.
    const orgSnapshot = this.extractOrganizationSnapshot(edits);

    const saved = await this.reportRepo.create({
      coopname,
      report_type: reportType,
      year,
      period: period ?? null,
      xml: generated.xml,
      file_name: generated.fileName,
      is_valid: finalIsValid,
      validation_errors: combinedErrors.length ? combinedErrors : null,
      organization_snapshot: orgSnapshot,
      // corrections_snapshot был legacy-полем старого flow (BalanceCorrectionInput[]).
      // В edits-flow корректировки уже запечены в balance row (prev/prePrev) —
      // отдельного snapshot'а не ведём.
      corrections_snapshot: null,
      generated_by: currentUser.username,
    });

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
    // Story 1.23: источник — ledger2::accounts (blockchain_deltas). ID уже со
    // сдвигом ×1000 (51000/80000/86000) и совпадает с BuhotchGenerator.
    // Раньше брали legacy ledger (id 50/51/80), генератор его фильтровал по
    // ×1000-id и получал пустой результат → BUHOTCH всегда нули.
    // Fail-fast: если ledger2 недоступен — пробрасываем, иначе председатель
    // сдаст в ФНС отчёт с ложными «успешными» нулями.
    const accounts = await this.ledger2Service.getAccounts(coopname);
    return accounts.map((acc) => ({
      accountId: acc.id,
      name: acc.name,
      balanceCurrent: this.parseAmount(acc.balance),
      balancePrevious: 0,
      balancePrePrevious: 0,
    }));
  }

  private parseAmount(amountStr: string): number {
    // Поддерживаем отрицательные и дробные суммы. Регекс /([\d.]+)/ раньше
    // находил первую последовательность цифр и ТЕРЯЛ знак: "-1500.00 RUB"
    // становилось 1500.00, убыток молча записывался как прибыль.
    const match = amountStr.match(/(-?\d+(?:\.\d+)?)/);
    return match ? parseFloat(match[1]) : 0;
  }

  private extractErrors(raw: unknown): string[] {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw.map((e) => String(e));
    return [String(raw)];
  }

  private extractOrganizationSnapshot(edits: unknown): unknown {
    if (edits && typeof edits === 'object' && edits !== null && 'organization' in edits) {
      return (edits as { organization: unknown }).organization;
    }
    return edits;
  }
}
