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
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import { DocumentDomainService } from '~/domain/document/services/document-domain.service';
import type { PaginationInputDTO } from '~/application/common/dto/pagination.dto';
import type { ISignedDocumentDomainInterface } from '~/domain/document/interfaces/signed-document-domain.interface';
import {
  MARKETPLACE_WRITEOFF_PROPOSAL_REPOSITORY,
  type MarketplaceWriteoffProposalDomainRepository,
} from '../../domain/repositories/marketplace-writeoff-proposal.repository';
import {
  MARKETPLACE_INVENTORY_REPOSITORY,
  type MarketplaceInventoryDomainRepository,
} from '../../domain/repositories/marketplace-inventory.repository';
import {
  MARKETPLACE_CANONICAL_BLOCKCHAIN_PORT,
  type MarketplaceCanonicalBlockchainPort,
} from '../../domain/ports/marketplace-canonical-blockchain.port';
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

const ASSET_DECIMALS = 4;
const ASSET_SYMBOL = 'RUB';

export interface MarketplaceWriteoffItemInput {
  braname: string;
  asset_title: string;
  quantity: string;
  amount: string;
  reason: string;
  inventory_id?: string | null;
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
  signed_statement: ISignedDocumentDomainInterface;
}

export interface MarketplaceListWriteoffProposalsInput {
  coopname: string;
  statuses?: MarketplaceWriteoffProposalStatus[];
  pagination?: PaginationInputDTO;
}

@Injectable()
export class MarketplaceWriteoffService {
  constructor(
    @Inject(MARKETPLACE_WRITEOFF_PROPOSAL_REPOSITORY)
    private readonly repo: MarketplaceWriteoffProposalDomainRepository,
    @Inject(MARKETPLACE_INVENTORY_REPOSITORY)
    private readonly inventoryRepo: MarketplaceInventoryDomainRepository,
    @Inject(MARKETPLACE_CANONICAL_BLOCKCHAIN_PORT)
    private readonly chainPort: MarketplaceCanonicalBlockchainPort,
    private readonly documentDomainService: DocumentDomainService,
    private readonly eventBus: EventEmitter2,
    private readonly logger: WinstonLoggerService
  ) {
    this.logger.setContext(MarketplaceWriteoffService.name);
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
    const existingActive = await this.repo.findOpenInCouncil(input.coopname);
    if (existingActive) {
      throw new ConflictException(
        `Проект списания id=${existingActive.id} уже отправлен в совет (статус=${existingActive.status}). Дождитесь решения совета.`
      );
    }

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

    // 1. on-chain propwroff: фиксируем wroffprops::proposed
    await this.chainPort.propWroff({
      coopname: draft.coopname,
      proposed_by: input.chairman_account,
      proposal_hash: proposalHash,
      items: draft.items.map((it) => ({
        source_order_id: '0',
        braname: it.braname,
        amount: it.amount,
        meta: it.reason,
        executed: false,
      })) as MarketContract.Actions.PropWroff.IPropWroff['items'],
    });

    // 2. createagenda: ставим повестку совета с callback'ами marketplace
    await this.chainPort.createWriteoffAgenda({
      coopname: draft.coopname,
      username: input.chairman_account,
      proposal_hash: proposalHash,
      statement: input.signed_statement.toDocument
        ? input.signed_statement.toDocument()
        : (input.signed_statement as unknown),
      meta: JSON.stringify({
        registry_id: Cooperative.Registry.MarketplaceWriteoffStatement.registry_id,
        proposal_hash: proposalHash,
        items_count: draft.items.length,
        total_amount: draft.total_amount,
      }),
    });

    // 3. PG: DRAFT → ON_AGENDA (decision_id заполнит реактор-наблюдатель за soviet.decisions)
    const submitted = await this.repo.submitToCouncil(draft.id, {
      proposal_hash: proposalHash,
      statement_doc: input.signed_statement.toDocument
        ? input.signed_statement.toDocument()
        : (input.signed_statement as unknown),
      decision_id: null,
      submitted_at: new Date(),
      proposed_by_account: input.chairman_account,
      log: {
        at: new Date().toISOString(),
        actor: input.chairman_account,
        action: 'submitted_to_council',
        payload: { proposal_hash: proposalHash, items_count: draft.items.length },
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

    // Сразу запускаем исполнение
    await this.executeAuthorizedProposal(updated.id, input.authorized_by ?? proposal.proposed_by_account ?? input.coopname);
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
      try {
        await this.chainPort.execWroff({
          coopname: working.coopname,
          signer,
          proposal_hash: working.proposal_hash,
          item_index: String(i) as MarketContract.Actions.ExecWroff.IExecWroff['item_index'],
        });
        working = await this.repo.markItemExecuted(id, i, {
          at: new Date().toISOString(),
          actor: signer,
          action: 'item_executed',
          payload: { item_index: i, braname: item.braname, amount: item.amount },
        });
        if (item.inventory_id) {
          try {
            await this.inventoryRepo.applyStatusTransition(item.inventory_id, 'WRITTEN_OFF');
          } catch (e) {
            this.logger.warn(
              `[WRITEOFF] не удалось перевести inventory ${item.inventory_id} в WRITTEN_OFF: ${(e as Error).message}`
            );
          }
        }
      } catch (e) {
        this.logger.error(
          `[WRITEOFF] не удалось исполнить позицию ${i} проекта ${id}: ${(e as Error).message}`
        );
        throw e;
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

  // ── Утилиты ────────────────────────────────────────────────────────

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
      return {
        braname: it.braname,
        asset_title: it.asset_title,
        quantity: it.quantity,
        amount: this.formatAssetNumber(amount),
        reason: it.reason ?? '',
        inventory_id: it.inventory_id ?? null,
        executed: false,
      };
    });
  }

  sumItems(items: MarketplaceWriteoffProposalItem[]): number {
    return items.reduce((acc, it) => acc + Number(it.amount), 0);
  }

  formatAsset(value: number): string {
    return `${this.formatAssetNumber(value)} ${ASSET_SYMBOL}`;
  }

  formatAssetNumber(value: number): string {
    return value.toFixed(ASSET_DECIMALS);
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
