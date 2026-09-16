import { Inject, Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type { PubSub } from 'graphql-subscriptions';
import { Ledger2Contract } from 'cooptypes';
import { PUB_SUB } from '~/infrastructure/pubsub/pubsub.module';
import config from '~/config/config';
import { WalletChangedEventDTO } from '../dto/wallet-event.dto';
import type { IDelta } from '@coopenomics/extension-kit/sync';

/** Персональный топик кошельков пайщика. */
export function walletEventsTopic(coopname: string, username: string): string {
  return `wallet:${coopname}:${username}`;
}

/**
 * Издатель сигналов об изменении кошелька пайщика.
 *
 * Баланс живёт в цепи, а узел узнаёт о его изменении из дельты таблицы
 * `ledger2::userwallets`. До этого интерфейс перечитывал кошелёк только по
 * собственному поводу (перезаход на страницу, редкий опрос), поэтому пополнение
 * появлялось в карточке пайщика с задержкой в минуты: уведомление приходило
 * раньше, чем сумма.
 *
 * Принцип тот же, что у событий Стола заказов: шлём сигнал, а не данные —
 * клиент по сигналу дочитывает авторитетное состояние.
 */
@Injectable()
export class WalletEventsService {
  constructor(@Inject(PUB_SUB) private readonly pubSub: PubSub) {}

  @OnEvent(
    `delta::${Ledger2Contract.contractName.production}::${Ledger2Contract.Tables.UserWallets.tableName}`
  )
  async handleUserWalletDelta(delta: IDelta): Promise<void> {
    // Удаление строки кошелька значения не несёт: остаток равен нулю и его
    // покажет та же дочитка, а `value` у снятой строки пуст.
    if (!delta?.present) return;
    if (delta.scope !== config.coopname) return;

    const value = delta.value as Ledger2Contract.Tables.UserWallets.IUserWallet | undefined;
    const username = value?.username ? String(value.username) : '';
    if (!username) return;

    const event: WalletChangedEventDTO = {
      coopname: String(delta.scope),
      username,
      wallet_name: String(value?.wallet_name ?? ''),
    };
    await this.pubSub.publish(walletEventsTopic(event.coopname, username), {
      walletEvents: event,
    });
  }
}
