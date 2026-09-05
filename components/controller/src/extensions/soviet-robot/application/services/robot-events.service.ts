import { Inject, Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { SovietContract } from 'cooptypes';
import { LOGGER_PORT, type ILoggerPort, type InnerChainActionRecord } from '@coopenomics/innercoop';
import { platformSettings } from '@coopenomics/extension-kit';
import { SOVIET } from '../../domain/constants';
import { ROBOT_ACTIVE_STAGES, RobotDecisionStage } from '../../domain/enums/robot-decision-stage.enum';
import { ROBOT_DECISION_REPOSITORY, type RobotDecisionRepository } from '../../domain/repositories/robot-decision.repository';
import { RobotKeyService } from './robot-key.service';
import { RobotWatchdogService } from './robot-watchdog.service';

/**
 * Слушатели событий цепи. Робот работает только от событий цепи через парсер
 * и от собственного журнала: без записи в журнале он ничего не подписывает.
 */
@Injectable()
export class RobotEventsService {
  private readonly coopname = platformSettings().coopname;

  constructor(
    @Inject(ROBOT_DECISION_REPOSITORY) private readonly journal: RobotDecisionRepository,
    private readonly keys: RobotKeyService,
    private readonly watchdog: RobotWatchdogService,
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort
  ) {
    this.logger.setContext(RobotEventsService.name);
  }

  /** Новая повестка: запись журнала и немедленная попытка проголосовать. */
  @OnEvent(`action::${SOVIET}::${SovietContract.Actions.Registry.NewSubmitted.actionName}`)
  async onNewSubmitted(action: InnerChainActionRecord): Promise<void> {
    try {
      if (action.receiver !== SOVIET) return;
      const data = action.data as SovietContract.Actions.Registry.NewSubmitted.INewSubmitted;
      const decisionId = Number(data?.decision_id ?? 0);
      if (!data?.coopname || data.coopname !== this.coopname || decisionId <= 0) return;
      if (!(await this.watchdog.isEnabled())) return;

      const entry = await this.journal.createIfAbsent({
        coopname: data.coopname,
        decision_id: decisionId,
        decision_type: String(data.action),
        decision_hash: String(data.package),
        username: String(data.username),
        stage: RobotDecisionStage.NEW,
      });
      await this.watchdog.processNow(entry);
    } catch (e: any) {
      this.logger.error(`newsubmitted: ${e?.message}`, e?.stack);
    }
  }

  /**
   * Голос по решению: главный сигнал для робота. Голос председателя — команда
   * повторить за ним, любой другой голос двигает решение к кворуму.
   */
  @OnEvent(`action::${SOVIET}::${SovietContract.Actions.Decisions.VoteFor.actionName}`)
  async onVoteFor(action: InnerChainActionRecord): Promise<void> {
    try {
      const data = action.data as SovietContract.Actions.Decisions.VoteFor.IVoteForDecision;
      if (!data?.coopname || data.coopname !== this.coopname) return;
      const entry = await this.journal.findByDecision(data.coopname, Number(data.decision_id));
      if (!entry || !ROBOT_ACTIVE_STAGES.includes(entry.stage)) return;
      if (!(await this.watchdog.isEnabled())) return;
      await this.watchdog.processNow(entry);
    } catch (e: any) {
      this.logger.error(`votefor: ${e?.message}`, e?.stack);
    }
  }

  /** Председатель делегировал подпись протоколов: дожать решения, ждавшие его. */
  @OnEvent(`action::${SOVIET}::${SovietContract.Actions.Decisions.Automate.actionName}`)
  async onAutomate(action: InnerChainActionRecord): Promise<void> {
    try {
      const data = action.data as SovietContract.Actions.Decisions.Automate.IAutomate;
      if (!data?.coopname || data.coopname !== this.coopname) return;
      this.watchdog.wakeStage(RobotDecisionStage.AWAITING_CHAIRMAN);
    } catch (e: any) {
      this.logger.error(`automate: ${e?.message}`, e?.stack);
    }
  }

  /** Отзыв делегирования: ключ удаляется из хранилища сразу. */
  @OnEvent(`action::${SOVIET}::${SovietContract.Actions.Decisions.Disautomate.actionName}`)
  async onDisautomate(action: InnerChainActionRecord): Promise<void> {
    try {
      const data = action.data as SovietContract.Actions.Decisions.Disautomate.IDisautomate;
      if (!data?.coopname || data.coopname !== this.coopname || !data.member) return;
      await this.keys.revokeKey(data.coopname, String(data.member));
    } catch (e: any) {
      this.logger.error(`disautomate: ${e?.message}`, e?.stack);
    }
  }
}
