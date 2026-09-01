/**
 * Прекращение членства: отзыв подтверждения по событиям цепи (story 7.3, FR-E3).
 *
 * Выход из кооператива — процесс из нескольких действий, и отзывать
 * подтверждение можно только по его завершении: заявление о выходе совет может
 * и отклонить, а карта пайщика всё это время должна показывать членство
 * действующим.
 *
 * Пайщик запоминается в начале процесса намеренно. Завершающее действие
 * `completexit` называет только процесс, а запись о выходе контракт к этому
 * моменту уже удалил — спросить у цепи, чей это был выход, поздно.
 */
import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { RegistratorContract } from 'cooptypes';
import type { InnerChainActionRecord } from '@coopenomics/innercoop';
import { platformSettings } from '@coopenomics/extension-kit';
import { LOGGER_PORT, type ILoggerPort } from '@coopenomics/innercoop';
import { Inject } from '@nestjs/common';
import { CardcoopExtension } from '../cardcoop.extension';
import { CardcoopMembershipService } from './membership.service';

/** Действия процесса выхода. В `cooptypes` объявлено только начало процесса, остальные — по имени в цепи. */
const CONTRACT = RegistratorContract.contractName.production;
const COMPLETE_EXIT = 'completexit';
const DECLINE_EXIT = 'declinexit';

@Injectable()
export class CardcoopExitEventsService {
  constructor(
    private readonly membership: CardcoopMembershipService,
    private readonly extension: CardcoopExtension,
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort
  ) {
    this.logger.setContext(CardcoopExitEventsService.name);
  }

  /** Пайщик подал заявление о выходе — запоминаем, чей это процесс. */
  @OnEvent(`action::${CONTRACT}::${RegistratorContract.Actions.ExitCoop.actionName}`)
  async handleExitRequested(actionData: InnerChainActionRecord): Promise<void> {
    const action = actionData.data as { coopname?: string; username?: string; exit_hash?: string };
    if (!this.isOurs(action.coopname) || !action.username || !action.exit_hash) return;

    try {
      await this.membership.rememberExit(action.exit_hash, action.username, action.coopname as string);
    } catch (error) {
      // Промах здесь означает, что при завершении выхода мы не узнаем пайщика,
      // а подтверждение останется действующим на прекращённом членстве.
      this.logger.error(
        `Не удалось запомнить выход ${action.exit_hash} пайщика ${action.username}: ${describe(error)}`
      );
    }
  }

  /** Выход завершён — членство прекращено, подтверждение отзывается. */
  @OnEvent(`action::${CONTRACT}::${COMPLETE_EXIT}`)
  async handleExitCompleted(actionData: InnerChainActionRecord): Promise<void> {
    const action = actionData.data as { coopname?: string; exit_hash?: string };
    if (!this.isOurs(action.coopname) || !action.exit_hash) return;

    try {
      await this.membership.revokeByCompletedExit(this.apiUrl, action.exit_hash);
    } catch (error) {
      this.logger.error(`Отзыв подтверждения по выходу ${action.exit_hash} не выполнен: ${describe(error)}`);
    }
  }

  /** Совет отклонил заявление — членство сохраняется, отзывать нечего. */
  @OnEvent(`action::${CONTRACT}::${DECLINE_EXIT}`)
  async handleExitDeclined(actionData: InnerChainActionRecord): Promise<void> {
    const action = actionData.data as { coopname?: string; exit_hash?: string };
    if (!this.isOurs(action.coopname) || !action.exit_hash) return;

    try {
      await this.membership.forgetExit(action.exit_hash);
    } catch (error) {
      this.logger.error(`Не удалось забыть отклонённый выход ${action.exit_hash}: ${describe(error)}`);
    }
  }

  /**
   * Действие относится к нашему кооперативу.
   *
   * Узел видит действия всей цепи, а свидетельствует кооператив только о своих
   * пайщиках: без этой проверки чужой выход отозвал бы наше подтверждение.
   */
  private isOurs(coopname: string | undefined): boolean {
    return Boolean(coopname) && coopname === platformSettings().coopname;
  }

  private get apiUrl(): string {
    return this.extension.config.api_url;
  }
}

const describe = (error: unknown): string => (error instanceof Error ? error.message : String(error));
