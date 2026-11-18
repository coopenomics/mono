import { Inject, Injectable, Optional } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Cron } from '@nestjs/schedule';
import { BranchContract } from 'cooptypes';
import { Workflows } from '@coopenomics/notifications';
import {
  ACCOUNT_PORT,
  BRANCH_PORT,
  CHAIN_CHANGES_PORT,
  CHAIRMAN_APPROVALS_PORT,
  DOCUMENT_PORT,
  LOGGER_PORT,
  NOTIFICATION_PORT,
  type IAccountPort,
  type IBranchPort,
  type IChainChangesPort,
  type IChairmanApprovalsPort,
  type IDocumentPort,
  type ISignedDocument,
  type ILoggerPort,
  type INotificationPort,
  type InnerChainActionRecord,
  type InnerLapsedAuthority,
  type InnerPowerOfAttorneyType,
  type IPowersOfAttorneyPort,
} from '@coopenomics/innercoop';
import { DocumentAggregateDTO, DomainError, platformSettings, type PaginationInputDTO, type PaginationResult } from '@coopenomics/extension-kit';
import { KuPowerOfAttorneyDTO, KuTrusteeDocumentsDTO, type KuPowerOfAttorneyFilterInputDTO } from '../dto/ku-power-of-attorney.dto';
import {
  KuPowerOfAttorneyStatus,
  KuPowerOfAttorneyType,
  KuTrusteeLiabilityStatus,
} from '../../domain/enums/ku-power-of-attorney.enum';
import {
  POWER_OF_ATTORNEY_TYPES,
  daysLeft,
  isoFromRuDate,
  powerOfAttorneyStatus,
  renewalDue,
  ruDate,
  todayIso,
  validUntilIso,
  type PowerOfAttorneyRow,
} from '../../domain/powers-of-attorney/power-of-attorney';
import {
  KuPowerOfAttorneyKyselyRepository,
  type PowerOfAttorneyListFilter,
} from '../../infrastructure/repositories/ku-power-of-attorney.kysely-repository';

const BRANCH = BranchContract.contractName.production;

/** Подписанный документ в данных действия цепи: мета записана строкой JSON. */
interface ChainDocument {
  hash?: string;
  meta?: string | Record<string, unknown>;
  signatures?: unknown[];
}

/** Мета документа из данных действия; битая мета — пустой объект. */
function metaOf(document: ChainDocument | undefined): Record<string, unknown> {
  const meta = document?.meta;
  if (!meta) return {};
  if (typeof meta !== 'string') return meta;
  try {
    return JSON.parse(meta) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/** Реквизиты протокола совета об учреждении участка — номер и дата решения. */
export interface EstablishmentProtocol {
  branch_name: string;
  branch_address: string;
  protocol_number: string;
  protocol_date: string;
}

/** Реквизиты доверенности председателю участка (329), которые вписывает узел. */
export interface TrusteeAuthorityRequisites extends EstablishmentProtocol {
  braname: string;
  poa_number: string;
  valid_until: string;
}

/** Реквизиты доверенности доверенному лицу (330), которые вписывает узел. */
export interface TrustedAuthorityRequisites {
  braname: string;
  poa_number: string;
  protocol_number: string;
  protocol_date: string;
  trustee_poa_number: string;
  trustee_poa_date: string;
  valid_until: string;
}

/** Состояние договора о материальной ответственности председателя участка. */
export type TrusteeLiabilityStatus = 'none' | 'pending' | 'approved' | 'declined';

/**
 * Доверенности кооператива (решение владельца 18.11.2026).
 *
 * Цепь хранит подписи: доверенное лицо подписывает доверенность (signauth —
 * председатель участка, reqtrusted — доверенное лицо), встречно подписывает
 * председатель совета (apprauth) или председатель участка (apprtrusted).
 * Узел по этим событиям ведёт учёт: сквозной номер, основание, срок,
 * состояние. Номер, протокол и срок узел вписывает в документ при генерации.
 *
 * Истёкшая доверенность закрывает пайщику работу по ней на узле (порт
 * `POWERS_OF_ATTORNEY_PORT`); контракт по сроку ничего не блокирует. За
 * тридцать дней до конца срока узел напоминает о продлении.
 */
@Injectable()
export class KuPowersOfAttorneyService implements IPowersOfAttorneyPort {
  constructor(
    private readonly repository: KuPowerOfAttorneyKyselyRepository,
    @Inject(BRANCH_PORT) private readonly branchPort: IBranchPort,
    @Inject(ACCOUNT_PORT) private readonly accountPort: IAccountPort,
    @Inject(NOTIFICATION_PORT) private readonly notificationPort: INotificationPort,
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort,
    @Inject(DOCUMENT_PORT) private readonly documentPort: IDocumentPort,
    @Optional() @Inject(CHAIRMAN_APPROVALS_PORT) private readonly approvals?: IChairmanApprovalsPort,
    @Optional() @Inject(CHAIN_CHANGES_PORT) chainChanges?: IChainChangesPort
  ) {
    this.logger.setContext(KuPowersOfAttorneyService.name);
    // Страница «Мой участок» и реестр доверенностей обновляются по записи в учёт.
    chainChanges?.declareLocalTables([{ code: 'trustee', table: 'ku_powers_of_attorney' }]);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Реквизиты документов
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Протокол совета об учреждении участка. Без решения совета доверенность
   * не выдаётся: ей не на что сослаться.
   */
  async establishmentProtocol(coopname: string, braname: string): Promise<EstablishmentProtocol> {
    const establishment = await this.repository.findEstablishment(coopname, braname);
    const meta = metaOf(establishment?.authorization as ChainDocument | undefined);
    const number = meta.decision_id != null ? String(meta.decision_id) : '';
    const dateIso = isoFromRuDate(meta.created_at);
    if (!establishment || !number || !dateIso) {
      throw DomainError.badRequest('KU_ESTABLISHMENT_PROTOCOL_NOT_FOUND');
    }
    return {
      branch_name: establishment.branch_name,
      branch_address: establishment.address,
      protocol_number: number,
      protocol_date: ruDate(dateIso),
    };
  }

  /** Реквизиты доверенности председателю участка: подписывает только сам председатель. */
  async trusteeAuthorityRequisites(coopname: string, braname: string, username: string): Promise<TrusteeAuthorityRequisites> {
    await this.assertTrustee(coopname, braname, username);
    const protocol = await this.establishmentProtocol(coopname, braname);
    const spec = POWER_OF_ATTORNEY_TYPES.branch_trustee;
    return {
      ...protocol,
      braname,
      poa_number: String(await this.repository.nextNumber(coopname)),
      valid_until: ruDate(validUntilIso(todayIso(), spec.term_months)),
    };
  }

  /**
   * Реквизиты доверенности доверенному лицу: основание — протокол совета об
   * учреждении участка и действующая доверенность его председателя.
   */
  async trustedAuthorityRequisites(coopname: string, braname: string): Promise<TrustedAuthorityRequisites> {
    const branch = await this.branchPort.getBranch(coopname, braname);
    if (!branch) throw DomainError.notFound('KU_BRANCH_NOT_FOUND');
    const protocol = await this.establishmentProtocol(coopname, braname);
    const trusteeAuthority = (await this.repository.findForHolder(coopname, braname, branch.trustee, 'branch_trustee')).find(
      (row) => row.status === 'active' && row.valid_until >= todayIso()
    );
    if (!trusteeAuthority) throw DomainError.badRequest('KU_TRUSTEE_AUTHORITY_NOT_ACTIVE');
    const spec = POWER_OF_ATTORNEY_TYPES.branch_trusted;
    return {
      braname,
      poa_number: String(await this.repository.nextNumber(coopname)),
      protocol_number: protocol.protocol_number,
      protocol_date: protocol.protocol_date,
      trustee_poa_number: String(trusteeAuthority.number),
      trustee_poa_date: ruDate(trusteeAuthority.issued_at),
      valid_until: ruDate(validUntilIso(todayIso(), spec.term_months)),
    };
  }

  async assertTrustee(coopname: string, braname: string, username: string): Promise<void> {
    const branch = await this.branchPort.getBranch(coopname, braname);
    if (!branch) throw DomainError.notFound('KU_BRANCH_NOT_FOUND');
    if (branch.trustee !== username) throw DomainError.forbidden('KU_ACTION_BRANCH_CHAIRMAN_ONLY');
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Чтение
  // ───────────────────────────────────────────────────────────────────────────

  list(filter: PowerOfAttorneyListFilter, limit: number, offset: number) {
    return this.repository.list(filter, limit, offset);
  }

  /** Доверенности председателя по участку — новые первыми. */
  trusteeAuthorities(coopname: string, braname: string, username: string): Promise<PowerOfAttorneyRow[]> {
    return this.repository.findForHolder(coopname, braname, username, 'branch_trustee');
  }

  /**
   * Состояние договора о материальной ответственности председателя участка —
   * по последнему одобрению председателя совета. Без расширения председателя
   * состояние неизвестно и считается «не подписан».
   */
  async trusteeLiabilityStatus(coopname: string, username: string): Promise<TrusteeLiabilityStatus> {
    if (!this.approvals) return 'none';
    const found = await this.approvals.list({ coopname, actions: ['apprliab'], usernames: [username] });
    if (!found.length) return 'none';
    const latest = [...found].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
    // Одобренный договор бессрочный: прежнее одобрение действует, пока новое на подписи.
    if (found.some((a) => a.status === 'approved')) return 'approved';
    return latest.status;
  }

  /** Реестр доверенностей для вкладки «Доверенности» реестра документов. */
  async listDTO(filter: KuPowerOfAttorneyFilterInputDTO, options?: PaginationInputDTO): Promise<PaginationResult<KuPowerOfAttorneyDTO>> {
    const limit = Math.max(1, Math.min(options?.limit ?? 50, 200));
    const page = Math.max(1, options?.page ?? 1);
    const { rows, total } = await this.repository.list(filter, limit, (page - 1) * limit);
    const items = await Promise.all(rows.map((row) => this.toDTO(row)));
    return { items, totalCount: total, totalPages: Math.ceil(total / limit), currentPage: page };
  }

  /**
   * Документы председателя участка для страницы «Мой участок»: последняя
   * доверенность, действующая (пока новая на подписи), договор, можно ли
   * подписать доверенность.
   */
  async trusteeDocuments(coopname: string, braname: string, username: string): Promise<KuTrusteeDocumentsDTO> {
    await this.assertTrustee(coopname, braname, username);
    const today = todayIso();
    const rows = await this.repository.findForHolder(coopname, braname, username, 'branch_trustee');
    const latest = rows[0] ?? null;
    const active = rows.find((row) => powerOfAttorneyStatus(row, today) === 'active') ?? null;
    const hasProtocol = await this.establishmentProtocol(coopname, braname).then(
      () => true,
      () => false
    );
    // Подписать можно, когда новой на подписи нет и действующая не закрывает год вперёд.
    const pendingExists = latest?.status === 'pending';
    const canSign = hasProtocol && !pendingExists && (!active || renewalDue(active, today));
    return {
      braname,
      authority: latest ? await this.toDTO(latest) : null,
      active_authority: active && active !== latest ? await this.toDTO(active) : null,
      can_sign_authority: canSign,
      liability_status: (await this.trusteeLiabilityStatus(coopname, username)) as KuTrusteeLiabilityStatus,
      has_protocol: hasProtocol,
    };
  }

  private async toDTO(row: PowerOfAttorneyRow): Promise<KuPowerOfAttorneyDTO> {
    const signed = (row.countersigned ?? row.document) as unknown as ISignedDocument;
    const aggregate = await this.documentPort.buildAggregate(signed).catch(() => null);
    return {
      number: row.number,
      type: row.type as KuPowerOfAttorneyType,
      holder: row.holder,
      holder_name: await this.accountPort.getDisplayName(row.holder).catch(() => row.holder),
      braname: row.braname,
      protocol_number: row.protocol_number,
      protocol_date: row.protocol_date,
      issued_at: row.issued_at,
      valid_until: row.valid_until,
      status: powerOfAttorneyStatus(row) as KuPowerOfAttorneyStatus,
      renewal_due: renewalDue(row),
      signed_at: row.signed_at,
      resolved_at: row.resolved_at,
      document: aggregate ? new DocumentAggregateDTO(aggregate) : null,
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Порт для других расширений
  // ───────────────────────────────────────────────────────────────────────────

  async listLapsedAuthorities(coopname: string): Promise<InnerLapsedAuthority[]> {
    const today = todayIso();
    const latest = await this.repository.latestActive(coopname);
    return latest
      .filter((row) => row.valid_until < today)
      .map((row) => ({ braname: row.braname, username: row.holder, type: row.type, valid_until: row.valid_until }));
  }

  // ───────────────────────────────────────────────────────────────────────────
  // События цепи
  // ───────────────────────────────────────────────────────────────────────────

  @OnEvent(`action::${BRANCH}::signauth`)
  async onTrusteeAuthoritySigned(record: InnerChainActionRecord): Promise<void> {
    const data = record.data as { coopname: string; braname: string; username: string; authority: ChainDocument };
    await this.register(record, 'branch_trustee', data.braname, data.username, data.authority, null);
  }

  @OnEvent(`action::${BRANCH}::reqtrusted`)
  async onTrustedAuthoritySigned(record: InnerChainActionRecord): Promise<void> {
    const data = record.data as { coopname: string; braname: string; username: string; hash: string; authority: ChainDocument };
    await this.register(record, 'branch_trusted', data.braname, data.username, data.authority, data.hash);
  }

  @OnEvent(`action::${BRANCH}::apprauth`)
  async onTrusteeAuthorityApproved(record: InnerChainActionRecord): Promise<void> {
    const data = record.data as { coopname: string; approval_hash: string; approved_document?: object };
    await this.resolve(record, () =>
      this.repository.resolveByDocument(data.approval_hash, 'active', data.approved_document ?? null, this.at(record))
    );
  }

  @OnEvent(`action::${BRANCH}::declauth`)
  async onTrusteeAuthorityDeclined(record: InnerChainActionRecord): Promise<void> {
    const data = record.data as { coopname: string; approval_hash: string };
    await this.resolve(record, () => this.repository.resolveByDocument(data.approval_hash, 'declined', null, this.at(record)));
  }

  @OnEvent(`action::${BRANCH}::apprtrusted`)
  async onTrustedAuthorityApproved(record: InnerChainActionRecord): Promise<void> {
    const data = record.data as { coopname: string; hash: string; countersigned_authority?: object };
    await this.resolve(record, () =>
      this.repository.resolveBySource(data.hash, 'active', data.countersigned_authority ?? null, this.at(record))
    );
  }

  @OnEvent(`action::${BRANCH}::decltrusted`)
  async onTrustedAuthorityDeclined(record: InnerChainActionRecord): Promise<void> {
    const data = record.data as { coopname: string; hash: string };
    await this.resolve(record, () => this.repository.resolveBySource(data.hash, 'declined', null, this.at(record)));
  }

  /** Время блока действия; без него — время разбора. */
  private at(record: InnerChainActionRecord): Date {
    return record.block_time ? new Date(record.block_time) : new Date();
  }

  /**
   * Записывает доверенность по событию подписи. Номер, протокол и срок —
   * из меты документа: их вписал узел при генерации. Дата выдачи — день блока.
   */
  private async register(
    record: InnerChainActionRecord,
    type: InnerPowerOfAttorneyType,
    braname: string,
    holder: string,
    document: ChainDocument,
    sourceHash: string | null
  ): Promise<void> {
    try {
      const coopname = String(record.data.coopname);
      if (coopname !== platformSettings().coopname || !document?.hash) return;
      const meta = metaOf(document);
      const signedAt = this.at(record);
      const issuedAt = todayIso(signedAt);
      const spec = POWER_OF_ATTORNEY_TYPES[type];
      const number = Number(meta.poa_number) || (await this.repository.nextNumber(coopname));
      await this.repository.insertPending({
        coopname,
        number,
        type,
        registry_id: spec.registry_id,
        braname,
        holder,
        document_hash: document.hash,
        source_hash: sourceHash,
        document,
        protocol_number: String(meta.protocol_number ?? ''),
        protocol_date: String(meta.protocol_date ?? ''),
        issued_at: issuedAt,
        valid_until: isoFromRuDate(meta.valid_until) ?? validUntilIso(issuedAt, spec.term_months),
        signed_at: signedAt,
      });
      this.logger.log(`доверенность № ${number} (${type}) ${holder} по участку ${braname} — на встречной подписи`);
    } catch (error: any) {
      this.logger.error(`Ошибка учёта доверенности ${record.name}: ${error.message}`, error.stack);
    }
  }

  private async resolve(record: InnerChainActionRecord, apply: () => Promise<number>): Promise<void> {
    try {
      if (String(record.data.coopname) !== platformSettings().coopname) return;
      await apply();
    } catch (error: any) {
      this.logger.error(`Ошибка учёта доверенности ${record.name}: ${error.message}`, error.stack);
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Напоминание о продлении
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Раз в день: доверенности, у которых до конца срока не больше тридцати
   * дней (либо срок уже истёк), а новая ещё не подписана. Держателю —
   * одно напоминание на доверенность.
   */
  @Cron('0 0 9 * * *', { timeZone: 'Europe/Moscow' })
  async remindRenewals(): Promise<void> {
    try {
      const coopname = platformSettings().coopname;
      const today = todayIso();
      for (const row of await this.repository.latestActive(coopname)) {
        if (row.renewal_notified_at || !renewalDue(row, today)) continue;
        if (await this.repository.hasPendingNewer(row)) continue;
        await this.notifyRenewal(row, today);
        await this.repository.markRenewalNotified(row.id, new Date());
      }
    } catch (error: any) {
      this.logger.error(`Ошибка напоминания о продлении доверенностей: ${error.message}`, error.stack);
    }
  }

  private async notifyRenewal(row: PowerOfAttorneyRow, today: string): Promise<void> {
    const account = await this.accountPort.getAccount(row.holder);
    const subscriberId = account.provider_account?.subscriber_id?.trim();
    const email = account.provider_account?.email;
    if (!subscriberId || !email) return;
    const establishment = await this.repository.findEstablishment(row.coopname, row.braname);
    const payload: Workflows.BranchAuthorityExpiring.IPayload = {
      trusteeName: await this.accountPort.getDisplayName(row.holder).catch(() => row.holder),
      branchName: establishment?.branch_name || row.braname,
      poaNumber: String(row.number),
      daysLeft: String(Math.max(daysLeft(row.valid_until, today), 0)),
      validUntil: ruDate(row.valid_until),
      branchUrl: `${platformSettings().frontendUrl}/${row.coopname}/ku/my-branch`,
    };
    await this.notificationPort.notify({
      coopname: row.coopname,
      workflowId: Workflows.BranchAuthorityExpiring.id,
      to: { subscriberId, email, username: row.holder },
      payload,
    });
    this.logger.log(`напоминание о продлении доверенности № ${row.number} отправлено ${row.holder}`);
  }
}
