import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { v4 as uuid } from 'uuid';
import { MeetContract, SovietContract } from 'cooptypes';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import type { ActionDomainInterface } from '~/domain/parser/interfaces/action-domain.interface';
import { VARS_DATA_PORT, VarsDataPort } from '~/domain/system/ports/vars-data.port';
import type { AgreementNumberDomainInterface } from '~/domain/agreement/interfaces/agreement-number.interface';
import type { VarsDomainInterface } from '~/domain/system/interfaces/vars-domain.interface';
import { TrackingRuleRepository } from '../repositories/tracking-rule.repository';
import { IDecisionTrackingPort, CreateTrackingRuleInput, DecisionEventType, DecisionProcessedResult, TrackingRule, DecisionTrackedEvent } from '@coopenomics/innercoop';

/**
 * Адаптер для отслеживания решений
 * Реализует логику фабрики отслеживания решений и автоматического обновления vars
 */
@Injectable()
export class DecisionTrackingAdapter implements IDecisionTrackingPort, OnModuleInit {
  /** Сериализует patch vars — иначе параллельные newdecision перезаписывают друг друга. */
  private varsUpdateChain: Promise<void> = Promise.resolve();

  constructor(
    private readonly repository: TrackingRuleRepository,
    @Inject(VARS_DATA_PORT) private readonly varsPort: VarsDataPort,
    private readonly eventEmitter: EventEmitter2,
    private readonly logger: WinstonLoggerService
  ) {
    this.logger.setContext(DecisionTrackingAdapter.name);
  }

  async onModuleInit() {
    this.logger.info('Decision tracking adapter initialized');
  }

  async registerTrackingRule(input: CreateTrackingRuleInput): Promise<TrackingRule> {
    const rule: TrackingRule = {
      id: uuid(),
      hash: input.hash,
      event_type: input.event_type,
      vars_field: input.vars_field,
      metadata: input.metadata,
      active: true,
      created_at: new Date(),
    };

    await this.repository.save(rule);

    this.logger.info(`Зарегистрировано правило отслеживания: ${rule.id}`, {
      hash: rule.hash,
      event_type: rule.event_type,
      vars_field: rule.vars_field,
    });

    return rule;
  }

  async updateTrackingRuleHash(oldHash: string, newHash: string): Promise<void> {
    const rule = await this.repository.findByHash(oldHash);
    if (!rule) {
      this.logger.debug(`Правило с hash ${oldHash} не найдено для обновления`);
      return;
    }

    rule.hash = newHash;
    await this.repository.update(rule);

    this.logger.info(`Обновлен hash правила ${rule.id}: ${oldHash} -> ${newHash}`);
  }

  async getActiveRules(): Promise<TrackingRule[]> {
    return this.repository.findAllActive();
  }

  async getRuleByHash(hash: string): Promise<TrackingRule | null> {
    return this.repository.findByHash(hash);
  }

  async getRuleById(id: string): Promise<TrackingRule | null> {
    return this.repository.findById(id);
  }

  async deactivateRule(id: string): Promise<void> {
    const rule = await this.repository.findById(id);
    if (!rule) {
      throw new Error(`Правило ${id} не найдено`);
    }

    rule.active = false;
    await this.repository.update(rule);

    this.logger.info(`Деактивировано правило отслеживания: ${id}`);
  }

  async deleteRule(id: string): Promise<void> {
    await this.repository.delete(id);
    this.logger.info(`Удалено правило отслеживания: ${id}`);
  }

  /**
   * Обработчик решений совета
   */
  @OnEvent(`action::${SovietContract.contractName.production}::${SovietContract.Actions.Registry.NewDecision.actionName}`)
  async handleSovietDecision(actionData: ActionDomainInterface): Promise<void> {
    try {
      const data: any = actionData.data;
      const docHash = data.package;

      if (!docHash) {
        return;
      }

      const decisionId = this.extractDecisionId(data);
      const decisionDate = this.extractDecisionDate(data);

      this.logger.debug(`Обработка решения совета: hash=${docHash}, id=${decisionId}`);

      await this.processDecision({
        hash: String(docHash),
        event_type: 'soviet_decision' as DecisionEventType,
        decision_id: decisionId || undefined,
        decision_date: decisionDate || undefined,
      });
    } catch (error: any) {
      this.logger.error(`Ошибка при обработке решения совета: ${error.message}`, error.stack);
    }
  }

  /**
   * Обработчик решений общего собрания
   */
  @OnEvent(`action::${MeetContract.contractName.production}::${MeetContract.Actions.NewDecision.actionName}`)
  async handleMeetDecision(actionData: ActionDomainInterface): Promise<void> {
    try {
      const data: any = actionData.data;
      const meetHash = data.hash;

      if (!meetHash) {
        return;
      }

      this.logger.debug(`Обработка решения общего собрания: hash=${meetHash}`);

      await this.processDecision({
        hash: String(meetHash),
        event_type: 'meet_decision' as DecisionEventType,
      });
    } catch (error: any) {
      this.logger.error(`Ошибка при обработке решения общего собрания: ${error.message}`, error.stack);
    }
  }

  /**
   * Обработчик перезапуска общего собрания
   */
  @OnEvent(`action::${MeetContract.contractName.production}::${MeetContract.Actions.RestartMeet.actionName}`)
  async handleMeetRestart(actionData: ActionDomainInterface): Promise<void> {
    try {
      const data: MeetContract.Actions.RestartMeet.IInput = actionData.data;

      const oldHash = data.hash;
      const newHash = data.new_hash;

      if (!oldHash || !newHash) {
        return;
      }

      this.logger.debug(`Обработка перезапуска собрания: ${oldHash} -> ${newHash}`);

      await this.updateTrackingRuleHash(String(oldHash), String(newHash));
    } catch (error: any) {
      this.logger.error(`Ошибка при обработке перезапуска собрания: ${error.message}`, error.stack);
    }
  }

  /**
   * Основная логика обработки решения
   */
  private async processDecision(params: {
    hash: string;
    event_type: DecisionEventType;
    decision_id?: string;
    decision_date?: string;
  }): Promise<void> {
    const { hash, event_type, decision_id, decision_date } = params;

    // Ищем правило с соответствующим hash и типом события
    const rule = await this.repository.findByHash(hash);

    if (!rule) {
      this.logger.debug(`Правило для hash ${hash} не найдено`);
      return;
    }

    if (rule.event_type !== event_type) {
      this.logger.debug(
        `Тип события не совпадает для правила ${rule.id}: ожидается ${rule.event_type}, получено ${event_type}`
      );
      return;
    }

    // Проверяем, не было ли правило уже деактивировано (обработано ранее)
    if (!rule.active) {
      this.logger.debug(`Правило ${rule.id} уже обработано ранее`);
      return;
    }

    // Обновляем vars
    if (decision_id && decision_date) {
      await this.updateVars(rule.vars_field, decision_id, decision_date);
    }

    // Деактивируем правило после обработки
    await this.deactivateRule(rule.id);

    // Формируем результат
    const result: DecisionProcessedResult = {
      matched: true,
      rule_id: rule.id,
      hash,
      event_type,
      vars_field: rule.vars_field,
      decision_id,
      decision_date,
      metadata: rule.metadata,
    };

    // Эмитим событие для пост-обработки
    this.eventEmitter.emit(DecisionTrackedEvent.eventName, new DecisionTrackedEvent(result));

    this.logger.info(`Решение обработано по правилу ${rule.id}`, {
      hash,
      vars_field: rule.vars_field,
      decision_id,
    });
  }

  /**
   * Обновляет одно поле vars. Запросы идут в очереди: при быстром утверждении
   * нескольких решений подряд каждый patch читает актуальный snapshot.
   */
  private async updateVars(varsField: string, decisionId: string, decisionDate: string): Promise<void> {
    const applyPatch = async (): Promise<void> => {
      const currentVars = await this.varsPort.get();
      if (!currentVars) {
        this.logger.warn('Vars не найдены, пропускаем обновление');
        return;
      }

      const agreementNumber: AgreementNumberDomainInterface = {
        protocol_number: String(decisionId),
        protocol_day_month_year: String(decisionDate),
      };

      const updatedVars: VarsDomainInterface = {
        ...currentVars,
        [varsField]: agreementNumber,
      };

      await this.varsPort.create(updatedVars);
      this.logger.info(`Обновлено поле vars: ${varsField} = ${decisionId} от ${decisionDate}`);
    };

    this.varsUpdateChain = this.varsUpdateChain.then(applyPatch, applyPatch);

    try {
      await this.varsUpdateChain;
    } catch (error: any) {
      this.logger.error(`Ошибка при обновлении vars: ${error.message}`, error.stack);
    }
  }

  /**
   * Извлекает decision_id из document.meta
   */
  private extractDecisionId(data: any): string | null {
    try {
      const meta = data?.document?.meta;
      if (!meta) return null;

      let metaObj: any;
      if (typeof meta === 'string') {
        try {
          metaObj = JSON.parse(meta);
        } catch {
          return null;
        }
      } else {
        metaObj = meta;
      }

      return metaObj?.decision_id || null;
    } catch (error) {
      this.logger.error('Ошибка при извлечении decision_id:', error instanceof Error ? error.message : String(error));
      return null;
    }
  }

  /**
   * Извлекает дату решения из document.meta
   */
  private extractDecisionDate(data: any): string | null {
    try {
      const meta = data?.document?.meta;
      if (!meta) return null;

      let metaObj: any;
      if (typeof meta === 'string') {
        try {
          metaObj = JSON.parse(meta);
        } catch {
          return null;
        }
      } else {
        metaObj = meta;
      }

      return metaObj?.created_at || null;
    } catch (error) {
      this.logger.error('Ошибка при извлечении даты решения:', error instanceof Error ? error.message : String(error));
      return null;
    }
  }
}
