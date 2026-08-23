import { Injectable, OnModuleInit } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type { IAction, IDelta } from '~/types/common';
import { ParserInteractor } from '../interactors/parser.interactor';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import { config } from '~/config';

/**
 * Доменный сервис для обработки событий блокчейна
 * Подписывается на события от BlockchainConsumerService и сохраняет данные в базу
 */
@Injectable()
export class BlockchainEventHandlerService implements OnModuleInit {
  constructor(private readonly parserInteractor: ParserInteractor, private readonly logger: WinstonLoggerService) {
    this.logger.setContext(BlockchainEventHandlerService.name);
  }

  async onModuleInit() {
    this.logger.log('Сервис обработчика событий блокчейна инициализирован');
  }

  /**
   * Обработка события действия блокчейна
   * Сохраняет действие в базу данных
   */
  @OnEvent('action::*')
  async handleActionEvent(action: IAction): Promise<void> {
    try {
      this.logger.debug(`Handling action event: ${action.name} from ${action.account}`);

      // Преобразование данных действия для сохранения
      const actionData = {
        transaction_id: action.transaction_id || '',
        account: action.account,
        block_num: Number(action.block_num),
        block_id: action.block_id || '',
        // Время блока пишем как есть — строкой из потока; в `timestamptz`
        // её переводит трансформер сущности. Отсутствие времени законно.
        block_time: action.block_time,
        chain_id: action.chain_id || '',
        name: action.name,
        receiver: action.receiver,
        authorization: action.authorization || [],
        data: action.data || {},
        action_ordinal: action.action_ordinal || 0,
        global_sequence: action.global_sequence || '',
        account_ram_deltas: action.account_ram_deltas || [],
        console: action.console,
        receipt: action.receipt || {
          receiver: action.receiver,
          act_digest: '',
          global_sequence: action.global_sequence || '',
          recv_sequence: '',
          auth_sequence: [],
          code_sequence: 0,
          abi_sequence: 0,
        },
        creator_action_ordinal: action.creator_action_ordinal || 0,
        context_free: action.context_free || false,
        elapsed: action.elapsed || 0,
      };

      await this.parserInteractor.saveAction(actionData);
      this.logger.debug(`Action saved: ${action.account}::${action.name} with global_sequence ${action.global_sequence}`);
    } catch (error: any) {
      this.logger.error(`Ошибка обработки события действия: ${error.message}`, error.stack);
      throw error; // Перебрасываем ошибку для корректной обработки
    }
  }

  /**
   * Обработка события дельты блокчейна
   * Сохраняет дельту в базу данных
   */
  @OnEvent('delta::*')
  async handleDeltaEvent(delta: IDelta): Promise<void> {
    try {
      this.logger.debug(`Handling delta event: ${delta.table} from ${delta.code}`);

      // Преобразование данных дельты для сохранения
      const deltaData = {
        chain_id: delta.chain_id || '',
        block_num: Number(delta.block_num),
        block_id: delta.block_id || '',
        // Время блока пишем как есть — строкой из потока; в `timestamptz`
        // её переводит трансформер сущности. Отсутствие времени законно.
        block_time: delta.block_time,
        present: delta.present,
        code: delta.code,
        scope: delta.scope,
        table: delta.table,
        primary_key: delta.primary_key,
        value: delta.value,
      };

      await this.parserInteractor.saveDelta(deltaData);
      this.logger.debug(`Delta saved: ${delta.code}::${delta.table} with primary_key ${delta.primary_key}`);
    } catch (error: any) {
      this.logger.error(`Ошибка обработки события дельты: ${error.message}`, error.stack);
      throw error; // Перебрасываем ошибку для корректной обработки
    }
  }
}
