import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  DomainError,
  TableStore,
  ilike,
  isNull,
  oneOf,
} from '@coopenomics/extension-kit';
import {
  counterpartyAccountId,
  counterpartyFieldsFor,
  counterpartyTaxId,
  formatCounterpartyRequisites,
  getCounterpartyRequisites,
  pickCounterpartyRequisites,
  validateCounterpartyRequisites,
  type CounterpartyRequisitesProfile,
} from '@coopenomics/jurisdictions';
import { ORGANIZATION_PORT, type IMonoAccount, type IOrganizationPort } from '@coopenomics/innercoop';
import { EXPENSES_COUNTERPARTY_STORE, EXPENSES_PLAN_STORE } from '../../infrastructure/database/expenses-stores';
import { ExpenseCounterpartyRecord } from '../../infrastructure/entities/expense-counterparty.record';
import { ExpensePlanEntity } from '../../infrastructure/entities/expense-plan.entity';
import { ExpenseCounterpartyKind } from '../../domain/enums/expense-counterparty-kind.enum';
import { ExpenseBranchOperatorsService } from './expense-branch-operators.service';

/** Сколько контрагентов отдаёт один запрос списка: выбор идёт поиском, а не листанием. */
export const EXPENSE_COUNTERPARTIES_LIST_LIMIT = 200;

/** Поле реквизитов в форме контрагента — для вида контрагента в стране кооператива. */
export interface ExpenseCounterpartyFormFieldView {
  key: string;
  label: string;
  required: boolean;
  /** Длина значения в цифрах; `null` — значение не только из цифр. */
  length: number | null;
  /** Шаблон значения целиком, если оно не только из цифр. */
  pattern: string | null;
  group: 'organization' | 'bank';
  /** Налоговый номер: по нему заполняются сведения из реестра страны. */
  tax_id: boolean;
}

export interface ExpenseCounterpartyFormView {
  /** Страна кооператива — ей принадлежат поля и правила реквизитов. */
  country: string;
  kinds: { kind: ExpenseCounterpartyKind; fields: ExpenseCounterpartyFormFieldView[] }[];
}

export interface ExpenseCounterpartyView {
  id: number;
  /** Участок, который добавил контрагента; `null` — контрагент кооператива. */
  braname: string | null;
  kind: ExpenseCounterpartyKind;
  name: string;
  tax_id: string;
  /** Реквизиты по полям страны в порядке платёжного поручения. */
  requisites: { key: string; label: string; value: string }[];
  /** Реквизиты строкой — как в служебной записке и поручении кассиру. */
  requisites_text: string;
  payment_purpose: string | null;
  archived: boolean;
  creator: string;
  created_at: Date;
  /** Тот, кто спрашивает, вправе править контрагента. */
  can_manage: boolean;
}

export interface ExpenseCounterpartyInput {
  braname?: string | null;
  kind: ExpenseCounterpartyKind;
  name: string;
  requisites: Record<string, string>;
  payment_purpose?: string | null;
}

/**
 * Реестр контрагентов шасси расходов (задача 99D-35, решение владельца
 * 11.11.2026): организации и ИП, которым кооператив платит по реквизитам.
 *
 * Видят всех контрагентов кооператива совет и операторы любого участка — выбор
 * получателя не зависит от того, кто его завёл. Править контрагента
 * кооператива вправе совет; контрагента, добавленного участком, — совет и
 * операторы этого участка. Реквизиты проверяются правилами страны кооператива
 * (пакет юрисдикций): длины, обязательность, контрольные суммы.
 *
 * Контрагент, указанный в неоплаченной записи плана, не удаляется — его
 * убирают в архив: архив скрывает контрагента из выбора, прежние записи и
 * поданные записки его сохраняют.
 */
@Injectable()
export class ExpenseCounterpartiesService {
  private readonly logger = new Logger(ExpenseCounterpartiesService.name);

  constructor(
    @Inject(EXPENSES_COUNTERPARTY_STORE)
    private readonly store: TableStore<ExpenseCounterpartyRecord>,
    @Inject(EXPENSES_PLAN_STORE)
    private readonly plans: TableStore<ExpensePlanEntity>,
    @Inject(ORGANIZATION_PORT)
    private readonly organizations: IOrganizationPort,
    private readonly branchOperators: ExpenseBranchOperatorsService
  ) {}

  /** Поля формы контрагента по стране кооператива. */
  async form(coopname: string): Promise<ExpenseCounterpartyFormView> {
    const { country, profile } = await this.profileOf(coopname);
    return {
      country,
      kinds: Object.values(ExpenseCounterpartyKind).map((kind) => ({
        kind,
        fields: counterpartyFieldsFor(profile, kind).map((f) => ({
          key: f.key,
          label: f.label,
          required: f.requiredHere,
          length: f.length,
          pattern: f.pattern ?? null,
          group: f.group,
          tax_id: !!f.taxId,
        })),
      })),
    };
  }

  /**
   * Контрагенты кооператива: поиск по наименованию и налоговому номеру, без
   * архива по умолчанию. Видят совет и операторы участков.
   */
  async list(
    coopname: string,
    viewer: IMonoAccount,
    filter: { search?: string | null; include_archived?: boolean | null } = {}
  ): Promise<ExpenseCounterpartyView[]> {
    const own = await this.assertCanRead(coopname, viewer);
    const base: Partial<Record<keyof ExpenseCounterpartyRecord, unknown>> = { coopname };
    if (!filter.include_archived) base.archived = false;
    const search = filter.search?.trim();
    const where = search
      ? [
          { ...base, name: ilike(`%${escapeLike(search)}%`) },
          { ...base, tax_id: ilike(`${escapeLike(search)}%`) },
        ]
      : base;
    const rows = await this.store.find(where, { order: { name: 'ASC', id: 'ASC' }, limit: EXPENSE_COUNTERPARTIES_LIST_LIMIT });
    const { profile } = await this.profileOf(coopname);
    return rows.map((r) => this.toView(r, profile, this.canManage(viewer, own, r)));
  }

  async get(coopname: string, viewer: IMonoAccount, id: number): Promise<ExpenseCounterpartyView> {
    const own = await this.assertCanRead(coopname, viewer);
    const row = await this.mustFind(coopname, id);
    const { profile } = await this.profileOf(coopname);
    return this.toView(row, profile, this.canManage(viewer, own, row));
  }

  async create(coopname: string, viewer: IMonoAccount, input: ExpenseCounterpartyInput): Promise<ExpenseCounterpartyView> {
    const braname = input.braname?.trim() || null;
    await this.assertCanManageScope(coopname, viewer, braname);
    const { profile } = await this.profileOf(coopname);
    const fields = this.checkedFields(profile, input);
    await this.assertNotDuplicate(coopname, profile, fields.tax_id, fields.requisites, null);
    const row = await this.store.save(
      this.store.create({
        coopname,
        braname,
        kind: input.kind,
        name: fields.name,
        tax_id: fields.tax_id,
        requisites: fields.requisites,
        payment_purpose: fields.payment_purpose,
        archived: false,
        creator: viewer.username,
      })
    );
    return this.toView(row, profile, true);
  }

  async update(coopname: string, viewer: IMonoAccount, id: number, input: ExpenseCounterpartyInput): Promise<ExpenseCounterpartyView> {
    const row = await this.mustFind(coopname, id);
    await this.assertCanManageScope(coopname, viewer, row.braname);
    const { profile } = await this.profileOf(coopname);
    const fields = this.checkedFields(profile, input);
    await this.assertNotDuplicate(coopname, profile, fields.tax_id, fields.requisites, row.id);
    // Участок-владелец не меняется правкой: пометка говорит, кто завёл контрагента.
    await this.store.update(
      { id: row.id },
      { kind: input.kind, name: fields.name, tax_id: fields.tax_id, requisites: fields.requisites, payment_purpose: fields.payment_purpose }
    );
    return this.toView(await this.mustFind(coopname, id), profile, true);
  }

  async setArchived(coopname: string, viewer: IMonoAccount, id: number, archived: boolean): Promise<ExpenseCounterpartyView> {
    const row = await this.mustFind(coopname, id);
    await this.assertCanManageScope(coopname, viewer, row.braname);
    await this.store.update({ id: row.id }, { archived });
    const { profile } = await this.profileOf(coopname);
    return this.toView({ ...row, archived }, profile, true);
  }

  /**
   * Удалить контрагента. Указанного в неоплаченной записи плана удалить нельзя:
   * по записи ещё будут платить, и реквизиты должны остаться. Поданные записки
   * держат свой снимок реквизитов и от удаления не зависят.
   */
  async delete(coopname: string, viewer: IMonoAccount, id: number): Promise<void> {
    const row = await this.mustFind(coopname, id);
    await this.assertCanManageScope(coopname, viewer, row.braname);
    const inUse = await this.plans.count({ coopname, counterpartyId: row.id, paidAt: isNull() });
    if (inUse > 0) throw DomainError.badRequest('EXPENSES_COUNTERPARTY_IN_USE', { count: inUse });
    await this.store.delete({ id: row.id });
  }

  /**
   * Контрагент для оплаты — без проверки того, кто спрашивает: права уже
   * проверило действие, которое платит. Архивный контрагент для новой оплаты
   * не годится.
   */
  async forPayment(coopname: string, id: number): Promise<{ record: ExpenseCounterpartyRecord; requisitesText: string }> {
    const record = await this.mustFind(coopname, id);
    if (record.archived) throw DomainError.badRequest('EXPENSES_COUNTERPARTY_ARCHIVED', { name: record.name });
    const { profile } = await this.profileOf(coopname);
    return { record, requisitesText: formatCounterpartyRequisites(profile, record.kind as ExpenseCounterpartyKind, record.requisites) };
  }

  /** Наименования контрагентов по номерам — одним запросом, для показа реестра планов. */
  async namesByIds(coopname: string, ids: readonly number[]): Promise<Map<number, string>> {
    if (!ids.length) return new Map();
    const rows = await this.store.find({ coopname, id: oneOf(ids) });
    return new Map(rows.map((r) => [r.id, r.name]));
  }

  // ── Внутреннее ────────────────────────────────────────────────────────

  private async profileOf(coopname: string): Promise<{ country: string; profile: CounterpartyRequisitesProfile }> {
    let country: string | null = null;
    try {
      country = (await this.organizations.findByUsername(coopname))?.country ?? null;
    } catch (e) {
      this.logger.warn(`Не удалось определить страну кооператива ${coopname}: ${(e as Error)?.message ?? e}`);
    }
    const profile = getCounterpartyRequisites(country);
    if (!country || !profile) throw DomainError.badRequest('EXPENSES_COUNTERPARTY_COUNTRY_UNKNOWN', { country: country ?? '' });
    return { country, profile };
  }

  private checkedFields(
    profile: CounterpartyRequisitesProfile,
    input: ExpenseCounterpartyInput
  ): { name: string; tax_id: string; requisites: Record<string, string>; payment_purpose: string | null } {
    const name = input.name?.trim();
    if (!name) throw DomainError.badRequest('EXPENSES_COUNTERPARTY_NAME_REQUIRED');
    const issues = validateCounterpartyRequisites(profile, input.kind, input.requisites ?? {});
    if (issues.length) {
      const labels = new Map(counterpartyFieldsFor(profile, input.kind).map((f) => [f.key, f.label]));
      throw DomainError.badRequest('EXPENSES_COUNTERPARTY_REQUISITES_INVALID', {
        fields: issues.map((i) => labels.get(i.field) ?? i.field).join(', '),
        issues: issues.map((i) => `${i.field}:${i.code}`).join(','),
      });
    }
    const requisites = pickCounterpartyRequisites(profile, input.kind, input.requisites);
    return {
      name,
      tax_id: counterpartyTaxId(profile, requisites),
      requisites,
      payment_purpose: input.payment_purpose?.trim() || null,
    };
  }

  /** Повтор — тот же налоговый номер и тот же счёт: одной организации с разными счетами быть можно. */
  private async assertNotDuplicate(
    coopname: string,
    profile: CounterpartyRequisitesProfile,
    taxId: string,
    requisites: Record<string, string>,
    exceptId: number | null
  ): Promise<void> {
    const account = counterpartyAccountId(profile, requisites);
    const sameTax = await this.store.find({ coopname, tax_id: taxId }, { limit: 50 });
    const twin = sameTax.find((r) => r.id !== exceptId && counterpartyAccountId(profile, r.requisites) === account);
    if (twin) throw DomainError.badRequest('EXPENSES_COUNTERPARTY_DUPLICATE', { name: twin.name });
  }

  private async mustFind(coopname: string, id: number): Promise<ExpenseCounterpartyRecord> {
    const row = await this.store.findOne({ id, coopname });
    if (!row) throw DomainError.notFound('EXPENSES_COUNTERPARTY_NOT_FOUND');
    return row;
  }

  /** Читать вправе совет и операторы участков; возвращает участки того, кто спрашивает. */
  private async assertCanRead(coopname: string, viewer: IMonoAccount): Promise<string[]> {
    if (this.branchOperators.isCouncil(viewer)) return [];
    const own = await this.branchOperators.operatedBranches(coopname, viewer.username);
    if (!own.length) throw DomainError.forbidden('EXPENSES_COUNTERPARTY_READ_FORBIDDEN');
    return own;
  }

  /** Контрагента кооператива ведёт совет; контрагента участка — совет и операторы участка. */
  private async assertCanManageScope(coopname: string, viewer: IMonoAccount, braname: string | null): Promise<void> {
    if (this.branchOperators.isCouncil(viewer)) {
      if (braname && !(await this.branchOperators.findBranch(coopname, braname))) {
        throw DomainError.notFound('EXPENSES_BRANCH_NOT_FOUND');
      }
      return;
    }
    if (!braname) throw DomainError.forbidden('EXPENSES_COUNTERPARTY_MANAGE_FORBIDDEN');
    const branch = await this.branchOperators.findBranch(coopname, braname);
    if (!branch) throw DomainError.notFound('EXPENSES_BRANCH_NOT_FOUND');
    if (!this.branchOperators.isOperatorOf(branch, viewer.username)) {
      throw DomainError.forbidden('EXPENSES_COUNTERPARTY_MANAGE_FORBIDDEN');
    }
  }

  private canManage(viewer: IMonoAccount, own: string[], row: ExpenseCounterpartyRecord): boolean {
    if (this.branchOperators.isCouncil(viewer)) return true;
    return !!row.braname && own.includes(row.braname);
  }

  private toView(row: ExpenseCounterpartyRecord, profile: CounterpartyRequisitesProfile, canManage: boolean): ExpenseCounterpartyView {
    const kind = row.kind as ExpenseCounterpartyKind;
    return {
      id: row.id,
      braname: row.braname ?? null,
      kind,
      name: row.name,
      tax_id: row.tax_id,
      requisites: counterpartyFieldsFor(profile, kind)
        .filter((f) => row.requisites?.[f.key])
        .map((f) => ({ key: f.key, label: f.label, value: row.requisites[f.key] })),
      requisites_text: formatCounterpartyRequisites(profile, kind, row.requisites ?? {}),
      payment_purpose: row.payment_purpose ?? null,
      archived: !!row.archived,
      creator: row.creator,
      created_at: row.created_at,
      can_manage: canManage,
    };
  }
}

/** Знаки шаблона LIKE в поисковой строке — буквально. */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}
