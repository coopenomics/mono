import { Inject, Injectable, Logger } from '@nestjs/common';
import { ReportType } from '../enums/report-type.enum';
import {
  REPORT_REQUISITES_REPOSITORY,
  type ReportRequisitesRepository,
  type UpsertReportRequisitesInput,
  type SignerTypeValue,
} from '../repositories/report-requisites.repository';
import {
  ORGANIZATION_REPOSITORY,
  type OrganizationRepository,
} from '~/domain/common/repositories/organization.repository';
import type { OrganizationDomainInterface } from '~/domain/common/interfaces/organization-domain.interface';

export type RequisiteSource = 'database' | 'manual' | 'empty';

export interface RequisiteField<T = string> {
  value: T | null;
  source: RequisiteSource;
}

export interface MergedRequisites {
  coopname: string;
  /** Поля из IOrganizationData (БД кооператива). */
  inn: RequisiteField;
  kpp: RequisiteField;
  ogrn: RequisiteField;
  orgName: RequisiteField;
  address: RequisiteField;
  phone: RequisiteField;
  signerLastName: RequisiteField;
  signerFirstName: RequisiteField;
  signerMiddleName: RequisiteField;
  chairmanPositionFromOrg: RequisiteField;
  /** Ручные поля из report_requisites. */
  okved: RequisiteField;
  okfs: RequisiteField;
  okopf: RequisiteField;
  oktmo: RequisiteField;
  okpo: RequisiteField;
  sfrRegNumber: RequisiteField;
  chairmanPosition: RequisiteField;
  signerSnils: RequisiteField;
  signerRepDoc: RequisiteField;
  /**
   * Тип подписанта — не имеет «источника» database/manual: это чистый choice,
   * выбираемый председателем в SettingsPage. Default = 'chairman' если не задан.
   */
  signerType: SignerTypeValue;
}

export interface MissingField {
  key: string;
  label: string;
  reason: string;
  source: RequisiteSource;
}

export interface ReadinessResult {
  ready: boolean;
  missingFields: MissingField[];
}

/**
 * Реестр обязательных полей по типу отчёта. `source` указывает,
 * откуда поле должно прийти — из организационной БД кооператива
 * (невозможно исправить через updateReportRequisites) или из таблицы
 * `report_requisites` (редактируется председателем).
 */
type RequiredFieldSpec = {
  key: keyof MergedRequisites;
  label: string;
  source: 'database' | 'manual';
};

const ALWAYS_REQUIRED: RequiredFieldSpec[] = [
  { key: 'inn', label: 'ИНН', source: 'database' },
  { key: 'kpp', label: 'КПП', source: 'database' },
  { key: 'ogrn', label: 'ОГРН', source: 'database' },
  { key: 'orgName', label: 'Наименование организации', source: 'database' },
  { key: 'signerLastName', label: 'Фамилия подписанта', source: 'database' },
  { key: 'signerFirstName', label: 'Имя подписанта', source: 'database' },
];

const REQUIRED_BY_TYPE: Record<ReportType, RequiredFieldSpec[]> = {
  [ReportType.BUHOTCH]: [
    { key: 'okved', label: 'ОКВЭД', source: 'manual' },
    { key: 'okfs', label: 'ОКФС', source: 'manual' },
    { key: 'okopf', label: 'ОКОПФ', source: 'manual' },
  ],
  [ReportType.NDFL6]: [{ key: 'oktmo', label: 'ОКТМО', source: 'manual' }],
  [ReportType.RSV]: [{ key: 'oktmo', label: 'ОКТМО', source: 'manual' }],
  [ReportType.DUSN]: [{ key: 'oktmo', label: 'ОКТМО', source: 'manual' }],
  [ReportType.FSS4]: [
    { key: 'oktmo', label: 'ОКТМО', source: 'manual' },
    { key: 'sfrRegNumber', label: 'Регистрационный номер в СФР', source: 'manual' },
    { key: 'chairmanPosition', label: 'Должность руководителя', source: 'manual' },
  ],
  [ReportType.PSV]: [{ key: 'signerSnils', label: 'СНИЛС подписанта', source: 'manual' }],
  [ReportType.UV_VZNOSY]: [{ key: 'oktmo', label: 'ОКТМО', source: 'manual' }],
  [ReportType.UUSN]: [{ key: 'oktmo', label: 'ОКТМО', source: 'manual' }],
};

@Injectable()
export class ReportRequisitesService {
  private readonly logger = new Logger(ReportRequisitesService.name);

  constructor(
    @Inject(REPORT_REQUISITES_REPOSITORY)
    private readonly reqRepo: ReportRequisitesRepository,
    @Inject(ORGANIZATION_REPOSITORY)
    private readonly orgRepo: OrganizationRepository,
  ) {}

  async getMerged(coopname: string): Promise<MergedRequisites> {
    const [org, manual] = await Promise.all([
      this.safeLoadOrganization(coopname),
      this.reqRepo.getByCoopname(coopname),
    ]);

    const db = (value: string | undefined | null): RequisiteField => {
      const v = value?.trim() || null;
      return { value: v, source: v ? 'database' : 'empty' };
    };
    const mn = (value: string | undefined | null): RequisiteField => {
      const v = value?.trim() || null;
      return { value: v, source: v ? 'manual' : 'empty' };
    };

    const address = manual?.address_override?.trim()
      ? ({ value: manual.address_override, source: 'manual' } as RequisiteField)
      : db(org?.full_address);
    const phone = manual?.phone_override?.trim()
      ? ({ value: manual.phone_override, source: 'manual' } as RequisiteField)
      : db(org?.phone);

    return {
      coopname,
      inn: db(org?.details?.inn),
      kpp: db(org?.details?.kpp),
      ogrn: db(org?.details?.ogrn),
      orgName: db(org?.full_name || org?.short_name),
      address,
      phone,
      signerLastName: db(org?.represented_by?.last_name),
      signerFirstName: db(org?.represented_by?.first_name),
      signerMiddleName: db(org?.represented_by?.middle_name),
      chairmanPositionFromOrg: db(org?.represented_by?.position),
      okved: mn(manual?.okved),
      okfs: mn(manual?.okfs),
      okopf: mn(manual?.okopf),
      oktmo: mn(manual?.oktmo),
      okpo: mn(manual?.okpo),
      sfrRegNumber: mn(manual?.sfr_reg_number),
      chairmanPosition: mn(manual?.chairman_position),
      signerSnils: mn(manual?.signer_snils),
      signerRepDoc: mn(manual?.signer_rep_doc),
      signerType: manual?.signer_type ?? 'chairman',
    };
  }

  async upsert(input: Omit<UpsertReportRequisitesInput, 'coopname'> & { coopname: string }): Promise<MergedRequisites> {
    const { ignoredKeys, cleaned } = this.stripDatabaseFields(input);
    if (ignoredKeys.length) {
      this.logger.warn(
        `updateReportRequisites: поля ${ignoredKeys.join(', ')} берутся из профиля организации в БД, изменение в report_requisites игнорировано`
      );
    }
    await this.reqRepo.upsert(cleaned);
    return this.getMerged(input.coopname);
  }

  async checkReadiness(coopname: string, reportType: ReportType): Promise<ReadinessResult> {
    const merged = await this.getMerged(coopname);
    const required = [...ALWAYS_REQUIRED, ...(REQUIRED_BY_TYPE[reportType] ?? [])];
    const missing: MissingField[] = [];
    for (const spec of required) {
      const field = merged[spec.key] as RequisiteField | undefined;
      if (!field || !field.value) {
        missing.push({
          key: spec.key,
          label: spec.label,
          source: spec.source,
          reason:
            spec.source === 'database'
              ? 'Поле должно быть заполнено в БД кооператива (профиль организации)'
              : 'Поле не заполнено в настройках отчётности — нужен ручной ввод',
        });
      }
    }
    return { ready: missing.length === 0, missingFields: missing };
  }

  private async safeLoadOrganization(coopname: string): Promise<OrganizationDomainInterface | null> {
    try {
      return await this.orgRepo.findByUsername(coopname);
    } catch (e) {
      this.logger.warn(
        `Не удалось загрузить организацию ${coopname}: ${e instanceof Error ? e.message : String(e)}`
      );
      return null;
    }
  }

  private stripDatabaseFields(
    input: Omit<UpsertReportRequisitesInput, 'coopname'> & { coopname: string; inn?: unknown; kpp?: unknown; ogrn?: unknown },
  ): { cleaned: UpsertReportRequisitesInput; ignoredKeys: string[] } {
    const ignored: string[] = [];
    const raw = input as Record<string, unknown>;
    for (const key of ['inn', 'kpp', 'ogrn', 'orgName']) {
      if (raw[key] !== undefined) ignored.push(key);
    }
    const cleaned: UpsertReportRequisitesInput = {
      coopname: input.coopname,
      okved: input.okved ?? undefined,
      okfs: input.okfs ?? undefined,
      okopf: input.okopf ?? undefined,
      oktmo: input.oktmo ?? undefined,
      okpo: input.okpo ?? undefined,
      sfr_reg_number: input.sfr_reg_number ?? undefined,
      chairman_position: input.chairman_position ?? undefined,
      signer_snils: input.signer_snils ?? undefined,
      signer_rep_doc: input.signer_rep_doc ?? undefined,
      signer_type: input.signer_type ?? undefined,
      phone_override: input.phone_override ?? undefined,
      address_override: input.address_override ?? undefined,
      updated_by: input.updated_by,
    };
    return { cleaned, ignoredKeys: ignored };
  }
}
