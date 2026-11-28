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
  CHAIN_PORT,
  InnerAppSubscriptionStatus,
  PROVIDER_APPS_PORT,
  type IChainPort,
  type IProviderAppsPort,
  type InnerAppSubscription,
} from '@coopenomics/innercoop';
import { Name, UInt128 } from '@wharfkit/session';
import { Ledger2, Ledger2Contract, RegistratorContract, TokenContract } from 'cooptypes';
import { t } from '../../i18n';
import {
  AppsCatalogHttpService,
  type AppRequestedRights,
  type AppsCatalogPackage,
} from '../../infrastructure/apps-catalog-http.service';
import type { AppRightsConsentRecord } from '../../infrastructure/records/app-rights-consent.record';
import { CatalogAppsStateService } from './catalog-apps-state.service';
import { AppRightsConsentService, AUTO_ACCEPT_DEFAULT } from './app-rights-consent.service';
import type { AppPortDeclaration } from './app-port-grants.service';
import type { CatalogAppRightsDTO } from '../dto/catalog-app-rights.dto';
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

/** Пакет каталога по предложению провайдера: издатель — пространство имён пакета. */
function packageOfOffer(offer: { package_id: string }): AppsCatalogPackage {
  return {
    packageId: offer.package_id,
    publisher: offer.package_id.replace(/^@/, '').split('/')[0] ?? '',
    compatibleSubnets: [],
    lastActiveVersion: null,
  };
}

/** Согласие пакета, по которому председатель ещё не отвечал: прав нет, запроса нет. */
const NO_CONSENT = {
  ports: [] as string[],
  chainActions: [] as string[],
  pendingPorts: [] as string[],
  pendingChainActions: [] as string[],
  pendingVersion: null as string | null,
  autoAccept: AUTO_ACCEPT_DEFAULT,
  consentedBy: null as string | null,
  consentedAt: null as Date | null,
};

/** Согласие и запрос новых прав → GraphQL. */
function toRightsDTO(
  packageId: string,
  requested: AppRequestedRights | null,
  consent: AppRightsConsentRecord | null,
): CatalogAppRightsDTO {
  const row = consent ?? NO_CONSENT;
  return {
    packageId,
    version: requested ? requested.version : null,
    requested: requested ? { ports: requested.ports, chainActions: requested.chainActions } : null,
    granted: { ports: row.ports, chainActions: row.chainActions },
    pending: row.pendingVersion === null ? null : { ports: row.pendingPorts, chainActions: row.pendingChainActions },
    pendingVersion: row.pendingVersion,
    autoAccept: row.autoAccept,
    consentedBy: row.consentedBy,
    consentedAt: row.consentedAt ? new Date(row.consentedAt).toISOString() : null,
  };
}

@Injectable()
export class NodeAppsService {
  private readonly logger = new Logger(NodeAppsService.name);

  constructor(
    private readonly catalog: AppsCatalogHttpService,
    private readonly state: CatalogAppsStateService,
    private readonly consents: AppRightsConsentService,
    @Inject(CHAIN_PORT) private readonly chain: IChainPort,
    @Optional() @Inject(PROVIDER_APPS_PORT) private readonly providerApps?: IProviderAppsPort,
  ) {}

  private get coopname(): string {
    return platformSettings().coopname;
  }

  /** Витрина: пакеты каталога с ценой, подпиской и состоянием на узле. */
  async listCatalogApps(page = 1, pageSize = 50): Promise<AppsCatalogRemotePackageDTO[]> {
    const [packages, offers, subscriptions, installed, disabled, rightsPending] = await Promise.all([
      this.catalog.listPublicPackages(page, pageSize),
      this.providerApps?.listOffers(this.coopname) ?? Promise.resolve(null),
      this.providerApps?.listAppSubscriptions(this.coopname) ?? Promise.resolve(null),
      this.catalog.listInstalledFrontends(),
      this.state.disabledPackageIds(),
      this.consents.pendingPackageIds(),
    ]);
    // Без цены витрина не показывается вовсе — председатель подписывается, видя сумму.
    if (offers === null) {
      throw new ServiceUnavailableException(t('appsCatalogProxy.catalog.pricesUnavailable'));
    }
    // Узел кооператива ключа оператора каталога не имеет (487-37): перечень
    // приложений — предложения провайдера подключения, у которого узел и
    // оформляет подписку. Издатель — пространство имён пакета, версию узел
    // узнаёт после подписки.
    const listed = this.catalog.hasOperatorAccess ? packages : offers.map(packageOfOffer);
    const offerOf = new Map(offers.map((o) => [o.package_id, o]));
    const subscriptionOf = new Map((subscriptions ?? []).map((s) => [s.package_id, s]));
    const installedIds = new Set(installed.map((i) => i.packageId));
    return listed.flatMap((p) => {
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
        rightsPending: rightsPending.has(p.packageId),
      }];
    });
  }

  /** Оформить подписку у провайдера; узел сразу включает приложение. */
  async subscribe(packageId: string): Promise<SubscribePackageResultDTO> {
    if (!this.providerApps) {
      return { status: SubscribePackageStatus.UNAVAILABLE, error: t('appsCatalogProxy.catalog.providerUnavailable') };
    }
    const shortage = await this.fundsShortage(packageId);
    if (shortage) return { status: SubscribePackageStatus.FAILED, error: shortage };
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

  /**
   * Оплата вперёд (слово владельца 28.11.2026): подписка без пробного срока
   * списывает первый месяц сразу, поэтому без остатка на кошельке членских
   * взносов она не оформляется. Остаток покрывает цену месяца и то, что уже ждёт
   * списания по другим подпискам: хаб оператора платит счёт целиком. Текст
   * отказа — для экрана; `null` — денег хватает, пробный срок есть либо остаток
   * не прочитан (тогда доступ всё равно закрыт до списания у провайдера).
   *
   * Подписка на этот пакет у провайдера уже есть (не оплачена в срок):
   * провайдер новой строки не заводит, месяц пакета уже стоит в счёте. Отказа
   * здесь нет — председатель подтверждает права, приложение устанавливается после
   * списания. Прежде цена пакета считалась дважды: в долге и сверху
   * (28.11.2026 экран требовал 3 700 ₽ при цене 100 ₽ и долге 3 600 ₽).
   */
  private async fundsShortage(packageId: string): Promise<string | null> {
    const offers = await this.providerApps?.listOffers(this.coopname);
    const offer = offers?.find((o) => o.package_id === packageId);
    if (!offer || offer.trial_days > 0 || offer.price <= 0) return null;
    const billing = await this.nodeBilling();
    if (billing.subscriptions.some((s) => s.packageId === packageId)) return null;
    if (!billing.wallet) return null;
    const available = Number.parseFloat(billing.wallet.membershipAvailable);
    if (!Number.isFinite(available)) return null;
    const need = Math.round((offer.price + billing.dueAmount) * 100) / 100;
    if (available + 1e-9 >= need) return null;
    return billing.dueAmount > 0
      ? t('appsCatalogProxy.catalog.insufficientFundsWithDebt', {
          need: need.toFixed(2),
          available: available.toFixed(2),
          price: offer.price.toFixed(2),
          debt: billing.dueAmount.toFixed(2),
        })
      : t('appsCatalogProxy.catalog.insufficientFunds', {
          need: need.toFixed(2),
          available: available.toFixed(2),
        });
  }

  /** Отменить подписку: провайдер снимает строку счёта, каталог закрывает пакет. */
  async unsubscribe(packageId: string): Promise<UnsubscribePackageResultDTO> {
    if (!this.providerApps) {
      return { status: UnsubscribePackageStatus.UNAVAILABLE, error: t('appsCatalogProxy.catalog.providerUnavailable') };
    }
    const outcome = await this.providerApps.cancel(this.coopname, packageId);
    switch (outcome.status) {
      case 'cancelled':
        // Стол пакета снимается сразу: приложение выключается на узле до того,
        // как оркестратор уберёт фронт.
        await this.state.markUnsubscribed(packageId);
        // Согласие на права действует, пока действует подписка: при новой подписке председатель отвечает заново.
        await this.consents.forget(packageId);
        this.logger.log(`unsubscribePackage: ${packageId} отменена у провайдера`);
        return { status: UnsubscribePackageStatus.CANCELLED, packageId };
      case 'notSubscribed':
        await this.state.markUnsubscribed(packageId);
        await this.consents.forget(packageId);
        return { status: UnsubscribePackageStatus.NOT_SUBSCRIBED, packageId };
      case 'unavailable':
        return { status: UnsubscribePackageStatus.UNAVAILABLE, error: t('appsCatalogProxy.catalog.providerUnavailable') };
      default:
        return { status: UnsubscribePackageStatus.FAILED, error: outcome.error };
    }
  }

  /**
   * Права ядра приложения на узле: что просит действующая версия, с чем
   * председатель согласился и какой запрос новых прав ждёт ответа.
   */
  async rights(packageId: string): Promise<CatalogAppRightsDTO> {
    const [requested, consent] = await Promise.all([this.requestedRights(packageId), this.consents.byPackage(packageId)]);
    return toRightsDTO(packageId, requested, consent);
  }

  /**
   * Что просит версия приложения. Оркестратор знает манифест после подписки;
   * до неё экран подписки показывает права действующей версии каталога
   * (487-37): председатель соглашается с ними до оформления подписки.
   */
  private async requestedRights(packageId: string): Promise<AppRequestedRights | null> {
    const installed = await this.catalog.fetchAppRights(packageId);
    if (installed?.version) return installed;
    return (await this.catalog.fetchCatalogRights(packageId)) ?? installed;
  }

  /**
   * Председатель согласился с правами приложения. Оркестратор получает сигнал
   * повторить установку: версия, которая ждала согласия, ставится ближайшим опросом.
   */
  async grantRights(packageId: string, rights: AppPortDeclaration, username: string): Promise<CatalogAppRightsDTO> {
    const consent = await this.consents.grant(packageId, rights, username);
    this.logger.log(`grantCatalogAppRights: ${username} → ${packageId} [${[...consent.ports, ...consent.chainActions].join(', ')}]`);
    const requested = await this.catalog.fetchAppRights(packageId);
    await this.catalog.recheckApp(packageId);
    return toRightsDTO(packageId, requested, consent);
  }

  /** Переключатель «Принимать новые права после одобрения модератора каталога». */
  async setRightsAutoAccept(packageId: string, enabled: boolean, username: string): Promise<CatalogAppRightsDTO> {
    const consent = await this.consents.setAutoAccept(packageId, enabled, username);
    this.logger.log(`setCatalogAppRightsAutoAccept: ${username} → ${packageId} ${enabled ? 'включён' : 'выключен'}`);
    const requested = await this.catalog.fetchAppRights(packageId);
    if (enabled) await this.catalog.recheckApp(packageId);
    return toRightsDTO(packageId, requested, consent);
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
      operatorSite: null,
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
      operatorSite: operator ? await this.siteOf(operator) : null,
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

  /**
   * Адрес сайта оператора из его записи в реестре сети: на этом сайте
   * кооператив пополняет кошелёк членских взносов и меняет тариф.
   */
  private async siteOf(operator: string): Promise<string | null> {
    try {
      const row = await this.chain.getSingleRow<{ announce?: string }>(
        RegistratorContract.contractName.production,
        RegistratorContract.contractName.production,
        RegistratorContract.Tables.Cooperatives.tableName,
        operator,
      );
      return row?.announce || null;
    }
    catch (error: any) {
      this.logger.warn(`Адрес оператора ${operator} не прочитан из цепи: ${error?.message ?? error}`);
      return null;
    }
  }

  /** Остатки кооператива у оператора: членские взносы на подписки и AXON. */
  private async walletOf(operator: string, coopname: string): Promise<AppsNodeBillingDTO['wallet']> {
    try {
      // Одна строка кошелька кооператива в леджере оператора — по индексу
      // byuserwallet (combine_ids(wallet_name, username), как в контракте), без
      // чтения всей таблицы оператора: она растёт с каждым кооперативом
      // (слово владельца 28.10.2026). Строки нет — контракт стирает кошелёк при
      // нулевом остатке, значит, остаток ноль.
      const billing = await this.chain.getSingleRow<Ledger2Contract.Tables.UserWallets.IUserWallet>(
        Ledger2Contract.contractName.production,
        operator,
        Ledger2Contract.Tables.UserWallets.tableName,
        UInt128.from(userWalletKey(Ledger2.BILLING_WALLET_NAME, coopname).toString()),
        'secondary',
        'i128',
      );
      // AXON — остаток токена на счёте кооператива в цепи (таблица accounts
      // контракта токена). Запись реестра кооператива остатка не содержит:
      // по этой записи узел показывал ноль при 2 089 AXON в цепи (27.10.2026).
      const balances = await this.chain.getAllRows<TokenContract.Tables.AccountBalance.IAccountBalance>(
        TokenContract.contractName.production,
        coopname,
        TokenContract.Tables.AccountBalance.tableName,
      );
      const axonSymbol = TokenContract.Tables.CurrencyStats.scope;
      const axon = balances.find((b) => String(b.balance).endsWith(` ${axonSymbol}`));
      return {
        membershipAvailable: billing?.available ?? '0.0000 RUB',
        axonAvailable: axon?.balance ?? `0.0000 ${axonSymbol}`,
      };
    }
    catch (error: any) {
      this.logger.warn(`Кошелёк ${coopname} у оператора ${operator} не прочитан: ${error?.message ?? error}`);
      return null;
    }
  }
}

/**
 * Ключ индекса byuserwallet кошелька ledger2: combine_ids(wallet_name, username)
 * = (wallet_name << 64) | username, числовые значения имён — как в цепи.
 */
export function userWalletKey(walletName: string, username: string): bigint {
  return (BigInt(Name.from(walletName).value.toString()) << 64n) | BigInt(Name.from(username).value.toString());
}
