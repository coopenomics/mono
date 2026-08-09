import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { createHash } from 'crypto';
import { Cooperative, MarketContract } from 'cooptypes';
import { PublicKey, Signature } from '@wharfkit/antelope';
import http from 'http-status';
import { HttpApiError } from '~/utils/httpApiError';
import { LOGGER_PORT, type ILoggerPort } from '@coopenomics/innercoop';
import { DocumentDomainService } from '~/domain/document/services/document-domain.service';
import type { PaginationInputDTO } from '@coopenomics/extension-kit';
import type { ISignedDocumentDomainInterface } from '@coopenomics/innercoop';
import type { DocumentDomainAggregate } from '~/domain/document/aggregates/document-domain.aggregate';
import { SignedDigitalDocumentInputDTO } from '~/application/document/dto/signed-digital-document-input.dto';
import { AmountFormatterUtils } from '~/shared/utils/amount-formatter.utils';
import {
  MARKETPLACE_WRITEOFF_PROPOSAL_REPOSITORY,
  type MarketplaceWriteoffProposalDomainRepository,
} from '../../domain/repositories/marketplace-writeoff-proposal.repository';
import {
  MARKETPLACE_INVENTORY_REPOSITORY,
  type MarketplaceInventoryDomainRepository,
} from '../../domain/repositories/marketplace-inventory.repository';
import { MarketplaceInventoryOwnerships } from '../../domain/entities/marketplace-inventory.types';
import {
  MARKETPLACE_ORDER_REPOSITORY,
  type MarketplaceOrderDomainRepository,
} from '../../domain/repositories/marketplace-order.repository';
import {
  MARKETPLACE_OFFER_REPOSITORY,
  type MarketplaceOfferDomainRepository,
} from '../../domain/repositories/marketplace-offer.repository';
import { marketplaceOrderUnitLabel } from '../shared/unit-label.util';
import type { MarketplaceUnitOfMeasure } from '../../domain/entities/marketplace-offer.types';
import { MarketplaceOrderDisplayService } from './marketplace-order-display.service';
import {
  MARKETPLACE_CANONICAL_BLOCKCHAIN_PORT,
  type MarketplaceCanonicalBlockchainPort,
} from '../../domain/ports/marketplace-canonical-blockchain.port';
import {
  MARKETPLACE_ASSET_CONFIG,
  type MarketplaceAssetConfig,
} from './marketplace-asset.config';
import { MarketplaceWriteoffProposalDomainEntity } from '../../domain/entities/marketplace-writeoff-proposal.entity';
import {
  MarketplaceWriteoffProposalStatuses,
  type MarketplaceWriteoffProposalItem,
  type MarketplaceWriteoffProposalStatus,
  type MarketplaceWriteoffProposalTrigger,
} from '../../domain/entities/marketplace-writeoff-proposal.types';
import {
  MARKETPLACE_WRITEOFF_PROPOSED_EVENT,
  MARKETPLACE_WRITEOFF_DRAFT_BUILT_EVENT,
  MARKETPLACE_WRITEOFF_AUTHORIZED_EVENT,
  MARKETPLACE_WRITEOFF_EXECUTED_EVENT,
  MARKETPLACE_WRITEOFF_REJECTED_EVENT,
} from '../events/marketplace-notification.events';

export interface MarketplaceWriteoffItemInput {
  braname: string;
  asset_title: string;
  quantity: string;
  amount: string;
  reason: string;
  inventory_ids?: string[];
}

export interface MarketplaceCreateWriteoffDraftInput {
  coopname: string;
  trigger: MarketplaceWriteoffProposalTrigger;
  proposed_by_account: string | null;
  cycle_started_at?: Date;
  items: MarketplaceWriteoffItemInput[];
}

export interface MarketplaceUpdateWriteoffDraftInput {
  id: string;
  actor: string;
  items: MarketplaceWriteoffItemInput[];
}

export interface MarketplaceSubmitWriteoffDraftInput {
  id: string;
  chairman_account: string;
  signed_statement: SignedDigitalDocumentInputDTO;
}

export interface MarketplaceListWriteoffProposalsInput {
  coopname: string;
  statuses?: MarketplaceWriteoffProposalStatus[];
  pagination?: PaginationInputDTO;
}

export interface MarketplaceConfirmWriteoffInput {
  id: string;
  braname: string;
  chairman_account: string;
  signed_memo: SignedDigitalDocumentInputDTO;
}

export interface MarketplaceWriteoffCandidateView {
  /** Стабильный ключ строки = КУ|наименование|состояние (для row-key и выбора). */
  key: string;
  /** Все партии (штрих-коды), слитые в этот агрегат. */
  inventory_ids: string[];
  braname: string;
  branch_name: string;
  asset_title: string;
  unit_of_measure: MarketplaceUnitOfMeasure | null;
  package_size: number | null;
  /** Суммарное количество по всем партиям агрегата. */
  quantity: string;
  /** Суммарная стоимость по всем партиям агрегата. */
  amount: string;
  /** Ближайший (самый срочный) срок годности среди партий агрегата. */
  expiry_date: string | null;
  is_expired: boolean;
  /** Сколько партий слито в строку — для подсказки «N партий» в интерфейсе. */
  lots_count: number;
}

export interface MarketplaceWriteoffConfirmationGroup {
  proposal_id: string;
  proposal_hash: string;
  braname: string;
  branch_name: string;
  cycle_started_at: string;
  authorized_at: string | null;
  protocol_doc: unknown;
  items: Array<
    MarketplaceWriteoffProposalItem & { unit_of_measure: MarketplaceUnitOfMeasure | null; package_size: number | null }
  >;
  total_amount: string;
}

export interface MarketplaceWriteoffServiceMemoData {
  proposal: MarketplaceWriteoffProposalDomainEntity;
  braname: string;
  branch_name: string;
  cycle_started_at: string;
  proposal_hash: string;
  items: { asset_title: string; quantity: string; unit: string; amount: string; reason: string }[];
  total_amount: string;
}

@Injectable()
export class MarketplaceWriteoffService {
  constructor(
    @Inject(MARKETPLACE_WRITEOFF_PROPOSAL_REPOSITORY)
    private readonly repo: MarketplaceWriteoffProposalDomainRepository,
    @Inject(MARKETPLACE_INVENTORY_REPOSITORY)
    private readonly inventoryRepo: MarketplaceInventoryDomainRepository,
    @Inject(MARKETPLACE_ORDER_REPOSITORY)
    private readonly orderRepo: MarketplaceOrderDomainRepository,
    @Inject(MARKETPLACE_OFFER_REPOSITORY)
    private readonly offerRepo: MarketplaceOfferDomainRepository,
    @Inject(MARKETPLACE_CANONICAL_BLOCKCHAIN_PORT)
    private readonly chainPort: MarketplaceCanonicalBlockchainPort,
    @Inject(MARKETPLACE_ASSET_CONFIG)
    private readonly assetConfig: MarketplaceAssetConfig,
    private readonly documentDomainService: DocumentDomainService,
    private readonly orderDisplay: MarketplaceOrderDisplayService,
    private readonly eventBus: EventEmitter2,
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort
  ) {
    this.logger.setContext(MarketplaceWriteoffService.name);
  }

  private get assetSymbol(): string {
    return this.assetConfig.symbol;
  }

  private get assetDecimals(): number {
    return this.assetConfig.decimals;
  }

  // ── Чтение ─────────────────────────────────────────────────────────

  async listProposals(input: MarketplaceListWriteoffProposalsInput) {
    return this.repo.list(
      { coopname: input.coopname, statuses: input.statuses },
      input.pagination
    );
  }

  async getProposal(id: string): Promise<MarketplaceWriteoffProposalDomainEntity> {
    const p = await this.repo.findById(id);
    if (!p) throw new NotFoundException('Проект списания не найден');
    return p;
  }

  async getOpenDraft(coopname: string): Promise<MarketplaceWriteoffProposalDomainEntity | null> {
    return this.repo.findOpenDraft(coopname);
  }

  /**
   * Резолвит человеко-читаемые имена кооперативных участков по их braname —
   * для показа в интерфейсе вместо служебного идентификатора. Кэш на один
   * вызов: позиций по одному складу обычно много.
   */
  async resolveBranchNames(branames: string[]): Promise<Record<string, string>> {
    const map: Record<string, string> = {};
    for (const bn of new Set(branames)) {
      const branch = await this.orderDisplay.resolveBranchDisplay(bn);
      map[bn] = branch.name || bn;
    }
    return map;
  }

  /**
   * Человекочитаемая единица измерения (шт./кг/л/упак.) для каждой позиции
   * проекта — по её партиям. Единица живёт на оффере (снапшот товара); партии
   * одного наименования агрегированы в одну позицию, поэтому берём единицу по
   * первой партии: inventory → оффер (через published_offer_id либо заказ,
   * который сослался на оффер). Фолбэк «ед.» — если товар/оффер уже удалён.
   */
  async resolveUnitLabels(items: { inventory_ids: string[] }[]): Promise<string[]> {
    return Promise.all(items.map((it) => this.resolveUnitLabel(it.inventory_ids)));
  }

  private async resolveUnitLabel(inventoryIds: string[]): Promise<string> {
    const FALLBACK = 'ед.';
    const invId = inventoryIds[0];
    if (!invId) return FALLBACK;
    const inv = await this.inventoryRepo.findById(invId);
    if (!inv) return FALLBACK;
    let offerId = inv.published_offer_id;
    if (!offerId && inv.order_id) {
      const order = await this.orderRepo.findById(inv.order_id);
      offerId = order?.offer_id ?? null;
    }
    if (!offerId) return FALLBACK;
    const offer = await this.offerRepo.findById(offerId);
    if (!offer) return FALLBACK;
    return marketplaceOrderUnitLabel(offer.unit_of_measure);
  }

  /**
   * Базовая единица измерения + содержимое упаковки (Эпик 18) для строк
   * списания/кандидатов — по первой партии каждой строки: inventory → offer
   * (published_offer_id либо через заказ) для unit_of_measure, заказ →
   * package_size (упаковка — атрибут заказа, не оффера). Ключ карты — id
   * первой партии строки; дедуп по нему экономит запросы при повторных
   * позициях одного склада/заказа.
   */
  async resolveItemDisplayMap(
    items: { inventory_ids: string[] }[]
  ): Promise<Map<string, { unit_of_measure: MarketplaceUnitOfMeasure | null; package_size: number | null }>> {
    const map = new Map<string, { unit_of_measure: MarketplaceUnitOfMeasure | null; package_size: number | null }>();
    const invIds = [...new Set(items.map((it) => it.inventory_ids[0]).filter((id): id is string => Boolean(id)))];
    await Promise.all(
      invIds.map(async (invId) => {
        map.set(invId, await this.resolveItemDisplay(invId));
      })
    );
    return map;
  }

  private async resolveItemDisplay(
    invId: string
  ): Promise<{ unit_of_measure: MarketplaceUnitOfMeasure | null; package_size: number | null }> {
    const EMPTY = { unit_of_measure: null, package_size: null };
    const inv = await this.inventoryRepo.findById(invId);
    if (!inv) return EMPTY;
    let offerId = inv.published_offer_id;
    let package_size: number | null = null;
    if (inv.order_id) {
      const order = await this.orderRepo.findById(inv.order_id);
      if (order) {
        offerId = offerId ?? order.offer_id;
        package_size = order.package_size || null;
      }
    }
    if (!offerId) return { unit_of_measure: null, package_size };
    const offer = await this.offerRepo.findById(offerId);
    return { unit_of_measure: offer?.unit_of_measure ?? null, package_size };
  }

  /**
   * Кандидаты на списание для admin-стола: все позиции на складах кооператива.
   * Председатель выделяет нужные и создаёт из них черновик — вручную можно
   * списать как просроченный скоропорт (флаг is_expired), так и ещё годное
   * имущество (порча, невозврат). Сумма = arrival_price × quantity.
   */
  async listCandidates(coopname: string): Promise<MarketplaceWriteoffCandidateView[]> {
    const candidates = await this.inventoryRepo.findWriteoffCandidates(coopname, new Date());
    // Партии, уже занятые в незавершённых проектах списания, исключаем —
    // иначе один и тот же товар попадёт в два проекта (двойное списание).
    const lockedIds = new Set(await this.repo.findActiveLockedInventoryIds(coopname));
    // Имя КУ показываем человеку, не служебный braname — резолвим с кэшем,
    // позиций по одному складу обычно много.
    const branchNameCache = new Map<string, string>();

    // Несколько партий одного наименования на одном КУ в одном состоянии
    // визуально неразличимы (та же дата «годен до», тот же КУ) — пайщик видит
    // «прыгающее количество». Сливаем их в одну строку-агрегат: суммарное
    // кол-во + сумма, под капотом — список всех партий. Ключ группировки
    // включает состояние (просрочено / без гарантии / годно) — у них разный
    // визуальный статус. Причину кандидат не несёт: председатель указывает её
    // явно при отправке (одна причина на всю подборку), backend её не угадывает.
    const groups = new Map<
      string,
      {
        key: string;
        inventory_ids: string[];
        braname: string;
        asset_title: string;
        quantity: number;
        amount: number;
        expiry_ms: number | null;
        is_expired: boolean;
        state: string;
      }
    >();

    for (const c of candidates) {
      if (lockedIds.has(c.inventory_id)) continue;
      // Состояние партии: просрочена / без срока (без гарантии) / ещё годна.
      const state = c.is_expired ? 'expired' : c.expiry_date === null ? 'nowarranty' : 'valid';
      const key = `${c.braname}|${c.asset_title}|${state}`;
      const unit = c.arrival_price !== null ? Number(c.arrival_price) : 0;
      const amount = Number.isFinite(unit) ? unit * c.quantity : 0;
      const expiryMs = c.expiry_date ? c.expiry_date.getTime() : null;

      const existing = groups.get(key);
      if (existing) {
        existing.inventory_ids.push(c.inventory_id);
        existing.quantity += c.quantity;
        existing.amount += amount;
        // Ближайший (самый срочный) срок годности — представитель агрегата.
        if (expiryMs !== null && (existing.expiry_ms === null || expiryMs < existing.expiry_ms)) {
          existing.expiry_ms = expiryMs;
        }
      } else {
        groups.set(key, {
          key,
          inventory_ids: [c.inventory_id],
          braname: c.braname,
          asset_title: c.asset_title,
          quantity: c.quantity,
          amount,
          expiry_ms: expiryMs,
          is_expired: c.is_expired,
          state,
        });
      }
    }

    const result: MarketplaceWriteoffCandidateView[] = [];
    for (const g of groups.values()) {
      let branchName = branchNameCache.get(g.braname);
      if (branchName === undefined) {
        const branch = await this.orderDisplay.resolveBranchDisplay(g.braname);
        branchName = branch.name || g.braname;
        branchNameCache.set(g.braname, branchName);
      }
      result.push({
        key: g.key,
        inventory_ids: g.inventory_ids,
        braname: g.braname,
        branch_name: branchName,
        asset_title: g.asset_title,
        unit_of_measure: null,
        package_size: null,
        quantity: String(g.quantity),
        amount: this.formatAssetNumber(g.amount),
        expiry_date: g.expiry_ms !== null ? new Date(g.expiry_ms).toISOString() : null,
        is_expired: g.is_expired,
        lots_count: g.inventory_ids.length,
      });
    }
    const display = await this.resolveItemDisplayMap(result);
    for (const r of result) {
      const d = display.get(r.inventory_ids[0] ?? '');
      r.unit_of_measure = d?.unit_of_measure ?? null;
      r.package_size = d?.package_size ?? null;
    }
    // Просроченное — наверх (первоочередные кандидаты), затем остальное.
    result.sort((a, b) => Number(b.is_expired) - Number(a.is_expired));
    return result;
  }

  /**
   * Группы для стола ПВЗ: по каждому проекту в PENDING_CONFIRMATION — отдельная
   * строка на каждый кооперативный участок с неподтверждёнными позициями.
   * `branames=null` (admin/совет read:all) — все участки; иначе только КУ
   * оператора.
   */
  async listPendingConfirmations(
    coopname: string,
    branames: string[] | null
  ): Promise<MarketplaceWriteoffConfirmationGroup[]> {
    const { items } = await this.repo.list({
      coopname,
      statuses: ['PENDING_CONFIRMATION'],
    });
    const display = await this.resolveItemDisplayMap(items.flatMap((p) => p.items));
    const groups: MarketplaceWriteoffConfirmationGroup[] = [];
    const branchNameCache = new Map<string, string>();
    for (const p of items) {
      const pendingBranames = [
        ...new Set(p.items.filter((it) => !it.executed).map((it) => it.braname)),
      ];
      for (const bn of pendingBranames) {
        if (branames && !branames.includes(bn)) continue;
        let name = branchNameCache.get(bn);
        if (name === undefined) {
          const branch = await this.orderDisplay.resolveBranchDisplay(bn);
          name = branch.name || bn;
          branchNameCache.set(bn, name);
        }
        const groupItems = p.items
          .filter((it) => it.braname === bn && !it.executed)
          .map((it) => {
            const d = display.get(it.inventory_ids[0] ?? '');
            return { ...it, unit_of_measure: d?.unit_of_measure ?? null, package_size: d?.package_size ?? null };
          });
        groups.push({
          proposal_id: p.id,
          proposal_hash: p.proposal_hash,
          braname: bn,
          branch_name: name,
          cycle_started_at: p.cycle_started_at.toISOString(),
          authorized_at: p.authorized_at ? p.authorized_at.toISOString() : null,
          protocol_doc: p.protocol_doc,
          items: groupItems,
          total_amount: this.formatAssetNumber(this.sumItems(groupItems)),
        });
      }
    }
    return groups;
  }

  /**
   * Данные для рендера Служебной записки о списании (1111) по одному КУ
   * проекта, ожидающего подтверждения. Резолвер собирает из них документ для
   * подписания председателем КУ.
   */
  async getServiceMemoData(id: string, braname: string): Promise<MarketplaceWriteoffServiceMemoData> {
    const proposal = await this.getProposal(id);
    if (!proposal.is_pending_confirmation) {
      throw new BadRequestException(
        'Подтвердить списание можно только по проекту, ожидающему подтверждения складов'
      );
    }
    const items = proposal.items.filter((it) => it.braname === braname && !it.executed);
    if (items.length === 0) {
      throw new BadRequestException(
        `В проекте нет неподтверждённых позиций кооперативного участка ${braname}`
      );
    }
    const branch = await this.orderDisplay.resolveBranchDisplay(braname);
    const total = this.sumItems(items);
    const units = await this.resolveUnitLabels(items);
    return {
      proposal,
      braname,
      branch_name: branch.name || braname,
      cycle_started_at: proposal.cycle_started_at.toISOString(),
      proposal_hash: proposal.proposal_hash,
      items: items.map((it, i) => ({
        asset_title: it.asset_title,
        quantity: it.quantity,
        unit: units[i],
        amount: it.amount,
        reason: it.reason,
      })),
      total_amount: this.formatAssetNumber(total),
    };
  }

  /**
   * Агрегат Протокола совета о списании для просмотра на столе ПВЗ. Протокол
   * уже подписан советом и опубликован в реестр документов — собираем агрегат
   * из подписанного документа (тело по doc_hash + подписи), НЕ регенерируем.
   * `protocol_doc` = signed-документ из callback'а onmktwoauth. Канон —
   * issuance/return-claim. null, если протокола ещё нет (проект не одобрен).
   */
  async getProtocolDocumentAggregate(id: string): Promise<DocumentDomainAggregate | null> {
    const proposal = await this.getProposal(id);
    const signed = proposal.protocol_doc as ISignedDocumentDomainInterface | null;
    if (!signed) return null;
    return this.documentDomainService.buildDocumentAggregate(signed);
  }

  // ── DRAFT pipeline ─────────────────────────────────────────────────

  async createDraft(
    input: MarketplaceCreateWriteoffDraftInput
  ): Promise<MarketplaceWriteoffProposalDomainEntity> {
    const existingDraft = await this.repo.findOpenDraft(input.coopname);
    if (existingDraft) {
      throw new ConflictException(
        `У кооператива уже есть открытый черновик списания (id=${existingDraft.id}). Удалите его перед созданием нового.`
      );
    }
    // Несколько проектов списания одновременно — допустимо: разные партии
    // скоропорта подаются в совет независимо. Защита от двойного списания
    // одной позиции — на уровне кандидатов (findActiveLockedInventoryIds),
    // не запретом второго проекта.

    const normalizedItems = this.validateAndNormalizeItems(input.items);
    const total = this.sumItems(normalizedItems);
    const cycleStartedAt = input.cycle_started_at ?? new Date();

    const created = await this.repo.create({
      coopname: input.coopname,
      trigger: input.trigger,
      cycle_started_at: cycleStartedAt,
      proposed_by_account: input.proposed_by_account,
      items: normalizedItems,
      total_amount: this.formatAsset(total),
    });

    this.eventBus.emit(MARKETPLACE_WRITEOFF_DRAFT_BUILT_EVENT, {
      coopname: input.coopname,
      proposal_id: created.id,
      trigger: input.trigger,
      items_count: normalizedItems.length,
      total_amount: created.total_amount,
    });

    return created;
  }

  async updateDraft(
    input: MarketplaceUpdateWriteoffDraftInput
  ): Promise<MarketplaceWriteoffProposalDomainEntity> {
    const draft = await this.repo.findById(input.id);
    if (!draft) throw new NotFoundException('Проект списания не найден');
    if (!draft.is_draft) {
      throw new BadRequestException('Редактировать можно только проект в статусе DRAFT');
    }
    const normalizedItems = this.validateAndNormalizeItems(input.items);
    const total = this.sumItems(normalizedItems);

    return this.repo.updateDraftItems(input.id, normalizedItems, this.formatAsset(total), {
      at: new Date().toISOString(),
      actor: input.actor,
      action: 'draft_updated',
      payload: { items_count: normalizedItems.length },
    });
  }

  async cancelDraft(id: string): Promise<void> {
    const draft = await this.repo.findById(id);
    if (!draft) throw new NotFoundException('Проект списания не найден');
    if (!draft.is_draft) {
      throw new BadRequestException('Удалить можно только проект в статусе DRAFT');
    }
    await this.repo.cancelDraft(id);
  }

  // ── Submit в совет ─────────────────────────────────────────────────

  async submitToCouncil(
    input: MarketplaceSubmitWriteoffDraftInput
  ): Promise<MarketplaceWriteoffProposalDomainEntity> {
    const draft = await this.repo.findById(input.id);
    if (!draft) throw new NotFoundException('Проект списания не найден');
    if (!draft.is_draft) {
      throw new BadRequestException(
        `Передать в совет можно только проект в статусе DRAFT (текущий: ${draft.status})`
      );
    }
    if (!Array.isArray(draft.items) || draft.items.length === 0) {
      throw new BadRequestException('Черновик пуст — добавьте позиции перед отправкой в совет');
    }

    this.verifyDocumentSignature(input.signed_statement);
    const statementMeta = input.signed_statement.meta as {
      registry_id?: number;
      proposal_hash?: string;
    } | undefined;
    if (
      !statementMeta ||
      statementMeta.registry_id !== Cooperative.Registry.MarketplaceWriteoffStatement.registry_id
    ) {
      throw new BadRequestException(
        `Заявление должно быть зарегистрировано с registry_id=${Cooperative.Registry.MarketplaceWriteoffStatement.registry_id}`
      );
    }

    const proposalHash = this.computeProposalHash({
      coopname: draft.coopname,
      cycle_started_at: draft.cycle_started_at.toISOString(),
      draft_id: draft.id,
      items: draft.items,
    });
    if (statementMeta.proposal_hash && statementMeta.proposal_hash !== proposalHash) {
      throw new BadRequestException(
        'Заявление подписано для другого расчёта позиций — пересоберите Заявление перед отправкой'
      );
    }

    // Pre-gate: защита от двойного клика — если другой проект с тем же hash уже
    // успешно отправлен в совет, повторный submit перезапишет on-chain состояние.
    const alreadySubmitted = await this.repo.findByHash(draft.coopname, proposalHash);
    if (alreadySubmitted && alreadySubmitted.id !== draft.id) {
      throw new ConflictException(
        `Проект с этим расчётом уже отправлен в совет (id=${alreadySubmitted.id}, статус=${alreadySubmitted.status}).`
      );
    }

    // on-chain propwroff: фиксируем wroffprops::proposed И ставит повестку совета
    // одним action'ом — контракт сам делает inline `soviet::createagenda(mktwroff)`
    // от permission_level{marketplace, active} (marketplace в contracts_whitelist).
    // statement + meta форвардятся в createagenda; backend createagenda НЕ зовёт
    // (кооператив не в whitelist, отдельный вызов создал бы дубль повестки).
    const propTx = await this.chainPort.propWroff({
      coopname: draft.coopname,
      proposed_by: input.chairman_account,
      proposal_hash: proposalHash,
      items: draft.items.map((it) => ({
        source_order_id: '0',
        braname: it.braname,
        // it.amount хранится как голое число ("120.0000"); on-chain поле
        // wroff_item.amount — asset, нужен символ ("120.0000 RUB").
        amount: this.formatAsset(Number(it.amount)),
        meta: it.reason,
        executed: false,
      })) as MarketContract.Actions.PropWroff.IPropWroff['items'],
      statement: new SignedDigitalDocumentInputDTO(input.signed_statement).toDocument() as MarketContract.Actions.PropWroff.IPropWroff['statement'],
      meta: JSON.stringify({
        registry_id: Cooperative.Registry.MarketplaceWriteoffStatement.registry_id,
        proposal_hash: proposalHash,
        items_count: draft.items.length,
        total_amount: draft.total_amount,
      }),
    });

    const propTxHash = this.extractTxHash(propTx);
    if (!propTxHash) {
      throw new ConflictException(
        'Подача проекта в совет: цепь не вернула tx_hash (propwroff). Повторите.'
      );
    }

    // 3. PG: DRAFT → ON_AGENDA (decision_id заполнит реактор-наблюдатель за soviet.decisions)
    const submitted = await this.repo.submitToCouncil(draft.id, {
      proposal_hash: proposalHash,
      statement_doc: input.signed_statement,
      decision_id: null,
      submitted_at: new Date(),
      proposed_by_account: input.chairman_account,
      log: {
        at: new Date().toISOString(),
        actor: input.chairman_account,
        action: 'submitted_to_council',
        payload: {
          proposal_hash: proposalHash,
          items_count: draft.items.length,
          propwroff_tx_hash: propTxHash,
        },
      },
    });

    this.eventBus.emit(MARKETPLACE_WRITEOFF_PROPOSED_EVENT, {
      coopname: submitted.coopname,
      proposal_id: submitted.id,
      proposal_hash: proposalHash,
      items_count: submitted.items.length,
      total_amount: submitted.total_amount,
    });

    return submitted;
  }

  // ── Callback-стороны (вызываются из delta-листенера) ────────────────

  async onCouncilAuthorized(input: {
    coopname: string;
    proposal_hash: string;
    authorized_by: string | null;
    protocol_doc: unknown;
  }): Promise<void> {
    const proposal = await this.repo.findByHash(input.coopname, input.proposal_hash);
    if (!proposal) {
      this.logger.warn(
        `[WRITEOFF] получен callback onmktwoauth, но proposal hash=${input.proposal_hash} не найден в PG`
      );
      return;
    }
    if (!proposal.is_on_agenda) {
      this.logger.warn(
        `[WRITEOFF] callback onmktwoauth для proposal ${proposal.id} в статусе ${proposal.status} — пропускаю`
      );
      return;
    }
    // Совет одобрил → проект переходит в PENDING_CONFIRMATION (markAuthorized
    // пишет этот статус). Фактическое списание НЕ запускается автоматически:
    // его инициирует председатель каждого КУ подписью Служебной записки 1111
    // на столе ПВЗ (см. confirmWriteoff → confirmwroff). Per-КУ гранулярность.
    const updated = await this.repo.markAuthorized(proposal.id, {
      protocol_doc: input.protocol_doc,
      authorized_at: new Date(),
      decided_by_account: input.authorized_by,
      log: {
        at: new Date().toISOString(),
        actor: input.authorized_by ?? 'soviet',
        action: 'authorized_by_council',
      },
    });

    this.eventBus.emit(MARKETPLACE_WRITEOFF_AUTHORIZED_EVENT, {
      coopname: updated.coopname,
      proposal_id: updated.id,
      proposal_hash: updated.proposal_hash,
      items_count: updated.items.length,
      total_amount: updated.total_amount,
    });
  }

  async onCouncilDeclined(input: {
    coopname: string;
    proposal_hash: string;
    reason: string;
  }): Promise<void> {
    const proposal = await this.repo.findByHash(input.coopname, input.proposal_hash);
    if (!proposal) {
      this.logger.warn(
        `[WRITEOFF] получен callback onmktwodecl, но proposal hash=${input.proposal_hash} не найден в PG`
      );
      return;
    }
    if (!proposal.is_on_agenda) {
      this.logger.warn(
        `[WRITEOFF] callback onmktwodecl для proposal ${proposal.id} в статусе ${proposal.status} — пропускаю`
      );
      return;
    }
    const updated = await this.repo.markRejected(proposal.id, {
      reject_reason: input.reason,
      rejected_at: new Date(),
      decided_by_account: null,
      log: {
        at: new Date().toISOString(),
        actor: 'soviet',
        action: 'declined_by_council',
        payload: { reason: input.reason },
      },
    });

    this.eventBus.emit(MARKETPLACE_WRITEOFF_REJECTED_EVENT, {
      coopname: updated.coopname,
      proposal_id: updated.id,
      proposal_hash: updated.proposal_hash,
      reason: input.reason,
    });
  }

  // ── Per-item execute loop ──────────────────────────────────────────

  async executeAuthorizedProposal(id: string, signer: string): Promise<void> {
    const proposal = await this.repo.findById(id);
    if (!proposal) throw new NotFoundException('Проект списания не найден');
    if (!proposal.is_authorized && !proposal.is_executing) {
      throw new BadRequestException(
        `Запустить исполнение можно только из AUTHORIZED/EXECUTING (текущий: ${proposal.status})`
      );
    }
    let working = proposal;
    if (working.is_authorized) {
      working = await this.repo.markExecuting(id, {
        at: new Date().toISOString(),
        actor: signer,
        action: 'execution_started',
      });
    }

    for (let i = 0; i < working.items.length; i++) {
      const item = working.items[i];
      if (item.executed) continue;
      let execTxHash: string;
      try {
        const execTx = await this.chainPort.execWroff({
          coopname: working.coopname,
          signer,
          proposal_hash: working.proposal_hash,
          item_index: String(i) as MarketContract.Actions.ExecWroff.IExecWroff['item_index'],
        });
        execTxHash = this.extractTxHash(execTx);
        if (!execTxHash) {
          throw new Error('on-chain execwroff не вернул tx_hash');
        }
      } catch (e) {
        this.logger.error(
          `[WRITEOFF] не удалось исполнить позицию ${i} проекта ${id}: ${(e as Error).message}`
        );
        throw e;
      }
      working = await this.repo.markItemExecuted(id, i, {
        at: new Date().toISOString(),
        actor: signer,
        action: 'item_executed',
        payload: {
          item_index: i,
          braname: item.braname,
          amount: item.amount,
          execwroff_tx_hash: execTxHash,
        },
      });
      // Inventory transition обязателен для каждой партии агрегата — иначе
      // позиция остаётся RETURNED_TO_WAREHOUSE в БД и может повторно попасть в
      // следующий cron-цикл. Если update упадёт — re-throw, чтобы видна была
      // проблема и proposal остался в EXECUTING для retry.
      for (const invId of item.inventory_ids ?? []) {
        await this.releasePublishedStockOnWriteoff(invId);
        await this.inventoryRepo.applyStatusTransition(invId, 'WRITTEN_OFF');
      }
    }

    const finalized = await this.repo.markFullyExecuted(id, {
      at: new Date().toISOString(),
      actor: signer,
      action: 'execution_completed',
    });

    this.eventBus.emit(MARKETPLACE_WRITEOFF_EXECUTED_EVENT, {
      coopname: finalized.coopname,
      proposal_id: finalized.id,
      proposal_hash: finalized.proposal_hash,
      items_count: finalized.items.length,
      total_amount: finalized.total_amount,
    });
  }

  // ── Подтверждение списания председателем КУ (стол ПВЗ) ──────────────

  /**
   * Председатель кооперативного участка подтверждает фактическое списание со
   * склада своего КУ, подписывая Служебную записку 1111. Закрывает все
   * неисполненные позиции этого КУ за один on-chain `confirmwroff`. Когда
   * подтверждены все КУ проекта — проект EXECUTED.
   */
  async confirmWriteoff(
    input: MarketplaceConfirmWriteoffInput
  ): Promise<MarketplaceWriteoffProposalDomainEntity> {
    const proposal = await this.repo.findById(input.id);
    if (!proposal) throw new NotFoundException('Проект списания не найден');
    if (!proposal.is_pending_confirmation) {
      throw new BadRequestException(
        `Подтвердить списание можно только по проекту, ожидающему подтверждения складов (текущий: ${proposal.status})`
      );
    }
    const pendingIndexes = proposal.items
      .map((it, idx) => ({ it, idx }))
      .filter(({ it }) => it.braname === input.braname && !it.executed)
      .map(({ idx }) => idx);
    if (pendingIndexes.length === 0) {
      throw new BadRequestException(
        `В проекте нет неподтверждённых позиций кооперативного участка ${input.braname}`
      );
    }

    this.verifyDocumentSignature(input.signed_memo);
    const memoMeta = input.signed_memo.meta as {
      registry_id?: number;
      proposal_hash?: string;
    } | undefined;
    if (
      !memoMeta ||
      memoMeta.registry_id !== Cooperative.Registry.MarketplaceWriteoffServiceMemo.registry_id
    ) {
      throw new BadRequestException(
        `Служебная записка должна быть зарегистрирована с registry_id=${Cooperative.Registry.MarketplaceWriteoffServiceMemo.registry_id}`
      );
    }
    if (memoMeta.proposal_hash && memoMeta.proposal_hash !== proposal.proposal_hash) {
      throw new BadRequestException(
        'Служебная записка подписана для другого проекта списания'
      );
    }

    // on-chain confirmwroff: закрывает все неисполненные позиции КУ за вызов,
    // проводит o.mkt.wroff и якорит записку в реестр документов.
    const confirmTx = await this.chainPort.confirmWroff({
      coopname: proposal.coopname,
      signer: input.chairman_account,
      proposal_hash: proposal.proposal_hash,
      braname: input.braname as MarketContract.Actions.ConfirmWroff.IConfirmWroff['braname'],
      memo: new SignedDigitalDocumentInputDTO(input.signed_memo).toDocument() as MarketContract.Actions.ConfirmWroff.IConfirmWroff['memo'],
    });
    const confirmTxHash = this.extractTxHash(confirmTx);
    if (!confirmTxHash) {
      throw new ConflictException(
        'Подтверждение списания: цепь не вернула tx_hash (confirmwroff). Повторите.'
      );
    }

    let working = proposal;
    for (const idx of pendingIndexes) {
      working = await this.repo.markItemExecuted(input.id, idx, {
        at: new Date().toISOString(),
        actor: input.chairman_account,
        action: 'confirmed_by_branch',
        payload: {
          item_index: idx,
          braname: input.braname,
          confirmwroff_tx_hash: confirmTxHash,
        },
      });
      for (const invId of proposal.items[idx].inventory_ids ?? []) {
        await this.releasePublishedStockOnWriteoff(invId);
        await this.inventoryRepo.applyStatusTransition(invId, 'WRITTEN_OFF');
      }
    }

    // Все КУ подтверждены → проект исполнен.
    if (working.items.every((it) => it.executed)) {
      working = await this.repo.markFullyExecuted(input.id, {
        at: new Date().toISOString(),
        actor: input.chairman_account,
        action: 'execution_completed',
      });
      this.eventBus.emit(MARKETPLACE_WRITEOFF_EXECUTED_EVENT, {
        coopname: working.coopname,
        proposal_id: working.id,
        proposal_hash: working.proposal_hash,
        items_count: working.items.length,
        total_amount: working.total_amount,
      });
    }

    return working;
  }

  // ── Утилиты ────────────────────────────────────────────────────────

  /**
   * Списание позиции обезличенного остатка (requirement 76), уже
   * опубликованной оффером кооператива в каталог, снимает списанное
   * количество и с витрины — иначе `quantity_available` оффера остаётся
   * завышенным на списанную партию, и заказчик продолжает видеть/пытаться
   * заказать то, чего на складе уже нет (публикация сама по себе не
   * откатывается: `unpublishStock` — отдельное осознанное действие
   * оператора, здесь же позиция физически уничтожена/испорчена).
   */
  private async releasePublishedStockOnWriteoff(invId: string): Promise<void> {
    const inv = await this.inventoryRepo.findById(invId);
    if (!inv || inv.ownership !== MarketplaceInventoryOwnerships.COOP || !inv.published_offer_id) {
      return;
    }
    const offer = await this.offerRepo.findById(inv.published_offer_id);
    if (!offer) return;
    await this.offerRepo.applyUpdate(offer.id, {
      quantity_available: Math.max(0, offer.quantity_available - inv.quantity_per_label),
    });
  }

  computeProposalHash(input: {
    coopname: string;
    cycle_started_at: string;
    draft_id: string;
    items: MarketplaceWriteoffProposalItem[];
  }): string {
    const sorted = [...input.items].sort((a, b) =>
      `${a.braname}|${a.asset_title}|${a.amount}`.localeCompare(
        `${b.braname}|${b.asset_title}|${b.amount}`
      )
    );
    const payload = [
      'writeoff',
      input.coopname,
      input.cycle_started_at,
      input.draft_id,
      ...sorted.map((it) => `${it.braname}|${it.asset_title}|${it.quantity}|${it.amount}`),
    ].join('|');
    return createHash('sha256').update(payload).digest('hex');
  }

  validateAndNormalizeItems(items: MarketplaceWriteoffItemInput[]): MarketplaceWriteoffProposalItem[] {
    if (!Array.isArray(items) || items.length === 0) {
      throw new BadRequestException('Список позиций к списанию пуст');
    }
    if (items.length > 200) {
      throw new BadRequestException('Максимум 200 позиций в одном проекте списания');
    }
    return items.map((it) => {
      if (!it.braname) throw new BadRequestException('Не указан КУ позиции');
      if (!it.asset_title) throw new BadRequestException('Не указано наименование позиции');
      const amount = Number(it.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new BadRequestException(
          `Некорректная сумма позиции "${it.asset_title}": ${it.amount}`
        );
      }
      // Причина обязательна для любой позиции: автоматическое (крон) списание
      // само подставляет «Истёк срок годности»/«Срок годности не задан»
      // (см. MarketplaceWriteoffCronService.deriveReason); ручное — председатель
      // указывает её явно, одну на всю подборку. Угадывать причину backend'у
      // запрещено (см. историю 2026-07-29): непроверенный дефолт молча уходил
      // в документы 1108/1111 как будто реально заявленная причина.
      const reason = it.reason?.trim();
      if (!reason) {
        throw new BadRequestException(`Не указана причина списания позиции "${it.asset_title}"`);
      }
      return {
        braname: it.braname,
        asset_title: it.asset_title,
        quantity: it.quantity,
        amount: this.formatAssetNumber(amount),
        reason,
        inventory_ids: it.inventory_ids ?? [],
        executed: false,
      };
    });
  }

  sumItems(items: MarketplaceWriteoffProposalItem[]): number {
    return items.reduce((acc, it) => acc + Number(it.amount), 0);
  }

  formatAsset(value: number): string {
    return `${this.formatAssetNumber(value)} ${this.assetSymbol}`;
  }

  /**
   * Сумма для тела документа: 2 знака, разделители разрядов, запятая —
   * «1 020,00 RUB» (не машинные 4 знака). Для печатных Заявлений/Записок.
   */
  formatAssetHuman(value: number): string {
    const num = Number.isFinite(value) ? value : 0;
    return AmountFormatterUtils.formatAmount(`${num} ${this.assetSymbol}`);
  }

  formatAssetNumber(value: number): string {
    return value.toFixed(this.assetDecimals);
  }

  private extractTxHash(tx: unknown): string {
    const candidate = tx as
      | {
          response?: { transaction_id?: string };
          resolved?: { transaction?: { id?: string } };
          transaction?: { id?: string };
        }
      | undefined;
    return (
      candidate?.response?.transaction_id ??
      candidate?.resolved?.transaction?.id ??
      candidate?.transaction?.id ??
      ''
    );
  }

  private verifyDocumentSignature(document: ISignedDocumentDomainInterface): void {
    const sig = document.signatures?.[0];
    if (!sig) throw new HttpApiError(http.BAD_REQUEST, 'Заявление не подписано');
    const publicKey = PublicKey.from(sig.public_key);
    const signature = Signature.from(sig.signature);
    const verified = signature.verifyDigest(sig.signed_hash, publicKey);
    if (!verified) {
      throw new HttpApiError(http.BAD_REQUEST, 'Недействительная подпись Заявления о списании');
    }
  }
}

export { MarketplaceWriteoffProposalStatuses };
