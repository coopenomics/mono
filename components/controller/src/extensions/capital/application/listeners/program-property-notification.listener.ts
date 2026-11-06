import { Inject, Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { CapitalContract } from 'cooptypes';
import { AssetUtils, platformSettings } from '@coopenomics/extension-kit';
import { LOGGER_PORT, NOTIFICATION_PORT, type ILoggerPort, type INotificationPort, type InnerChainActionRecord } from '@coopenomics/innercoop';
import { Workflows } from '@coopenomics/notifications';
import { PROGRAM_PROPERTY_REPOSITORY, type ProgramPropertyRepository } from '../../domain/repositories/program-property.repository';
import { PropertyManagementInteractor } from '../use-cases/property-management.interactor';

/**
 * Уведомления пайщику по паевому взносу имуществом в «Благорост»: председатель
 * одобрил заявление — вопрос на голосовании совета; председатель подписал акт —
 * взнос принят и зачислен. Общее «запрос одобрен» ядро шлёт само; эти
 * уведомления говорят, что произошло со взносом и что дальше.
 */
@Injectable()
export class ProgramPropertyNotificationListener {
  constructor(
    @Inject(PROGRAM_PROPERTY_REPOSITORY) private readonly properties: ProgramPropertyRepository,
    private readonly interactor: PropertyManagementInteractor,
    @Inject(NOTIFICATION_PORT) private readonly notifications: INotificationPort,
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort
  ) {
    this.logger.setContext(ProgramPropertyNotificationListener.name);
  }

  /** Председатель одобрил заявление (approvepgprp, ключ — хэш заявления). */
  @OnEvent(`action::${CapitalContract.contractName.production}::${CapitalContract.Actions.ApproveProgramProperty.actionName}`)
  async onStatementApproved(action: InnerChainActionRecord): Promise<void> {
    await this.notify(action, Workflows.CapitalPropertyStatementApproved.id);
  }

  /** Председатель подписал акт (act2pgprp, ключ — хэш акта): взнос зачислен. */
  @OnEvent(`action::${CapitalContract.contractName.production}::${CapitalContract.Actions.Act2ProgramProperty.actionName}`)
  async onAccepted(action: InnerChainActionRecord): Promise<void> {
    await this.notify(action, Workflows.CapitalPropertyAccepted.id);
  }

  private async notify(action: InnerChainActionRecord, workflowId: string): Promise<void> {
    // Уведомления получателям (require_recipient) приходят тем же именем — шлём один раз.
    if (action.receiver !== action.account) return;
    try {
      const property = await this.properties.findByStepHash(String(action.data?.property_hash ?? ''));
      if (!property?.username) return;
      const { coopname, frontendUrl } = platformSettings();
      await this.notifications.notifyUser(property.username, workflowId, {
        propertyName: this.interactor.positionOf(property).property_name,
        amount: formatAmount(property.property_amount),
        coopname,
        deepLinkUrl: `${frontendUrl}/${coopname}/capital/contributions`,
      });
    } catch (e) {
      // Уведомление — не часть процесса: сбой пишется в журнал, взнос идёт дальше.
      this.logger.warn(`уведомление по взносу имуществом: ${(e as Error)?.message ?? e}`);
    }
  }
}

/** «10000.0000 RUB» → «10 000,00 RUB» — как сумма на столе пайщика. */
function formatAmount(asset?: string): string {
  if (!asset) return '';
  const { amount, symbol } = AssetUtils.parseAsset(asset);
  return `${amount.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${symbol}`;
}
