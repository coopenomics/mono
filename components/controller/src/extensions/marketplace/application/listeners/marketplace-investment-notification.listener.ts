import { Inject, Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { MarketContract } from 'cooptypes';
import { Workflows } from '@coopenomics/notifications';
import {
  ACCOUNT_PORT,
  LOGGER_PORT,
  NOTIFICATION_PORT,
  type IAccountPort,
  type ILoggerPort,
  type INotificationPort,
  type InnerChainActionRecord,
} from '@coopenomics/innercoop';
import { AmountFormatterUtils, platformSettings } from '@coopenomics/extension-kit';
import { MARKETPLACE_CANONICAL_BLOCKCHAIN_PORT, type MarketplaceCanonicalBlockchainPort } from '../../domain/ports/marketplace-canonical-blockchain.port';
import { MarketplaceKuChairmanService } from '../services/marketplace-ku-chairman.service';
import { MarketplaceInvestPhase, MarketplaceInvestmentService } from '../services/marketplace-investment.service';
import { MARKETPLACE_ECONOMY_SERVICE, MarketplaceEconomyService } from '../services/marketplace-economy.service';
import { t } from '../../i18n';
import { MARKETPLACE_INVEST_REPAID_EVENT, type MarketplaceInvestRepaidEvent } from '../events/marketplace-notification.events';

const MARKET = MarketContract.contractName.production;

/** Наименование имущества из описания заявления: часть до запятой. */
function propertyNameOf(description: string): string {
  return description.split(',')[0]?.trim() || description;
}

/**
 * Уведомления инвестиционного этапа участка (задача 99D-30): председателю
 * участка — о новом заявлении на имущество, вносящему — о решении совета,
 * инициаторам — о возмещении паевых взносов после прохода списания.
 * Слушает действия контракта: событие приходит после разбора блока, строка
 * заявления на момент решения ещё в цепи (стирается только отказом и второй
 * подписью акта), а при отказе вносящего называет повестка совета.
 * Ошибка доставки уведомления действие не задерживает — только журнал.
 */
@Injectable()
export class MarketplaceInvestmentNotificationListener {
  constructor(
    @Inject(MARKETPLACE_CANONICAL_BLOCKCHAIN_PORT) private readonly chainPort: MarketplaceCanonicalBlockchainPort,
    @Inject(NOTIFICATION_PORT) private readonly notifications: INotificationPort,
    @Inject(ACCOUNT_PORT) private readonly accountPort: IAccountPort,
    private readonly kuChairmanService: MarketplaceKuChairmanService,
    private readonly investmentService: MarketplaceInvestmentService,
    @Inject(MARKETPLACE_ECONOMY_SERVICE) private readonly economyService: MarketplaceEconomyService,
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort
  ) {
    this.logger.setContext(MarketplaceInvestmentNotificationListener.name);
  }

  @OnEvent(`action::${MARKET}::${MarketContract.Actions.CreateIProp.actionName}`)
  async onCreated(action: InnerChainActionRecord): Promise<void> {
    const data = action.data as MarketContract.Actions.CreateIProp.ICreateIProp;
    await this.safely(t('marketplace.investment.notifyPropertySubmittedWhat'), async () => {
      const coopname = String(data.coopname);
      const trustee = await this.kuChairmanService.getTrusteeOfBranch(coopname, String(data.braname));
      if (!trustee) return;
      const payload: Workflows.MarketplaceInvestPropertySubmitted.IPayload = {
        userName: await this.accountPort.getDisplayName(trustee),
        investorName: await this.accountPort.getDisplayName(String(data.username)),
        propertyName: propertyNameOf(String(data.description)),
        amount: String(data.amount),
        branchName: (await this.accountPort.getDisplayName(String(data.braname))) || String(data.braname),
        coopname,
        deepLinkUrl: this.pageUrl(coopname),
      };
      await this.notifications.notifyUser(trustee, Workflows.MarketplaceInvestPropertySubmitted.id, payload);
    });
  }

  @OnEvent(`action::${MARKET}::onipropauth`)
  async onAuthorized(action: InnerChainActionRecord): Promise<void> {
    await this.decided(action, t('marketplace.investment.propertyAuthorized'));
  }

  @OnEvent(`action::${MARKET}::onipropdecl`)
  async onDeclined(action: InnerChainActionRecord): Promise<void> {
    await this.decided(action, t('marketplace.investment.propertyDeclined'));
  }

  private async decided(action: InnerChainActionRecord, decision: string): Promise<void> {
    const data = action.data as { coopname: string; hash: string };
    await this.safely(t('marketplace.investment.notifyPropertyDecidedWhat'), async () => {
      const coopname = String(data.coopname);
      const hash = String(data.hash).toLowerCase();
      const prop = await this.chainPort.getInvestProperty(coopname, hash);
      const councilDecision = prop ? null : await this.chainPort.findCouncilDecisionByHash(coopname, hash);
      const username = prop?.username ?? councilDecision?.username;
      if (!username) return;
      const payload: Workflows.MarketplaceInvestPropertyDecided.IPayload = {
        userName: await this.accountPort.getDisplayName(String(username)),
        propertyName: prop ? propertyNameOf(prop.description) : '',
        branchName: prop ? (await this.accountPort.getDisplayName(prop.braname)) || prop.braname : '',
        decision,
        coopname,
        deepLinkUrl: this.pageUrl(coopname),
      };
      await this.notifications.notifyUser(String(username), Workflows.MarketplaceInvestPropertyDecided.id, payload);
    });
  }

  /**
   * Доля инициаторов возместила паевые взносы: каждому инициатору участка с
   * доступной суммой — одно уведомление за проход. Сумма — предпросмотр по
   * формуле контракта, как на странице «Инициаторы участка».
   */
  @OnEvent(MARKETPLACE_INVEST_REPAID_EVENT)
  async onRepaid(event: MarketplaceInvestRepaidEvent): Promise<void> {
    for (const braname of event.branames) {
      await this.safely(t('marketplace.investment.notifyRepaidWhat'), async () => {
        const view = await this.investmentService.getBranchInvestment(event.coopname, braname);
        const status =
          view.phase === MarketplaceInvestPhase.RETURNED
            ? t('marketplace.investment.repaidFully')
            : t('marketplace.investment.repaidOngoing');
        const branchName = (await this.accountPort.getDisplayName(braname)) || braname;
        for (const investor of view.investors) {
          const available = await this.investmentService.previewClaim(event.coopname, braname, investor.username);
          if (available <= 0n) continue;
          const payload: Workflows.MarketplaceInvestReturned.IPayload = {
            userName: await this.accountPort.getDisplayName(investor.username),
            branchName,
            amount: AmountFormatterUtils.formatAmountSafe(this.economyService.unitsToAsset(available)),
            status,
            coopname: event.coopname,
            deepLinkUrl: this.pageUrl(event.coopname),
          };
          await this.notifications.notifyUser(investor.username, Workflows.MarketplaceInvestReturned.id, payload);
        }
      });
    }
  }

  private pageUrl(coopname: string): string {
    return `${platformSettings().frontendUrl}/${coopname}/market-pvz/initiators`;
  }

  private async safely(what: string, work: () => Promise<void>): Promise<void> {
    try {
      await work();
    } catch (err) {
      this.logger.warn(`Уведомление «${what}» не отправлено: ${(err as Error)?.message ?? err}`);
    }
  }
}
