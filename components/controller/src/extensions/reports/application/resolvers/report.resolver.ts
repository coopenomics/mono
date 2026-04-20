import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { UseGuards, Logger, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { GqlJwtAuthGuard } from '~/application/auth/guards/graphql-jwt-auth.guard';
import { RolesGuard } from '~/application/auth/guards/roles.guard';
import { AuthRoles } from '~/application/auth/decorators/auth.decorator';
import { CurrentUser } from '~/application/auth/decorators/current-user.decorator';
import { GeneratedReportEntity } from '../../infrastructure/entities/generated-report.entity';
import { BalanceCorrectionEntity } from '../../infrastructure/entities/balance-correction.entity';
import type { MonoAccountDomainInterface } from '~/domain/account/interfaces/mono-account-domain.interface';
import { ReportRegistryService } from '../../domain/services/report-registry.service';
import { ReportPreviewService } from '../../domain/services/report-preview.service';
import { ReportRequisitesService, type MergedRequisites } from '../../domain/services/report-requisites.service';
import { XsdValidatorService } from '../../infrastructure/services/xsd-validator.service';
import { ReportType } from '../../domain/enums/report-type.enum';
import {
  AvailableReportDTO,
  GenerateReportInputDTO,
  GeneratedReportDTO,
  GeneratedReportSummaryDTO,
  OrganizationDataInputDTO,
  ReportHistoryFilterInputDTO,
  ReportHistoryPageDTO,
  ReportPreviewDTO,
  ReportPreviewInputDTO,
} from '../dto/report.dto';
import { config } from '~/config';
import type { BalanceCorrectionInput, LedgerAccountData, ReportInput } from '../../domain/interfaces/report-generator.interface';
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
 */
const HIDDEN_IN_MVP: ReadonlySet<ReportType> = new Set([
  ReportType.PSV,
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
    @InjectDataSource()
    private readonly dataSource: DataSource,
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
    name: 'generateReport',
    description: 'Генерация отчёта для ФНС/ФСС с сохранением истории. organization-параметр опционален — если не передан, реквизиты берутся из getReportRequisites.',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
  async generateReport(
    @Args('data') data: GenerateReportInputDTO,
    @CurrentUser() currentUser: MonoAccountDomainInterface,
    @Args('organization', { nullable: true, type: () => OrganizationDataInputDTO })
    org?: OrganizationDataInputDTO,
  ): Promise<GeneratedReportDTO> {
    const coopname = config.coopname;

    // Защита от обхода feature-flag: PSV/UV_VZNOSY/UUSN скрыты в MVP
    // (не появляются в getAvailableReports и отклоняются в getReportPreview).
    // Без этого гарда chairman мог напрямую через GraphQL сгенерить
    // и сохранить отчёт скрытого типа в обход UI.
    if (HIDDEN_IN_MVP.has(data.reportType)) {
      throw new BadRequestException(
        `Тип отчёта ${data.reportType} скрыт в MVP (feature-flag) и не может быть сгенерирован.`,
      );
    }

    // Readiness-проверка: если не хватает обязательных полей — сразу ошибка,
    // ни генерации, ни записи в БД не происходит (FR-R-15).
    const readiness = await this.requisitesService.checkReadiness(coopname, data.reportType);
    if (!readiness.ready) {
      const missing = readiness.missingFields
        .map((m) => `${m.label} (${m.source === 'database' ? 'профиль организации' : 'ручной ввод'})`)
        .join('; ');
      throw new BadRequestException(
        `Нельзя сгенерировать ${data.reportType}: не заполнены обязательные поля — ${missing}. Заполните их в настройках и повторите.`
      );
    }

    const merged = await this.requisitesService.getMerged(coopname);
    const ledgerData = await this.loadLedger(coopname);
    const effectiveCorrections = await this.resolveCorrections(coopname, data.year, data.corrections);

    const resolved = this.resolveOrgFields(merged, org);

    const input: ReportInput = {
      reportType: data.reportType,
      year: data.year,
      period: data.period,
      correctionNumber: data.correctionNumber ?? 0,
      inn: resolved.inn,
      kpp: resolved.kpp,
      orgName: resolved.orgName,
      ogrn: resolved.ogrn,
      okved: resolved.okved,
      okpo: resolved.okpo,
      okfs: resolved.okfs || '16',
      okopf: resolved.okopf || '20100',
      oktmo: resolved.oktmo,
      address: resolved.address,
      phone: resolved.phone,
      signerFio: resolved.signerFio,
      signerType: resolved.signerType,
      signerRepDoc: resolved.signerRepDoc,
      signerSnils: resolved.signerSnils,
      sfrRegNumber: resolved.sfrRegNumber,
      chairmanPosition: resolved.chairmanPosition,
      ledgerData,
      corrections: effectiveCorrections,
    };

    const generated = this.reportRegistry.generate(input);

    const xsdResult = generated.xml
      ? await this.xsdValidator.validateByReportType(generated.xml, data.reportType)
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

    // Резолвер защищён @AuthRoles(['chairman']) — currentUser заведомо есть.
    // Убираем fallback 'system', чтобы не маскировать баг auth-декоратора.
    if (!currentUser?.username) {
      throw new BadRequestException('generateReport: не удалось определить пользователя');
    }
    const generatedBy = currentUser.username;

    // Транзакция: отчёт и корректировки сохраняются атомарно. Раньше это были
    // два независимых autocommit'а — если корректировки падали, запись отчёта
    // оставалась, а balance_corrections не обновлялись; на повторной генерации
    // пользователь видел «старые» значения.
    const saved = await this.dataSource.transaction(async (tx) => {
      const reportRepo = tx.getRepository(GeneratedReportEntity);
      const correctionRepo = tx.getRepository(BalanceCorrectionEntity);

      const reportEntity = reportRepo.create({
        coopname,
        report_type: data.reportType,
        year: data.year,
        period: data.period ?? null,
        xml: generated.xml,
        file_name: generated.fileName,
        is_valid: finalIsValid,
        validation_errors: combinedErrors.length ? combinedErrors : null,
        organization_snapshot: resolved,
        corrections_snapshot: data.corrections ?? null,
        generated_by: generatedBy,
      });
      const persisted = await reportRepo.save(reportEntity);

      if (data.corrections?.length) {
        await correctionRepo.upsert(
          data.corrections.map((c) => ({
            coopname,
            year: data.year,
            account_display_id: c.accountDisplayId,
            balance_previous: String(c.balancePrevious),
            balance_pre_previous: String(c.balancePrePrevious),
            updated_by: generatedBy,
          })),
          {
            conflictPaths: ['coopname', 'year', 'account_display_id'],
            skipUpdateIfNoValuesChanged: false,
          },
        );
      }
      return persisted;
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
    // Поддерживаем отрицательные и дробные суммы. Раньше регекс /([\d.]+)/
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

  /**
   * Строит итоговый набор реквизитов из merged-view (ончейн + ручные),
   * с возможностью точечного переопределения через опциональный
   * input-параметр `organization` (удобно для отладки и переиспользования
   * старым фронтом, который всё ещё шлёт поля руками).
   */
  private resolveOrgFields(merged: MergedRequisites, org?: OrganizationDataInputDTO) {
    const v = (key: keyof MergedRequisites, fallback = ''): string => {
      const field = merged[key] as { value: string | null } | undefined;
      return (field?.value ?? fallback);
    };
    const orNone = (s: string): string | undefined => (s ? s : undefined);
    return {
      inn: org?.inn ?? v('inn'),
      kpp: org?.kpp ?? v('kpp'),
      ogrn: org?.ogrn ?? v('ogrn'),
      orgName: org?.orgName ?? v('orgName'),
      okved: org?.okved ?? v('okved'),
      okpo: org?.okpo ?? orNone(v('okpo')),
      okfs: org?.okfs ?? v('okfs'),
      okopf: org?.okopf ?? v('okopf'),
      oktmo: org?.oktmo ?? v('oktmo'),
      address: org?.address ?? orNone(v('address')),
      phone: org?.phone ?? orNone(v('phone')),
      signerFio: {
        lastName: org?.signerLastName ?? v('signerLastName'),
        firstName: org?.signerFirstName ?? v('signerFirstName'),
        middleName: org?.signerMiddleName ?? orNone(v('signerMiddleName')),
      },
      // signerType теперь персистится в report_requisites (DN1). Если
      // председатель сохранил 'representative' — берём его; input.organization
      // может override, если старый фронт ещё шлёт поле руками.
      signerType: (org?.signerType ?? merged.signerType ?? 'chairman') as 'chairman' | 'representative',
      signerRepDoc: org?.signerRepDoc ?? orNone(v('signerRepDoc')),
      signerSnils: org?.signerSnils ?? orNone(v('signerSnils')),
      sfrRegNumber: org?.sfrRegNumber ?? orNone(v('sfrRegNumber')),
      chairmanPosition: org?.chairmanPosition ?? (v('chairmanPosition') || orNone(v('chairmanPositionFromOrg'))),
    };
  }
}
