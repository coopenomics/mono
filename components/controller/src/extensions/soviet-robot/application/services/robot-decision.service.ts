import { Inject, Injectable } from '@nestjs/common';
import { Classes } from '@coopenomics/sdk';
import { Cooperative, SovietContract } from 'cooptypes';
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
import { RobotChainService, type AutomatorRow, type BoardRow, type DecisionRow } from './robot-chain.service';
import { RobotKeyService } from './robot-key.service';
import { isAutomationExpired } from './robot-registry.service';

/** Поля метаданных документа, которые задаёт фабрика сама; в данные генерации протокола их не передаём. */
const META_SERVICE_KEYS = new Set([
  'title', 'registry_id', 'lang', 'generator', 'version', 'coopname', 'username', 'created_at', 'block_num', 'timezone', 'links',
]);

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
    if (Number(decision.authorized) === 1 || decision.authorized === true) {
      // Утверждено, но не исполнено (ручной путь на полпути) — робот не вмешивается.
      return entry;
    }

    const [automations, board] = await Promise.all([this.chain.getAutomations(entry.coopname), this.chain.getSovietBoard(entry.coopname)]);
    if (!board) throw new Error('Совет кооператива не найден');
    const alive = automations.filter((a) => !isAutomationExpired(a));

    // Шаг 1. Голоса.
    const voted = await this.castVotes(entry, decision, alive, board);
    if (voted) return entry;

    // Шаг 2. Кворум.
    const fresh = (await this.chain.getDecision(entry.coopname, entry.decision_id)) ?? decision;
    if (!fresh.approved) {
      entry.stage = RobotDecisionStage.AWAITING_QUORUM;
      return entry;
    }

    // Шаг 3. Протокол председателя.
    const chairman = board.members.find((m) => m.position === 'chairman')?.username;
    const chairmanRow = chairman ? alive.find((a) => a.member === chairman && a.authorize_types.includes(entry.decision_type)) : undefined;
    const chairmanKey = chairman && chairmanRow ? await this.keys.getWif(entry.coopname, chairman) : null;
    if (!chairman || !chairmanRow || !chairmanKey) {
      entry.stage = RobotDecisionStage.AWAITING_CHAIRMAN;
      return entry;
    }
    if (chairmanKey.permission_name !== chairmanRow.permission_name) {
      throw new Error(`Разрешение ключа председателя (${chairmanKey.permission_name}) не совпадает с реестром (${chairmanRow.permission_name})`);
    }

    entry.stage = RobotDecisionStage.AWAITING_PROTOCOL;
    const registryId = Cooperative.Document.decisionTypesRegistry[entry.decision_type]?.protocol_registry_id;
    if (!registryId) throw new Error(`Для типа решения ${entry.decision_type} не описан шаблон протокола`);

    const generated = await this.documents.generate({
      data: this.protocolData(registryId, entry.coopname, fresh),
      options: { lang: 'ru' },
    });
    const signer = new Classes.Document(chairmanKey.wif);
    const signed = await signer.signDocument(generated as any, chairman, 1);
    const document = this.toChain.convertSignedDocumentToBlockchainFormat(signed as any);

    const txId = await this.chain.authorizeAndExec(entry.coopname, chairman, entry.decision_id, document as any, chairmanRow.permission_name);
    entry.protocol_hash = String(signed.hash);
    entry.tx_hashes = [...entry.tx_hashes, txId];
    entry.stage = RobotDecisionStage.EXECUTED;
    this.logger.info(`Решение ${entry.decision_id} (${entry.decision_type}) утверждено и исполнено роботом, транзакция ${txId}`);
    return entry;
  }

  /** Голоса за делегировавших; true — транзакция ушла, запись обновлена. */
  private async castVotes(entry: RobotDecisionDomainEntity, decision: DecisionRow, alive: AutomatorRow[], board: BoardRow): Promise<boolean> {
    const already = new Set([...(decision.votes_for ?? []), ...(decision.votes_against ?? [])].map(String));
    const candidates = alive.filter(
      (a) =>
        a.vote_types.includes(entry.decision_type) &&
        !already.has(a.member) &&
        board.members.some((m) => m.username === a.member && m.is_voting)
    );
    if (candidates.length === 0) {
      if (entry.stage === RobotDecisionStage.NEW) entry.stage = RobotDecisionStage.VOTED;
      return false;
    }

    const votes: SovietContract.Actions.Decisions.VoteFor.IVoteForDecision[] = [];
    const voters: { member: string; permission: string }[] = [];
    for (const row of candidates) {
      const key = await this.keys.getWif(entry.coopname, row.member);
      if (!key) {
        this.logger.warn(`У робота нет ключа члена совета ${row.member}: голос по решению ${entry.decision_id} не подан`);
        continue;
      }
      if (key.permission_name !== row.permission_name) {
        this.logger.warn(`Разрешение ключа ${row.member} (${key.permission_name}) не совпадает с реестром (${row.permission_name}): голос не подан`);
        continue;
      }
      const vote = await new Classes.Vote(key.wif).voteFor(entry.coopname, row.member, entry.decision_id, row.permission_name);
      votes.push(vote);
      voters.push({ member: row.member, permission: row.permission_name });
    }
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
