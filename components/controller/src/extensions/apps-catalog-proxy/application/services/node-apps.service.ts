/**
 * Приложения каталога на узле кооператива (26.10.2026): витрина, подписка,
 * отмена, переключатель и сводка подписок у провайдера.
 *
 * Четыре источника сводятся в одну строку витрины:
 *  - каталог — список пакетов и версии;
 *  - провайдер — цена, пробный срок из публикации, подписка кооператива;
 *  - оркестратор — получен ли фронт приложения;
 *  - таблица узла — включено ли приложение на рабочем столе.
 *
 * Подписывается узел сам: у него есть канал к провайдеру. Пакет без цены у
 * провайдера на витрину не попадает — председатель подписывается, видя сумму
 * и пробный срок. Оператор подписку кооператива только показывает.
 */
import { Inject, Injectable, Logger, Optional, ServiceUnavailableException } from '@nestjs/common';
import { catalogAppTitle, platformSettings } from '@coopenomics/extension-kit';
import {
  ACCOUNT_PORT,
  CHAIN_PORT,
  InnerAppSubscriptionStatus,
  PROVIDER_APPS_PORT,
  type IAccountPort,
  type IChainPort,
  type IProviderAppsPort,
  type InnerAppSubscription,
} from '@coopenomics/innercoop';
import { Ledger2, Ledger2Contract, RegistratorContract } from 'cooptypes';
import { t } from '../../i18n';
import { AppsCatalogHttpService } from '../../infrastructure/apps-catalog-http.service';
import { CatalogAppsStateService } from './catalog-apps-state.service';
import { AppsCatalogRemotePackageDTO, AppsCatalogSubscriptionDTO } from '../dto/apps-catalog-remote-package.dto';
import { AppsNodeBillingDTO, AppsNodeSubscriptionDTO } from '../dto/apps-node-billing.dto';
import { SubscribePackageResultDTO, SubscribePackageStatus, SubscriptionStateEnum } from '../dto/subscribe-package-result.dto';
import { UnsubscribePackageResultDTO, UnsubscribePackageStatus } from '../dto/catalog-app-input.dto';

/** Подписка, по которой приложение сейчас доступно кооперативу. */
function isLive(s: InnerAppSubscription): boolean {
  return s.status === InnerAppSubscriptionStatus.ACTIVE || s.status === InnerAppSubscriptionStatus.TRIAL;
}

function toSubscriptionDTO(s: InnerAppSubscription): AppsCatalogSubscriptionDTO {
  return {
    status: s.status,
    isTrial: Boolean(s.is_trial),
    trialEndsAt: s.trial_ends_at ?? null,
    startedAt: s.started_at,
    expiresAt: s.expires_at,
    nextPaymentDue: s.next_payment_due ?? null,
    amountPerPeriod: Number(s.amount_per_period),
  };
}

@Injectable()
export class NodeAppsService {
  private readonly logger = new Logger(NodeAppsService.name);

  constructor(
    private readonly catalog: AppsCatalogHttpService,
    private readonly state: CatalogAppsStateService,
    @Inject(CHAIN_PORT) private readonly chain: IChainPort,
    @Inject(ACCOUNT_PORT) private readonly accounts: IAccountPort,
    @Optional() @Inject(PROVIDER_APPS_PORT) private readonly providerApps?: IProviderAppsPort,
  ) {}

  private get coopname(): string {
    return platformSettings().coopname;
  }

  /** Витрина: пакеты каталога с ценой, подпиской и состоянием на узле. */
  async listCatalogApps(page = 1, pageSize = 50): Promise<AppsCatalogRemotePackageDTO[]> {
    const [packages, offers, subscriptions, installed, disabled] = await Promise.all([
      this.catalog.listPublicPackages(page, pageSize),
      this.providerApps?.listOffers(this.coopname) ?? Promise.resolve(null),
      this.providerApps?.listAppSubscriptions(this.coopname) ?? Promise.resolve(null),
      this.catalog.listInstalledFrontends(),
      this.state.disabledPackageIds(),
    ]);
    // Без цены витрина не показывается вовсе — председатель подписывается, видя сумму.
    if (offers === null) {
      throw new ServiceUnavailableException(t('appsCatalogProxy.catalog.pricesUnavailable'));
    }
    const offerOf = new Map(offers.map((o) => [o.package_id, o]));
    const subscriptionOf = new Map((subscriptions ?? []).map((s) => [s.package_id, s]));
    const installedIds = new Set(installed.map((i) => i.packageId));
    return packages.flatMap((p) => {
      const offer = offerOf.get(p.packageId);
      if (!offer || offer.period_days <= 0) return [];
      const subscription = subscriptionOf.get(p.packageId) ?? null;
      return [{
        packageId: p.packageId,
        publisher: p.publisher,
        compatibleSubnets: p.compatibleSubnets,
        lastActiveVersion: p.lastActiveVersion,
        title: catalogAppTitle(p.packageId),
        description: t('appsCatalogProxy.remotePackage.description'),
        rubPerMonth: Math.round((offer.price * 30) / offer.period_days),
        trialDays: offer.trial_days,
        subscription: subscription ? toSubscriptionDTO(subscription) : null,
        installed: installedIds.has(p.packageId),
        enabled: !disabled.has(p.packageId),
      }];
    });
  }

  /** Оформить подписку у провайдера; узел сразу включает приложение. */
  async subscribe(packageId: string): Promise<SubscribePackageResultDTO> {
    if (!this.providerApps) {
      return { status: SubscribePackageStatus.UNAVAILABLE, error: t('appsCatalogProxy.catalog.providerUnavailable') };
    }
    const outcome = await this.providerApps.subscribe(this.coopname, packageId);
    switch (outcome.status) {
      case 'subscribed': {
        const s = outcome.subscription;
        await this.state.markSubscribed(s.package_id);
        if (!outcome.created) {
          return { status: SubscribePackageStatus.ALREADY_ACTIVE, packageId: s.package_id };
        }
        this.logger.log(`subscribePackage: ${s.package_id} оформлена у провайдера до ${s.expires_at}`);
        return {
          status: SubscribePackageStatus.ACTIVATED,
          state: s.status === InnerAppSubscriptionStatus.TRIAL ? SubscriptionStateEnum.TRIAL : SubscriptionStateEnum.ACTIVE,
          packageId: s.package_id,
          plan: 'default',
          startAt: s.started_at,
          endAt: s.expires_at,
          freeTrialUsed: Boolean(s.is_trial),
        };
      }
      case 'unavailable':
        return { status: SubscribePackageStatus.UNAVAILABLE, error: t('appsCatalogProxy.catalog.providerUnavailable') };
      default:
        return { status: SubscribePackageStatus.FAILED, error: outcome.error };
    }
  }

  /** Отменить подписку: провайдер снимает строку счёта, каталог закрывает пакет. */
  async unsubscribe(packageId: string): Promise<UnsubscribePackageResultDTO> {
    if (!this.providerApps) {
      return { status: UnsubscribePackageStatus.UNAVAILABLE, error: t('appsCatalogProxy.catalog.providerUnavailable') };
    }
    const outcome = await this.providerApps.cancel(this.coopname, packageId);
    switch (outcome.status) {
      case 'cancelled':
        this.logger.log(`unsubscribePackage: ${packageId} отменена у провайдера`);
        return { status: UnsubscribePackageStatus.CANCELLED, packageId };
      case 'notSubscribed':
        return { status: UnsubscribePackageStatus.NOT_SUBSCRIBED, packageId };
      case 'unavailable':
        return { status: UnsubscribePackageStatus.UNAVAILABLE, error: t('appsCatalogProxy.catalog.providerUnavailable') };
      default:
        return { status: UnsubscribePackageStatus.FAILED, error: outcome.error };
    }
  }

  async setEnabled(packageId: string, enabled: boolean): Promise<boolean> {
    const row = await this.state.setEnabled(packageId, enabled);
    return row.enabled;
  }

  /**
   * Подписки и счёт узла у провайдера — для показа председателю и совету.
   * Кошелёк членских взносов живёт в леджере оператора (кооператив там —
   * обычный пайщик), поэтому остаток читается из цепи по области оператора.
   */
  async nodeBilling(): Promise<AppsNodeBillingDTO> {
    const empty: AppsNodeBillingDTO = {
      available: false,
      operator: null,
      subscriptions: [],
      monthlyTotal: 0,
      dueAmount: 0,
      nextPaymentDue: null,
      wallet: null,
    };
    if (!this.providerApps) return empty;
    const [rows, summary] = await Promise.all([
      this.providerApps.listSubscriptions(this.coopname),
      this.providerApps.billingSummary(this.coopname),
    ]);
    if (rows === null) return empty;

    const subscriptions: AppsNodeSubscriptionDTO[] = rows
      .filter((s) => s.status !== InnerAppSubscriptionStatus.CANCELLED)
      .map((s) => ({
        id: s.id,
        name: s.package_id ? catalogAppTitle(s.package_id) : s.name,
        code: s.code,
        kind: s.kind,
        packageId: s.package_id,
        status: s.status,
        isTrial: s.is_trial,
        price: s.price,
        periodDays: s.period_days,
        startedAt: s.started_at,
        expiresAt: s.expires_at,
        nextPaymentDue: s.next_payment_due,
      }));
    const monthlyTotal = subscriptions.reduce(
      (sum, s) => sum + (s.periodDays > 0 ? (s.price * 30) / s.periodDays : s.price),
      0,
    );
    const dueAmount = (summary?.items ?? []).filter((i) => i.is_due).reduce((sum, i) => sum + i.amount, 0);

    const operator = await this.operatorOf(this.coopname);
    return {
      available: true,
      operator,
      subscriptions,
      monthlyTotal: Math.round(monthlyTotal * 100) / 100,
      dueAmount: Math.round(dueAmount * 100) / 100,
      nextPaymentDue: summary?.next_payment_due ?? null,
      wallet: operator ? await this.walletOf(operator, this.coopname) : null,
    };
  }

  /** Оператор кооператива — родительский аккаунт в реестре сети. */
  private async operatorOf(coopname: string): Promise<string | null> {
    try {
      const row = await this.chain.getSingleRow<{ parent_username?: string }>(
        RegistratorContract.contractName.production,
        RegistratorContract.contractName.production,
        RegistratorContract.Tables.Cooperatives.tableName,
        coopname,
      );
      return row?.parent_username || null;
    }
    catch (error: any) {
      this.logger.warn(`Оператор ${coopname} не прочитан из цепи: ${error?.message ?? error}`);
      return null;
    }
  }

  /** Остатки кооператива у оператора: членские взносы на подписки и AXON. */
  private async walletOf(operator: string, coopname: string): Promise<AppsNodeBillingDTO['wallet']> {
    try {
      // Срез кошельков оператора — полный, как в «Столе заказов»; при росте —
      // запрос по индексу byuserwallet (i128).
      const rows = await this.chain.getAllRows<Ledger2Contract.Tables.UserWallets.IUserWallet>(
        Ledger2Contract.contractName.production,
        operator,
        Ledger2Contract.Tables.UserWallets.tableName,
      );
      const billing = rows.find((r) => r.username === coopname && r.wallet_name === Ledger2.BILLING_WALLET_NAME);
      const account = await this.accounts.getChainAccount(coopname).catch(() => null);
      return {
        membershipAvailable: billing?.available ?? '0.0000 RUB',
        axonAvailable: (account?.core_liquid_balance as string | undefined) ?? null,
      };
    }
    catch (error: any) {
      this.logger.warn(`Кошелёк ${coopname} у оператора ${operator} не прочитан: ${error?.message ?? error}`);
      return null;
    }
  }
}
