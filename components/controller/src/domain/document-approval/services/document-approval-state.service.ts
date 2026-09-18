import { Inject, Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { DraftContract } from 'cooptypes';
import { DECISION_TRACKING_PORT, type IDecisionTrackingPort, type InnerDocumentDeclaration, type TrackingRule } from '@coopenomics/innercoop';
import { BLOCKCHAIN_PORT, type BlockchainPort } from '~/domain/common/ports/blockchain.port';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import { DOCUMENT_DECLARATION_QUERY_PORT, type DocumentDeclarationQueryPort } from '../ports/document-declaration-query.port';
import type { DocumentTemplateView } from '../interfaces/document-template-view.interface';
import { DocumentApprovalRequirement, DocumentApprovalState, type DocumentKind } from '../enums/document-approval.enums';
import { computeDocumentState } from './compute-document-state';
import { sha256 } from '~/utils/sha256';

/** Сколько живёт снимок таблиц цепи, если события парсера не пришли раньше. */
const CHAIN_CACHE_TTL_MS = 60_000;

interface DraftRow {
  registry_id: number;
  version: number;
  title: string;
  /** Хэш текущего текста шаблона — для строки утверждения при переносе. */
  context_hash: string;
}

interface ApprovalRow {
  registry_id: number;
  version: number;
  decision_id: number;
  approved_at: string;
}

interface CacheEntry<T> {
  value: T;
  expires_at: number;
}

/**
 * Состояние документов кооператива: декларации реестра шаблонов, сведённые с
 * редакциями в сети (`draft::drafts`), утверждениями совета
 * (`draft::approvals` области кооператива) и повесткой (активные правила
 * отслеживания с `registry_ids`).
 *
 * Таблицы цепи читаются целиком и кэшируются: строки шаблонов тяжёлые (текст
 * документа), а состояние спрашивают часто. Кэш сбрасывают события парсера по
 * действиям контракта `draft`, TTL — страховка на случай, если события не
 * пришли.
 */
@Injectable()
export class DocumentApprovalStateService {
  private draftsCache: CacheEntry<Map<number, DraftRow>> | null = null;
  private readonly approvalsCache = new Map<string, CacheEntry<Map<number, ApprovalRow>>>();

  constructor(
    @Inject(DOCUMENT_DECLARATION_QUERY_PORT)
    private readonly declarations: DocumentDeclarationQueryPort,
    @Inject(BLOCKCHAIN_PORT)
    private readonly blockchain: BlockchainPort,
    @Inject(DECISION_TRACKING_PORT)
    private readonly tracking: IDecisionTrackingPort,
    private readonly logger: WinstonLoggerService
  ) {
    this.logger.setContext(DocumentApprovalStateService.name);
  }

  /** Реестр шаблонов кооператива со состояниями. */
  public async getTemplates(coopname: string): Promise<DocumentTemplateView[]> {
    const [drafts, approvals, pending] = await Promise.all([
      this.loadDrafts(),
      this.loadApprovals(coopname),
      this.loadPending(),
    ]);

    return this.declarations
      .getAll()
      .map((declaration) =>
        toTemplateView(
          declaration,
          drafts.get(declaration.registry_id) ?? null,
          approvals.get(declaration.registry_id) ?? null,
          pending.get(declaration.registry_id) ?? null
        )
      );
  }

  /**
   * Эффективная редакция каждого шаблона для кооператива: утверждённая, если
   * строка утверждения есть, иначе текущая редакция сети. Тот же выбор делают
   * контракты подписи; по нему рабочий стол решает, просить ли переподписать.
   */
  public async getEffectiveVersions(coopname: string): Promise<Map<number, number>> {
    const [drafts, approvals] = await Promise.all([this.loadDrafts(), this.loadApprovals(coopname)]);
    const result = new Map<number, number>();
    for (const [registry_id, draft] of drafts) {
      result.set(registry_id, approvals.get(registry_id)?.version ?? draft.version);
    }
    return result;
  }

  /** Хэш текущего текста шаблона в сети; `null`, если шаблона нет. */
  public async getCurrentTextHash(registry_id: number): Promise<string | null> {
    return (await this.loadDrafts()).get(registry_id)?.context_hash ?? null;
  }

  /** Обязательные документы приложения, у которых есть хотя бы одна утверждённая редакция. */
  public async isExtensionApproved(coopname: string, extension_name: string): Promise<boolean> {
    const templates = await this.getTemplates(coopname);
    const required = templates.filter(
      (t) => t.extension_name === extension_name && t.approval === DocumentApprovalRequirement.Required
    );
    return required.length > 0 && required.every((t) => t.state === DocumentApprovalState.Approved || t.state === DocumentApprovalState.Outdated);
  }

  private async loadDrafts(): Promise<Map<number, DraftRow>> {
    if (this.draftsCache && this.draftsCache.expires_at > Date.now()) return this.draftsCache.value;

    const rows = await this.blockchain.getAllRows(
      DraftContract.contractName.production,
      DraftContract.contractName.production,
      DraftContract.Tables.Drafts.tableName
    );
    const map = new Map<number, DraftRow>();
    for (const row of rows) {
      map.set(Number(row.registry_id), {
        registry_id: Number(row.registry_id),
        version: Number(row.version),
        title: String(row.title ?? ''),
        context_hash: sha256(String(row.context ?? '')),
      });
    }
    this.draftsCache = { value: map, expires_at: Date.now() + CHAIN_CACHE_TTL_MS };
    return map;
  }

  private async loadApprovals(coopname: string): Promise<Map<number, ApprovalRow>> {
    const cached = this.approvalsCache.get(coopname);
    if (cached && cached.expires_at > Date.now()) return cached.value;

    const rows = await this.blockchain.getAllRows(
      DraftContract.contractName.production,
      coopname,
      DraftContract.Tables.Approvals.tableName
    );
    const map = new Map<number, ApprovalRow>();
    for (const row of rows) {
      map.set(Number(row.registry_id), {
        registry_id: Number(row.registry_id),
        version: Number(row.version),
        decision_id: Number(row.decision_id),
        approved_at: String(row.approved_at),
      });
    }
    this.approvalsCache.set(coopname, { value: map, expires_at: Date.now() + CHAIN_CACHE_TTL_MS });
    return map;
  }

  /** registry_id → хэш проекта решения, пока оно в повестке. */
  private async loadPending(): Promise<Map<number, string>> {
    const rules = await this.tracking.getActiveRules();
    const map = new Map<number, string>();
    for (const rule of rules) {
      for (const registry_id of registryIdsOf(rule)) {
        map.set(registry_id, rule.hash);
      }
    }
    return map;
  }

  @OnEvent(`action::${DraftContract.contractName.production}::${DraftContract.Actions.UpVersion.actionName}`)
  @OnEvent(`action::${DraftContract.contractName.production}::${DraftContract.Actions.EditDraft.actionName}`)
  @OnEvent(`action::${DraftContract.contractName.production}::${DraftContract.Actions.CreateDraft.actionName}`)
  onDraftChanged(): void {
    this.draftsCache = null;
  }

  @OnEvent(`action::${DraftContract.contractName.production}::${DraftContract.Actions.Approve.actionName}`)
  onApproved(): void {
    this.approvalsCache.clear();
  }
}

function toTemplateView(
  declaration: InnerDocumentDeclaration,
  draft: DraftRow | null,
  approval: ApprovalRow | null,
  pendingHash: string | null
): DocumentTemplateView {
  const current_version = draft ? draft.version : null;
  const approved_version = approval ? approval.version : null;
  const requirement = declaration.approval as DocumentApprovalRequirement;

  return {
    registry_id: declaration.registry_id,
    extension_name: declaration.extension_name,
    kind: declaration.kind as DocumentKind,
    approval: requirement,
    bundle: declaration.bundle ?? null,
    vars_field: declaration.vars_field ?? null,
    title: resolveTitle(declaration, draft),
    order: declaration.order,
    current_version,
    approved_version,
    approved_decision_id: approval ? approval.decision_id : null,
    approved_at: approval ? approval.approved_at : null,
    effective_version: approved_version ?? current_version,
    state: computeDocumentState({
      approval: requirement,
      current_version,
      approved_version,
      pending: pendingHash !== null,
    }),
    pending_hash: pendingHash,
  };
}

/** Название из декларации, иначе из шаблона в цепи, иначе по номеру. */
function resolveTitle(declaration: InnerDocumentDeclaration, draft: DraftRow | null): string {
  if (declaration.title) return declaration.title;
  if (draft?.title) return draft.title;
  return `Документ ${declaration.registry_id}`;
}

/** Документы, которые правило отслеживания выносит на совет. */
function registryIdsOf(rule: TrackingRule): number[] {
  const ids = rule.metadata?.registry_ids;
  if (!Array.isArray(ids)) return [];
  return ids.map(Number).filter((n) => Number.isFinite(n));
}
