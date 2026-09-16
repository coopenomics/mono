import { Inject, Injectable } from '@nestjs/common';
import { SovietContract } from 'cooptypes';
import {
  CHAIN_PORT,
  LOGGER_PORT,
  VAULT_PORT,
  type IChainPort,
  type ILoggerPort,
  type IVaultPort,
  type InnerChainAction,
  type InnerTransactResult,
} from '@coopenomics/innercoop';
import { SOVIET } from '../../domain/constants';

/** Строка реестра автоматизаций, как её отдаёт цепь. */
export type AutomatorRow = SovietContract.Tables.Automations.IAutomations;
/** Совет кооператива из таблицы boards. */
export type BoardRow = SovietContract.Tables.Boards.IBoards;
/** Решение на повестке из таблицы decisions. */
export type DecisionRow = SovietContract.Tables.Decisions.IDecision;

/** Подписанный голос робота: данные действия и знак. */
export interface RobotVoteAction {
  data: SovietContract.Actions.Decisions.VoteFor.IVoteForDecision;
  against: boolean;
}

/**
 * Чтение таблиц совета и проводка транзакций робота ключом кооператива.
 *
 * Голоса и утверждение робот подаёт от имени кооператива: контракт принимает
 * `votefor` с подписью кооператива, а `authorize`/`exec` требуют её всегда.
 * Подписи самих членов совета лежат в данных действий — их ставит
 * `RobotDecisionService` ключами разрешений робота.
 */
@Injectable()
export class RobotChainService {
  constructor(
    @Inject(CHAIN_PORT) private readonly chain: IChainPort,
    @Inject(VAULT_PORT) private readonly vault: IVaultPort,
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort
  ) {
    this.logger.setContext(RobotChainService.name);
  }

  async getAutomations(coopname: string): Promise<AutomatorRow[]> {
    return this.chain.getAllRows<AutomatorRow>(SOVIET, coopname, SovietContract.Tables.Automations.tableName);
  }

  async getSovietBoard(coopname: string): Promise<BoardRow | null> {
    const boards = await this.chain.getAllRows<BoardRow>(SOVIET, coopname, SovietContract.Tables.Boards.tableName);
    return boards.find((b) => b.type === 'soviet') ?? null;
  }

  async getDecision(coopname: string, decision_id: number): Promise<DecisionRow | null> {
    return this.chain.getSingleRow<DecisionRow>(SOVIET, coopname, SovietContract.Tables.Decisions.tableName, decision_id);
  }

  /** Голоса делегировавших членов совета одной транзакцией от имени кооператива: «за» и «против» вперемешку. */
  async submitVotes(coopname: string, votes: RobotVoteAction[]): Promise<string> {
    const actions: InnerChainAction[] = votes.map((vote) => ({
      account: SOVIET,
      name: vote.against ? SovietContract.Actions.Decisions.VoteAgainst.actionName : SovietContract.Actions.Decisions.VoteFor.actionName,
      authorization: [{ actor: coopname, permission: 'active' }],
      data: vote.data,
    }));
    return this.transactAsCoop(coopname, actions);
  }

  /** Утверждение протоколом и исполнение — одной транзакцией от имени кооператива. */
  async authorizeAndExec(
    coopname: string,
    chairman: string,
    decision_id: number,
    document: SovietContract.Actions.Decisions.Authorize.IAuthorize['document'],
    permission: string
  ): Promise<string> {
    const authorize: SovietContract.Actions.Decisions.Authorize.IAuthorize = { coopname, chairman, decision_id, document, permission };
    const exec: SovietContract.Actions.Decisions.Exec.IExec = { executer: chairman, coopname, decision_id };
    return this.transactAsCoop(coopname, [
      {
        account: SOVIET,
        name: SovietContract.Actions.Decisions.Authorize.actionName,
        authorization: [{ actor: coopname, permission: 'active' }],
        data: authorize,
      },
      {
        account: SOVIET,
        name: SovietContract.Actions.Decisions.Exec.actionName,
        authorization: [{ actor: coopname, permission: 'active' }],
        data: exec,
      },
    ]);
  }

  private async transactAsCoop(coopname: string, actions: InnerChainAction[]): Promise<string> {
    const wif = await this.vault.getWif(coopname);
    if (!wif) throw new Error(`В хранилище нет ключа кооператива ${coopname} — роботу нечем подписать транзакцию`);
    this.chain.initialize(coopname, wif);
    const result = await this.chain.transact(actions);
    return RobotChainService.transactionId(result);
  }

  static transactionId(result: InnerTransactResult): string {
    return String(result?.response?.transaction_id ?? result?.resolved?.transaction?.id ?? '');
  }
}
