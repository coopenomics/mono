import { Inject, Injectable } from '@nestjs/common';
import { Classes } from '@coopenomics/sdk';
import { Cooperative } from 'cooptypes';
import { DomainToBlockchainUtils } from '@coopenomics/extension-kit';
import {
  DOCUMENT_PORT,
  LOGGER_PORT,
  type IDocumentPort,
  type ILoggerPort,
  type InnerGenerateDocumentData,
} from '@coopenomics/innercoop';
import { RobotDecisionStage } from '../../domain/enums/robot-decision-stage.enum';
import type { RobotDecisionDomainEntity } from '../../domain/entities/robot-decision.entity';
import { ROBOT_DECISION_REPOSITORY, type RobotDecisionRepository } from '../../domain/repositories/robot-decision.repository';
import { RobotChainService, type AutomatorRow, type BoardRow, type DecisionRow, type RobotVoteAction } from './robot-chain.service';
import { RobotKeyService } from './robot-key.service';
import { isAutomationExpired } from './robot-registry.service';

/** Поля метаданных документа, которые задаёт фабрика сама; в данные генерации протокола их не передаём. */
const META_SERVICE_KEYS = new Set([
  'title', 'registry_id', 'lang', 'generator', 'version', 'coopname', 'username', 'created_at', 'block_num', 'timezone', 'links',
]);

/** Намерение робота по одному члену совета для одного решения. */
export type RobotVoteIntent = { kind: 'for' } | { kind: 'against' } | { kind: 'wait'; follow: string } | { kind: 'none' };

export interface RobotLimits {
  max_attempts: number;
  retry_backoff_sec: number;
}

/**
 * Конвейер робота по одному решению. Две транзакции:
 *
 *  1) голоса «за» от делегировавших членов совета — подписи их ключами робота
 *     в данных действий, транзакция от кооператива;
 *  2) после того как голоса легли в цепь и её проиндексировал парсер (фабрика
 *     читает голоса из истории действий), протокол по шаблону типа решения,
 *     подпись ключом робота председателя, утверждение и исполнение.
 *
 * Каждый шаг идемпотентен: уже проголосовавшие члены совета пропускаются по
 * таблице решения, повторная доставка события не даёт второго голоса; протокол
 * подписывается только для решения, которое ещё стоит на повестке.
 */
@Injectable()
export class RobotDecisionService {
  constructor(
    @Inject(ROBOT_DECISION_REPOSITORY) private readonly journal: RobotDecisionRepository,
    @Inject(DOCUMENT_PORT) private readonly documents: IDocumentPort,
    private readonly chain: RobotChainService,
    private readonly keys: RobotKeyService,
    private readonly toChain: DomainToBlockchainUtils,
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort
  ) {
    this.logger.setContext(RobotDecisionService.name);
  }

  /** Обработать запись журнала: шаг вперёд, ошибки — в запись с отсрочкой повтора. */
  async process(entry: RobotDecisionDomainEntity, limits: RobotLimits): Promise<RobotDecisionDomainEntity> {
    try {
      const next = await this.step(entry);
      next.last_error = null;
      next.next_attempt_at = null;
      return await this.journal.save(next);
    } catch (e: any) {
      const message = e?.message ?? String(e);
      entry.attempts += 1;
      entry.last_error = message;
      if (entry.attempts >= limits.max_attempts) {
        entry.stage = RobotDecisionStage.FAILED;
        entry.next_attempt_at = null;
        this.logger.error(`Решение ${entry.decision_id}: попытки исчерпаны — ${message}`);
      } else {
        entry.next_attempt_at = new Date(Date.now() + limits.retry_backoff_sec * 1000 * entry.attempts);
        this.logger.warn(`Решение ${entry.decision_id}: ${message}; повтор через ${limits.retry_backoff_sec * entry.attempts} с`);
      }
      return await this.journal.save(entry);
    }
  }

  private async step(entry: RobotDecisionDomainEntity): Promise<RobotDecisionDomainEntity> {
    const decision = await this.chain.getDecision(entry.coopname, entry.decision_id);
    if (!decision) {
      // Решения нет на повестке: исполнено вручную, отклонено или просрочено.
      if (entry.stage !== RobotDecisionStage.EXECUTED) entry.stage = RobotDecisionStage.CLOSED;
      return entry;
    }
    // Утверждено, но не исполнено (ручной путь на полпути) — робот не вмешивается.
    if (Number(decision.authorized) === 1 || decision.authorized === true) return entry;

    const [automations, board] = await Promise.all([this.chain.getAutomations(entry.coopname), this.chain.getSovietBoard(entry.coopname)]);
    if (!board) throw new Error('Совет кооператива не найден');
    const alive = automations.filter((a) => !isAutomationExpired(a));

    // Шаг 1. Голоса — одна транзакция, дальше ждём следующего прохода.
    if (await this.castVotes(entry, decision, alive, board)) return entry;

    return this.finishAfterVotes(entry, decision, alive, board);
  }

  /** Голоса уже в цепи: кворум (или чьи голоса ещё ждём) и, если кворум есть, протокол председателя. */
  private async finishAfterVotes(
    entry: RobotDecisionDomainEntity,
    decision: DecisionRow,
    alive: AutomatorRow[],
    board: BoardRow
  ): Promise<RobotDecisionDomainEntity> {
    const fresh = (await this.chain.getDecision(entry.coopname, entry.decision_id)) ?? decision;
    if (!fresh.approved) {
      entry.stage = entry.waiting_for.length ? RobotDecisionStage.AWAITING_FOLLOWED : RobotDecisionStage.AWAITING_QUORUM;
      return entry;
    }

    const chairman = await this.chairmanSigner(entry, alive, board);
    if (!chairman) {
      entry.stage = RobotDecisionStage.AWAITING_CHAIRMAN;
      return entry;
    }
    return this.authorizeWithProtocol(entry, fresh, chairman);
  }

  /** Председатель, делегировавший подпись протоколов этого типа, и его ключ; null — ждать председателя. */
  private async chairmanSigner(entry: RobotDecisionDomainEntity, alive: AutomatorRow[], board: BoardRow) {
    const chairman = board.members.find((m) => m.position === 'chairman')?.username;
    if (!chairman) return null;
    const row = alive.find((a) => a.member === chairman && a.authorize_types.includes(entry.decision_type));
    if (!row) return null;
    const key = await this.keys.getWif(entry.coopname, chairman);
    if (!key) return null;
    if (key.permission_name !== row.permission_name) {
      throw new Error(`Разрешение ключа председателя (${key.permission_name}) не совпадает с реестром (${row.permission_name})`);
    }
    return { username: String(chairman), wif: key.wif, permission: row.permission_name };
  }

  /** Протокол по шаблону типа решения, подпись ключом председателя, утверждение и исполнение одной транзакцией. */
  private async authorizeWithProtocol(
    entry: RobotDecisionDomainEntity,
    decision: DecisionRow,
    chairman: { username: string; wif: string; permission: string }
  ): Promise<RobotDecisionDomainEntity> {
    entry.stage = RobotDecisionStage.AWAITING_PROTOCOL;
    const registryId = Cooperative.Document.decisionTypesRegistry[entry.decision_type]?.protocol_registry_id;
    if (!registryId)
      throw new Error(
        `Тип решения ${entry.decision_type} не описан в реестре решений совета — автоматизировать его нельзя`
      );

    const generated = await this.documents.generate({
      data: this.protocolData(registryId, entry.coopname, decision),
      options: { lang: 'ru' },
    });
    const signed = await new Classes.Document(chairman.wif).signDocument(generated as any, chairman.username, 1);
    const document = this.toChain.convertSignedDocumentToBlockchainFormat(signed as any);

    const txId = await this.chain.authorizeAndExec(entry.coopname, chairman.username, entry.decision_id, document as any, chairman.permission);
    entry.protocol_hash = String(signed.hash);
    entry.tx_hashes = [...entry.tx_hashes, txId];
    entry.stage = RobotDecisionStage.EXECUTED;
    this.logger.info(`Решение ${entry.decision_id} (${entry.decision_type}) утверждено и исполнено роботом, транзакция ${txId}`);
    return entry;
  }

  /**
   * Что робот делает от имени члена совета по этому решению: голосует «за» (режим
   * «сразу» или ведомый уже «за»), «против» (ведомый «против»), ждёт ведомого или ничего.
   */
  static voteIntent(row: AutomatorRow, type: string, decision: DecisionRow): RobotVoteIntent {
    if (row.vote_types.includes(type)) return { kind: 'for' };
    const rule = (row.follow_rules ?? []).find((r) => String(r.decision_type) === type);
    if (!rule) return { kind: 'none' };
    const followed = String(rule.follow);
    if ((decision.votes_for ?? []).map(String).includes(followed)) return { kind: 'for' };
    if ((decision.votes_against ?? []).map(String).includes(followed)) return { kind: 'against' };
    return { kind: 'wait', follow: followed };
  }

  /** Голоса делегировавших; true — транзакция ушла, запись обновлена. */
  private async castVotes(entry: RobotDecisionDomainEntity, decision: DecisionRow, alive: AutomatorRow[], board: BoardRow): Promise<boolean> {
    const already = new Set([...(decision.votes_for ?? []), ...(decision.votes_against ?? [])].map(String));
    const pending = alive.filter((a) => !already.has(a.member) && board.members.some((m) => m.username === a.member && m.is_voting));

    const waiting = new Set<string>();
    const votes: RobotVoteAction[] = [];
    const voters: { member: string; permission: string }[] = [];
    for (const row of pending) {
      const intent = RobotDecisionService.voteIntent(row, entry.decision_type, decision);
      if (intent.kind === 'wait') waiting.add(intent.follow);
      if (intent.kind !== 'for' && intent.kind !== 'against') continue;
      const vote = await this.signVote(entry, row, intent.kind === 'against');
      if (!vote) continue;
      votes.push(vote);
      voters.push({ member: row.member, permission: row.permission_name });
    }
    entry.waiting_for = [...waiting];

    if (votes.length === 0) {
      if (entry.stage === RobotDecisionStage.NEW) entry.stage = RobotDecisionStage.VOTED;
      return false;
    }

    const txId = await this.chain.submitVotes(entry.coopname, votes);
    const at = new Date().toISOString();
    entry.votes = [...entry.votes, ...voters.map((v) => ({ ...v, tx_id: txId, at }))];
    entry.tx_hashes = [...entry.tx_hashes, txId];
    entry.stage = RobotDecisionStage.VOTED;
    this.logger.info(`Решение ${entry.decision_id}: голоса робота за ${voters.map((v) => v.member).join(', ')} — транзакция ${txId}`);
    return true;
  }

  /** Подпись голоса ключом разрешения робота; null — ключа нет или он не совпадает с реестром. */
  private async signVote(entry: RobotDecisionDomainEntity, row: AutomatorRow, against: boolean): Promise<RobotVoteAction | null> {
    const key = await this.keys.getWif(entry.coopname, row.member);
    if (!key) {
      this.logger.warn(`У робота нет ключа члена совета ${row.member}: голос по решению ${entry.decision_id} не подан`);
      return null;
    }
    if (key.permission_name !== row.permission_name) {
      this.logger.warn(`Разрешение ключа ${row.member} (${key.permission_name}) не совпадает с реестром (${row.permission_name}): голос не подан`);
      return null;
    }
    const signer = new Classes.Vote(key.wif);
    const data = against
      ? await signer.voteAgainst(entry.coopname, row.member, entry.decision_id, row.permission_name)
      : await signer.voteFor(entry.coopname, row.member, entry.decision_id, row.permission_name);
    return { data, against };
  }

  /**
   * Данные генерации протокола: номер шаблона, кооператив, автор повестки,
   * номер решения и прикладные поля из метаданных заявления (номер проекта,
   * хэш заявления и т.п.) — то же, что передаёт рабочий стол при ручном
   * утверждении. Служебные поля метаданных фабрика проставляет сама.
   */
  protocolData(registryId: number, coopname: string, decision: DecisionRow): InnerGenerateDocumentData {
    let statementMeta: Record<string, any> = {};
    try {
      const raw = (decision.statement as any)?.meta;
      statementMeta = typeof raw === 'string' ? JSON.parse(raw) : raw ?? {};
    } catch {
      statementMeta = {};
    }
    const business = Object.fromEntries(Object.entries(statementMeta).filter(([k]) => !META_SERVICE_KEYS.has(k)));
    const data: InnerGenerateDocumentData = {
      ...business,
      registry_id: registryId,
      coopname,
      username: String(decision.username),
      decision_id: Number(decision.id),
      decision_hash: String(decision.hash ?? ''),
    };
    // Поля протокола, которых нет в заявлении буквально, но они выводятся из него
    // или из самого решения — ровно так же их достаёт рабочий стол при ручном пути.
    if (Array.isArray(business.items) && data.items_count === undefined) data.items_count = business.items.length;
    if (data.receiver === undefined) data.receiver = String(decision.username);
    if (data.meet_hash === undefined && decision.hash) data.meet_hash = String(decision.hash);
    return data;
  }
}
