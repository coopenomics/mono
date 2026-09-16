import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { v4 as uuid } from 'uuid';
import { Cooperative, SovietContract } from 'cooptypes';
import {
  DECISION_TRACKING_PORT,
  DecisionEventType,
  DecisionTrackedEvent,
  FREE_DECISION_PORT,
  type IDecisionTrackingPort,
  type IFreeDecisionPort,
  type ISignedDocument,
  type TrackingRule,
} from '@coopenomics/innercoop';
import config from '~/config/config';
import { sha256 } from '~/utils/sha256';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import { DocumentDomainService } from '~/domain/document/services/document-domain.service';
import { DRAFT_BLOCKCHAIN_PORT, type DraftBlockchainPort } from '~/domain/common/ports/draft-blockchain.port';
import { SOVIET_BLOCKCHAIN_PORT, type SovietBlockchainPort } from '~/domain/common/ports/soviet-blockchain.port';
import type { ActionDomainInterface } from '~/domain/parser/interfaces/action-domain.interface';
import { DOCUMENT_DECLARATION_QUERY_PORT, type DocumentDeclarationQueryPort } from '../ports/document-declaration-query.port';
import { DocumentApprovalRequirement, DocumentApprovalState } from '../enums/document-approval.enums';
import type { DocumentTemplateView } from '../interfaces/document-template-view.interface';
import { DocumentApprovalStateService } from './document-approval-state.service';
import { nowChainTimePoint, toChainTimePoint } from './decision-date';

/** Метка правила отслеживания, заведённого фабрикой утверждений. */
export const DOCUMENT_APPROVAL_RULE_KIND = 'document_approval';

/** Событие для уведомлений: совет отклонил или не рассмотрел в срок утверждение редакции. */
export const DOCUMENT_APPROVAL_DECLINED_EVENT = 'document-approval.declined';

export interface DocumentApprovalDeclinedPayload {
  coopname: string;
  registry_ids: number[];
  decision_id: number;
  reason: 'declined' | 'expired';
}

export interface ProposeDocumentApprovalInput {
  coopname: string;
  registry_ids: number[];
  username: string;
  title?: string;
}

interface RuleMetadata {
  kind: typeof DOCUMENT_APPROVAL_RULE_KIND;
  extension: string;
  registry_ids: number[];
  versions: Record<string, number>;
  text_hashes: Record<string, string>;
  bundle: string | null;
  decision_id?: number;
  /** Совместимость с онбордингом: пакет, унаследовавший шаг, закрывает и шаг. */
  onboarding_step?: string;
}

interface RenderedBlank {
  registry_id: number;
  title: string;
  html: string;
  text_hash: string;
}

/** Сколько раз и с какой паузой искать номер решения по хэшу после публикации повестки. */
const DECISION_LOOKUP_ATTEMPTS = 5;
const DECISION_LOOKUP_DELAY_MS = 2_000;

/** Повторы записи утверждения в цепь, если она не прошла с первого раза. */
const APPROVE_ATTEMPTS = 3;
const APPROVE_RETRY_DELAY_MS = 3_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Вынесение редакции документа на совет и фиксация утверждения.
 *
 * Совет голосует за текст: проект решения собирает бэкенд, вкладывая в него
 * бланк утверждаемой редакции из цепи и хэш текста. После решения фабрика
 * отслеживания находит правило по хэшу, и этот сервис пишет утверждение в
 * `draft::approvals` от имени кооператива. Отклонение и просрочка снимают
 * правило, документ возвращается в прежнее состояние.
 */
@Injectable()
export class DocumentApprovalProposalService {
  constructor(
    private readonly state: DocumentApprovalStateService,
    @Inject(DOCUMENT_DECLARATION_QUERY_PORT)
    private readonly declarations: DocumentDeclarationQueryPort,
    @Inject(FREE_DECISION_PORT)
    private readonly freeDecision: IFreeDecisionPort,
    @Inject(DECISION_TRACKING_PORT)
    private readonly tracking: IDecisionTrackingPort,
    @Inject(DRAFT_BLOCKCHAIN_PORT)
    private readonly draftChain: DraftBlockchainPort,
    @Inject(SOVIET_BLOCKCHAIN_PORT)
    private readonly sovietChain: SovietBlockchainPort,
    private readonly documents: DocumentDomainService,
    private readonly eventEmitter: EventEmitter2,
    private readonly logger: WinstonLoggerService
  ) {
    this.logger.setContext(DocumentApprovalProposalService.name);
  }

  /**
   * Вынести документ или пакет на совет. Повторный вызов при активной повестке
   * ничего не создаёт и возвращает текущее состояние.
   */
  public async propose(input: ProposeDocumentApprovalInput): Promise<DocumentTemplateView[]> {
    if (input.coopname !== config.coopname) {
      throw new BadRequestException('Указанное имя аккаунта кооператива не обслуживается здесь');
    }
    const registry_ids = [...new Set(input.registry_ids)];
    if (registry_ids.length === 0) throw new BadRequestException('Не указаны документы для утверждения');

    const templates = await this.state.getTemplates(input.coopname);
    const selected = registry_ids.map((id) => this.pickTemplate(templates, id));

    const alreadyPending = selected.filter((t) => t.state === DocumentApprovalState.Pending);
    if (alreadyPending.length > 0) {
      this.logger.info(
        `Документы ${alreadyPending.map((t) => t.registry_id).join(', ')} уже в повестке — повторное вынесение пропущено`
      );
      return selected;
    }

    const extension = selected[0]!.extension_name;
    if (selected.some((t) => t.extension_name !== extension)) {
      throw new BadRequestException('Одним решением утверждаются документы одного приложения');
    }

    const blanks: RenderedBlank[] = [];
    for (const template of selected) {
      blanks.push(await this.renderBlank(input.coopname, template));
    }

    const hash = await this.publishProject(input, selected, blanks);
    const decision_id = await this.lookupDecisionId(input.coopname, hash);

    const bundle = selected.every((t) => t.bundle === selected[0]!.bundle) ? selected[0]!.bundle : null;
    const metadata: RuleMetadata = {
      kind: DOCUMENT_APPROVAL_RULE_KIND,
      extension,
      registry_ids: selected.map((t) => t.registry_id),
      versions: Object.fromEntries(selected.map((t) => [String(t.registry_id), t.current_version as number])),
      text_hashes: Object.fromEntries(blanks.map((b) => [String(b.registry_id), b.text_hash])),
      bundle,
      ...(decision_id ? { decision_id } : {}),
      ...(bundle ? { onboarding_step: bundle } : {}),
    };

    await this.tracking.registerTrackingRule({
      hash,
      event_type: DecisionEventType.SOVIET_DECISION,
      vars_field: this.sharedVarsField(selected),
      metadata,
    });

    this.logger.info(
      `Редакции документов ${metadata.registry_ids.join(', ')} вынесены на совет: hash=${hash}, decision_id=${decision_id ?? '—'}`
    );

    return this.state.getTemplates(input.coopname).then((all) => all.filter((t) => registry_ids.includes(t.registry_id)));
  }

  /**
   * Решение совета принято: правило найдено по хэшу. Пишем утверждение каждой
   * редакции в цепь. Реквизиты протокола в `vars` уже записала фабрика
   * отслеживания.
   */
  @OnEvent(DecisionTrackedEvent.eventName)
  async handleDecisionTracked(event: DecisionTrackedEvent): Promise<void> {
    const metadata = event.result.metadata as Partial<RuleMetadata> | undefined;
    if (metadata?.kind !== DOCUMENT_APPROVAL_RULE_KIND) return;

    const decision_id = Number(event.result.decision_id);
    if (!Number.isFinite(decision_id) || decision_id <= 0) {
      this.logger.error(`Решение по правилу ${event.result.rule_id} без номера — утверждение не записано`);
      return;
    }
    const approved_at = toChainTimePoint(event.result.decision_date) ?? nowChainTimePoint();

    for (const registry_id of metadata.registry_ids ?? []) {
      const version = Number(metadata.versions?.[String(registry_id)]);
      const text_hash = metadata.text_hashes?.[String(registry_id)] ?? sha256('');
      await this.approveWithRetry({
        coopname: config.coopname,
        username: config.coopname,
        registry_id,
        version,
        decision_id,
        approved_at,
        text_hash,
      });
    }
  }

  @OnEvent(`action::${SovietContract.contractName.production}::${SovietContract.Actions.Decisions.Declinedec.actionName}`)
  async handleDeclined(action: ActionDomainInterface): Promise<void> {
    await this.releasePending(action, 'declined');
  }

  @OnEvent(`action::${SovietContract.contractName.production}::${SovietContract.Actions.Decisions.Cancelexprd.actionName}`)
  async handleExpired(action: ActionDomainInterface): Promise<void> {
    await this.releasePending(action, 'expired');
  }

  /**
   * Совет отклонил решение или оно снято как просроченное: правило снимается,
   * документ возвращается в прежнее состояние, председатель получает
   * уведомление и может вынести документ снова.
   */
  private async releasePending(action: ActionDomainInterface, reason: 'declined' | 'expired'): Promise<void> {
    const data = action.data as { coopname?: string; decision_id?: string | number } | undefined;
    const decision_id = Number(data?.decision_id);
    if (!Number.isFinite(decision_id)) return;

    const rules = (await this.tracking.getActiveRules()).filter((rule) => this.isOurRuleForDecision(rule, decision_id));
    for (const rule of rules) {
      await this.tracking.deactivateRule(rule.id);
      const metadata = rule.metadata as RuleMetadata;
      this.logger.info(
        `Утверждение документов ${metadata.registry_ids.join(', ')} снято с повестки: решение ${decision_id} ${reason === 'declined' ? 'отклонено' : 'просрочено'}`
      );
      this.eventEmitter.emit(DOCUMENT_APPROVAL_DECLINED_EVENT, {
        coopname: String(data?.coopname ?? config.coopname),
        registry_ids: metadata.registry_ids,
        decision_id,
        reason,
      } satisfies DocumentApprovalDeclinedPayload);
    }
  }

  private isOurRuleForDecision(rule: TrackingRule, decision_id: number): boolean {
    const metadata = rule.metadata as Partial<RuleMetadata> | undefined;
    return metadata?.kind === DOCUMENT_APPROVAL_RULE_KIND && Number(metadata.decision_id) === decision_id;
  }

  private pickTemplate(templates: DocumentTemplateView[], registry_id: number): DocumentTemplateView {
    const template = templates.find((t) => t.registry_id === registry_id);
    if (!template) throw new BadRequestException(`Документ ${registry_id} не объявлен ни одним установленным приложением`);
    if (template.approval !== DocumentApprovalRequirement.Required) {
      throw new BadRequestException(`Документ ${registry_id} не требует утверждения советом`);
    }
    if (template.current_version === null) throw new BadRequestException(`Шаблон документа ${registry_id} не найден в сети`);
    if (template.state === DocumentApprovalState.Approved) {
      throw new BadRequestException(`Редакция документа ${registry_id} уже утверждена советом`);
    }
    return template;
  }

  /** Поле `vars` для реквизитов протокола: одно на пакет, иначе не пишем. */
  private sharedVarsField(selected: DocumentTemplateView[]): string {
    const fields = new Set(selected.map((t) => t.vars_field).filter((f): f is string => Boolean(f)));
    return fields.size === 1 ? [...fields][0]! : '';
  }

  /**
   * Бланк утверждаемой редакции: текущий текст сети без субъекта, без PDF, в
   * базу не пишется. Хэш текста уходит в решение и затем в строку утверждения.
   */
  private async renderBlank(coopname: string, template: DocumentTemplateView): Promise<RenderedBlank> {
    const document = await this.documents.generateDocument({
      data: { coopname, username: coopname, registry_id: template.registry_id },
      options: { skip_save: true, skip_pdf: true, blank_signer: true },
    });
    return {
      registry_id: template.registry_id,
      title: document.meta?.title || template.title,
      html: document.html,
      text_hash: sha256(document.html),
    };
  }

  private async publishProject(
    input: ProposeDocumentApprovalInput,
    selected: DocumentTemplateView[],
    blanks: RenderedBlank[]
  ): Promise<string> {
    const project_id = uuid();
    const title = (input.title?.trim() || buildTitle(selected, blanks)).substring(0, 200);

    await this.freeDecision.createProjectOfFreeDecision({
      id: project_id,
      title,
      question: buildQuestion(selected, blanks),
      decision: buildDecision(selected, blanks),
    });

    const generated = await this.freeDecision.generateProjectOfFreeDecisionDocument(
      {
        project_id,
        coopname: input.coopname,
        username: input.username,
        registry_id: Cooperative.Registry.ProjectFreeDecision.registry_id,
        title,
      },
      {}
    );

    const document: ISignedDocument = {
      version: (generated.meta as any)?.version || '1.0',
      hash: generated.hash,
      doc_hash: (generated.meta as any)?.doc_hash || generated.hash,
      meta_hash: (generated.meta as any)?.meta_hash || generated.hash,
      meta: generated.meta,
      signatures: (generated.meta as any)?.signatures || [],
    };

    await this.freeDecision.publishProjectOfFreeDecision({
      coopname: input.coopname,
      username: input.username,
      meta: JSON.stringify({
        kind: DOCUMENT_APPROVAL_RULE_KIND,
        project_id,
        title,
        registry_ids: selected.map((t) => t.registry_id),
      }),
      document,
    });

    return generated.hash;
  }

  /** Номер решения по хэшу повестки: парсер догоняет цепь не мгновенно. */
  private async lookupDecisionId(coopname: string, hash: string): Promise<number | undefined> {
    for (let attempt = 0; attempt < DECISION_LOOKUP_ATTEMPTS; attempt++) {
      const decisions = await this.sovietChain.getDecisions(coopname);
      const found = decisions.find((d) => String((d as any).hash ?? '').toLowerCase() === hash.toLowerCase());
      if (found) return Number(found.id);
      await sleep(DECISION_LOOKUP_DELAY_MS);
    }
    this.logger.warn(`Решение по хэшу ${hash} в цепи не найдено — отклонение по номеру отслеживаться не будет`);
    return undefined;
  }

  private async approveWithRetry(data: Parameters<DraftBlockchainPort['approveDraft']>[0]): Promise<void> {
    for (let attempt = 1; attempt <= APPROVE_ATTEMPTS; attempt++) {
      try {
        await this.draftChain.approveDraft(data);
        this.logger.info(`Редакция ${data.version} документа ${data.registry_id} утверждена решением ${data.decision_id}`);
        return;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(
          `Не удалось записать утверждение документа ${data.registry_id} (попытка ${attempt}/${APPROVE_ATTEMPTS}): ${message}`
        );
        if (attempt < APPROVE_ATTEMPTS) await sleep(APPROVE_RETRY_DELAY_MS);
      }
    }
  }
}

function buildTitle(selected: DocumentTemplateView[], blanks: RenderedBlank[]): string {
  if (selected.length === 1) {
    return `Утверждение редакции № ${selected[0]!.current_version} документа «${blanks[0]!.title}»`;
  }
  return `Утверждение редакций документов (${selected.length})`;
}

function buildQuestion(selected: DocumentTemplateView[], blanks: RenderedBlank[]): string {
  if (selected.length === 1) {
    return `Об утверждении редакции № ${selected[0]!.current_version} документа «${blanks[0]!.title}»`;
  }
  const list = blanks.map((b, i) => `«${b.title}» (редакция № ${selected[i]!.current_version})`).join(', ');
  return `Об утверждении редакций документов: ${list}`;
}

function buildDecision(selected: DocumentTemplateView[], blanks: RenderedBlank[]): string {
  return blanks
    .map((blank, i) => {
      const template = selected[i]!;
      const head = `Утвердить редакцию № ${template.current_version} документа «${blank.title}» (хэш текста ${blank.text_hash}) и применять её в кооперативе с даты настоящего решения.`;
      return `<p>${head}</p>\n${blank.html}`;
    })
    .join('\n<hr/>\n');
}
