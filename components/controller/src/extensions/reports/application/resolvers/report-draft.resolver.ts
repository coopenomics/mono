import { Args, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { BadRequestException, Inject, NotFoundException, UseGuards } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate, type ValidationError } from 'class-validator';
import { GqlJwtAuthGuard } from '~/application/auth/guards/graphql-jwt-auth.guard';
import { RolesGuard } from '~/application/auth/guards/roles.guard';
import { AuthRoles } from '~/application/auth/decorators/auth.decorator';
import { CurrentUser } from '~/application/auth/decorators/current-user.decorator';
import type { MonoAccountDomainInterface } from '~/domain/account/interfaces/mono-account-domain.interface';
import { config } from '~/config';
import { ReportType } from '../../domain/enums/report-type.enum';
import {
  REPORT_DRAFT_REPOSITORY,
  type ReportDraftRecord,
  type ReportDraftRepository,
} from '../../domain/repositories/report-draft.repository';
import {
  BuildInitialReportEditsDTO,
  ListReportDraftsFilterInputDTO,
  ReportDraftDTO,
  SaveReportDraftInputDTO,
} from '../dto/report-draft.dto';
import { ReportEditsBuilderService } from '../../domain/services/report-edits-builder.service';
import { applyDirtyOverrides } from '../../domain/utils/dirty-merge';
import { BuhotchEditsInputDTO } from '../dto/buhotch-edits.dto';
import { FieldErrorDTO } from '../dto/field-error.dto';
import { ZeroReportEditsInputDTO } from '../dto/zero-report-edits.dto';

@Resolver()
export class ReportDraftResolver {
  constructor(
    @Inject(REPORT_DRAFT_REPOSITORY)
    private readonly draftRepo: ReportDraftRepository,
    private readonly editsBuilder: ReportEditsBuilderService,
  ) {}

  @Query(() => BuildInitialReportEditsDTO, {
    name: 'buildInitialReportEdits',
    description:
      'Построить предзаполненные edits для формы: дефолты (ledger2 + реквизиты + корректировки), ' +
      'с наложением dirty-полей существующего черновика (если он есть).',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
  async buildInitialReportEdits(
    @Args('reportType', { type: () => ReportType }) reportType: ReportType,
    @Args('year', { type: () => Int }) year: number,
    @Args('period', { type: () => Int, nullable: true }) period: number | null | undefined,
    @CurrentUser() currentUser: MonoAccountDomainInterface,
  ): Promise<BuildInitialReportEditsDTO> {
    const coopname = config.coopname;
    const [defaults, draft] = await Promise.all([
      this.editsBuilder.build(reportType, year, period ?? null, coopname),
      this.draftRepo.findOne(
        coopname,
        currentUser.username,
        reportType,
        year,
        period ?? null,
      ),
    ]);

    const editedFields = draft?.edited_fields ?? [];
    const merged = draft
      ? applyDirtyOverrides(defaults, draft.edits_json, editedFields)
      : defaults;

    return {
      editsJson: JSON.stringify(merged),
      editedFields,
      hasDraft: draft !== null,
    };
  }

  @Mutation(() => ReportDraftDTO, {
    name: 'saveReportDraft',
    description: 'Сохранить/обновить черновик формы отчёта (upsert по owner+type+year+period)',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
  async saveReportDraft(
    @Args('input') input: SaveReportDraftInputDTO,
    @CurrentUser() currentUser: MonoAccountDomainInterface,
  ): Promise<ReportDraftDTO> {
    const parsedEdits = this.parseEditsJson(input.editsJson);
    const record = await this.draftRepo.save({
      coopname: config.coopname,
      owner_username: currentUser.username,
      report_type: input.reportType,
      year: input.year,
      period: input.period ?? null,
      edits_json: parsedEdits,
      edited_fields: input.editedFields,
    });
    return this.toDTO(record);
  }

  @Query(() => ReportDraftDTO, {
    name: 'getReportDraft',
    nullable: true,
    description: 'Получить черновик формы отчёта по типу+году+периоду (null если не существует)',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
  async getReportDraft(
    @Args('reportType', { type: () => ReportType }) reportType: ReportType,
    @Args('year', { type: () => Int }) year: number,
    @Args('period', { type: () => Int, nullable: true }) period: number | null | undefined,
    @CurrentUser() currentUser: MonoAccountDomainInterface,
  ): Promise<ReportDraftDTO | null> {
    const record = await this.draftRepo.findOne(
      config.coopname,
      currentUser.username,
      reportType,
      year,
      period ?? null,
    );
    return record ? this.toDTO(record) : null;
  }

  @Query(() => [ReportDraftDTO], {
    name: 'listReportDrafts',
    description: 'Список черновиков форм отчётов текущего пользователя (с опциональной фильтрацией)',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
  async listReportDrafts(
    @Args('filter', { type: () => ListReportDraftsFilterInputDTO, nullable: true })
    filter: ListReportDraftsFilterInputDTO | undefined,
    @CurrentUser() currentUser: MonoAccountDomainInterface,
  ): Promise<ReportDraftDTO[]> {
    const records = await this.draftRepo.list({
      coopname: config.coopname,
      owner_username: currentUser.username,
      report_type: filter?.reportType,
      year: filter?.year,
      period: filter?.period,
    });
    return records.map((r) => this.toDTO(r));
  }

  @Query(() => [FieldErrorDTO], {
    name: 'validateReportEdits',
    description:
      'Валидировать edits-состояние формы: возвращает список ошибок полей ' +
      'с JSONPath (совпадает с editedFields-путями на клиенте).',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
  async validateReportEdits(
    @Args('reportType', { type: () => ReportType }) reportType: ReportType,
    @Args('editsJson') editsJson: string,
  ): Promise<FieldErrorDTO[]> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(editsJson);
    } catch (err) {
      throw new BadRequestException(
        `editsJson: невалидный JSON (${err instanceof Error ? err.message : String(err)})`,
      );
    }
    const dto = this.buildEditsInputDto(reportType, parsed);
    const errors = await validate(dto, { whitelist: false, forbidNonWhitelisted: false });
    return this.flattenValidationErrors(errors);
  }

  @Mutation(() => Boolean, {
    name: 'deleteReportDraft',
    description: 'Удалить черновик по id (только владелец)',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
  async deleteReportDraft(
    @Args('id') id: string,
    @CurrentUser() currentUser: MonoAccountDomainInterface,
  ): Promise<boolean> {
    const record = await this.draftRepo.findById(id);
    if (!record) throw new NotFoundException(`Draft ${id} not found`);
    if (record.owner_username !== currentUser.username || record.coopname !== config.coopname) {
      throw new NotFoundException(`Draft ${id} not found`);
    }
    return this.draftRepo.delete(id, config.coopname, currentUser.username);
  }

  /**
   * Собрать Input-DTO нужного типа для class-validator.
   * plainToInstance применяет @Type-трансформы для вложенных объектов.
   */
  private buildEditsInputDto(reportType: ReportType, parsed: unknown): object {
    if (reportType === ReportType.BUHOTCH) {
      return plainToInstance(BuhotchEditsInputDTO, parsed ?? {});
    }
    // Остальные 6 форм — общий ZeroReportEditsInputDTO. Per-type отличия
    // (обязательность СНИЛС для ПСВ, sfrRegNumber для ЕФС-1) проверяет
    // сам генератор в runtime — DTO-валидация для них помечает
    // соответствующие поля как @IsOptional(), и если поле пустое,
    // generator бросит с понятным сообщением.
    return plainToInstance(ZeroReportEditsInputDTO, parsed ?? {});
  }

  /**
   * ValidationError[] от class-validator — дерево с nested children.
   * Разворачиваем в плоский FieldErrorDTO[] с точечным JSONPath.
   * path'ы совпадают с теми, что клиент кладёт в `editedFields` при dirty-tracking.
   */
  private flattenValidationErrors(errors: ValidationError[], prefix = ''): FieldErrorDTO[] {
    const flat: FieldErrorDTO[] = [];
    for (const err of errors) {
      const path = prefix ? `${prefix}.${err.property}` : err.property;
      if (err.constraints) {
        for (const message of Object.values(err.constraints)) {
          flat.push({ path, message });
        }
      }
      if (err.children && err.children.length > 0) {
        flat.push(...this.flattenValidationErrors(err.children, path));
      }
    }
    return flat;
  }

  private parseEditsJson(raw: string): unknown {
    try {
      return JSON.parse(raw);
    } catch (err) {
      throw new BadRequestException(
        `editsJson: невалидный JSON (${err instanceof Error ? err.message : String(err)})`,
      );
    }
  }

  private toDTO(record: ReportDraftRecord): ReportDraftDTO {
    return {
      id: record.id,
      ownerUsername: record.owner_username,
      reportType: record.report_type,
      year: record.year,
      period: record.period ?? null,
      editsJson: JSON.stringify(record.edits_json),
      editedFields: record.edited_fields ?? [],
      createdAt: record.created_at,
      updatedAt: record.updated_at,
    };
  }
}
