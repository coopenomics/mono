import { Inject, Injectable } from '@nestjs/common';
import { platformSettings } from '@coopenomics/extension-kit';
import {
  LOGGER_PORT,
  type ILoggerPort,
  type ISovietRobotPort,
  type InnerRobotDecisionOutcome,
  type InnerRobotDecisionRequest,
  type InnerRobotDecisionResult,
} from '@coopenomics/innercoop';
import { RobotDecisionStage } from '../../domain/enums/robot-decision-stage.enum';
import type { RobotDecisionDomainEntity } from '../../domain/entities/robot-decision.entity';
import { ROBOT_DECISION_REPOSITORY, type RobotDecisionRepository } from '../../domain/repositories/robot-decision.repository';
import { RobotWatchdogService } from '../services/robot-watchdog.service';

/**
 * Порт робота для других расширений (Стол заказов): прямой вызов «реши сейчас»
 * и ожидание ответа у стойки — вместо подписки на событие повестки, которое
 * робот и так слушает, но приходит через парсер с задержкой.
 *
 * Вызов идемпотентен: запись журнала создаётся один раз на номер решения
 * (та же, что заводит `newsubmitted`), проход по решению сериализуется
 * сторожем. Робот идёт двумя транзакциями (голоса, затем протокол) и между
 * ними ждёт события голоса из парсера; здесь его подгоняем повторными
 * проходами, чтобы у стойки не ждать тика сторожа. Ответ — итог проходов
 * робота, не итог решения: «утверждено» значит, что протокол ушёл в цепь;
 * исход до контракта-инициатора доводит обратный вызов совета через парсер.
 */
@Injectable()
export class SovietRobotInnercoopAdapter implements ISovietRobotPort {
  private static readonly MAX_PASSES = 3;
  /** Этапы, на которых робот ещё работает сам и его можно подогнать следующим проходом. */
  private static readonly PROGRESSING = new Set<RobotDecisionStage>([
    RobotDecisionStage.NEW,
    RobotDecisionStage.VOTED,
    RobotDecisionStage.AWAITING_PROTOCOL,
  ]);
  private readonly coopname = platformSettings().coopname;

  constructor(
    @Inject(ROBOT_DECISION_REPOSITORY) private readonly journal: RobotDecisionRepository,
    private readonly watchdog: RobotWatchdogService,
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort
  ) {
    this.logger.setContext(SovietRobotInnercoopAdapter.name);
  }

  async isEnabled(): Promise<boolean> {
    return this.watchdog.isEnabled();
  }

  async requestDecision(input: InnerRobotDecisionRequest): Promise<InnerRobotDecisionResult> {
    if (input.coopname !== this.coopname) {
      return { outcome: 'failed', detail: `робот обслуживает кооператив ${this.coopname}, запрошен ${input.coopname}` };
    }
    if (!(await this.isEnabled())) {
      return { outcome: 'manual', detail: 'расширение «Робот совета» не установлено или выключено' };
    }
    const entry =
      (await this.journal.findByDecision(input.coopname, input.decision_id)) ??
      (await this.journal.createIfAbsent({
        coopname: input.coopname,
        decision_id: input.decision_id,
        decision_type: input.decision_type,
        decision_hash: input.decision_hash,
        username: input.username,
        stage: RobotDecisionStage.NEW,
      }));
    let result = await this.watchdog.processNow(entry);
    // Голоса ушли (VOTED) или протокол собирается — дожимаем сразу, пока
    // этап меняется; остановка на людях или ошибка выходят из цикла.
    for (let pass = 0; pass < SovietRobotInnercoopAdapter.MAX_PASSES && SovietRobotInnercoopAdapter.PROGRESSING.has(result.stage); pass++) {
      const before = result.stage;
      result = await this.watchdog.processNow(result);
      if (result.stage === before && result.last_error) break;
    }
    const outcome = SovietRobotInnercoopAdapter.outcomeOf(result);
    this.logger.log(`Решение ${input.decision_id} (${input.decision_type}): проход робота → ${result.stage}, исход для инициатора «${outcome.outcome}».`);
    return outcome;
  }

  /**
   * Этап журнала → что делать инициатору (семантика порта):
   *  - EXECUTED — `authorized`: протокол утверждён, ждать обратный вызов совета;
   *  - AWAITING_QUORUM / AWAITING_FOLLOWED / AWAITING_CHAIRMAN, а также
   *    NEW / VOTED / AWAITING_PROTOCOL после проходов и CLOSED (повестки уже
   *    нет) — `pending`: робот сам не довёл, решают люди, у стойки не ждать;
   *  - FAILED — `failed`: попытки исчерпаны, нужен ручной повтор администратором.
   */
  static outcomeOf(entry: RobotDecisionDomainEntity): InnerRobotDecisionResult {
    const detail = entry.last_error ?? undefined;
    const tx_hash = entry.tx_hashes.length ? entry.tx_hashes[entry.tx_hashes.length - 1] : undefined;
    const map: Record<RobotDecisionStage, InnerRobotDecisionOutcome> = {
      [RobotDecisionStage.NEW]: 'pending',
      [RobotDecisionStage.AWAITING_FOLLOWED]: 'pending',
      [RobotDecisionStage.VOTED]: 'pending',
      [RobotDecisionStage.AWAITING_QUORUM]: 'pending',
      [RobotDecisionStage.AWAITING_CHAIRMAN]: 'pending',
      [RobotDecisionStage.AWAITING_PROTOCOL]: 'pending',
      [RobotDecisionStage.EXECUTED]: 'authorized',
      [RobotDecisionStage.CLOSED]: 'pending',
      [RobotDecisionStage.FAILED]: 'failed',
    };
    const outcome = map[entry.stage] ?? 'pending';
    const waiting = entry.waiting_for.length ? `ждёт голоса: ${entry.waiting_for.join(', ')}` : undefined;
    return { outcome, tx_hash, detail: detail ?? waiting };
  }
}
