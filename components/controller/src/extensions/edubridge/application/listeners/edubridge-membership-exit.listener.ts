import { Inject, Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { RegistratorContract } from 'cooptypes';
import { LOGGER_PORT, type ILoggerPort, type InnerChainActionRecord } from '@coopenomics/innercoop';
import { EdubridgeExpiryWorker } from '../workers/edubridge-expiry.worker';

/**
 * Выход пайщика из кооператива (`registrator::exitcoop` — заявление подано):
 * подписки его обучающихся закрываются, доступ отзывается. Отзыв по заявлению,
 * а не по финальному расчёту: членство кончается с выходом, а не с возвратом.
 */
@Injectable()
export class EdubridgeMembershipExitListener {
  constructor(
    private readonly expiry: EdubridgeExpiryWorker,
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort
  ) {
    this.logger.setContext(EdubridgeMembershipExitListener.name);
  }

  @OnEvent(`action::${RegistratorContract.contractName.production}::${RegistratorContract.Actions.ExitCoop.actionName}`)
  async onExit(action: InnerChainActionRecord): Promise<void> {
    const data = action.data as RegistratorContract.Actions.ExitCoop.IExitCoop & { username?: string };
    if (!data?.coopname || !data?.username) return;
    await this.expiry.revokeAllForMember(String(data.coopname), String(data.username), `exitcoop ${action.transaction_id}`);
  }
}
