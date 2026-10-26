/**
 * Адаптер порта подписок на приложения (`PROVIDER_APPS_PORT`): узел
 * кооператива сам оформляет и отменяет подписки у провайдера и читает своё
 * состояние — подписки, сводку счёта. Ядро владеет каналом к провайдеру
 * (`ProviderService`), расширение знает только порт.
 */
import { Injectable, Logger } from '@nestjs/common';
import {
  InnerAppSubscriptionStatus,
  type IProviderAppsPort,
  type InnerAppCancelOutcome,
  type InnerAppOffer,
  type InnerAppSubscribeOutcome,
  type InnerAppSubscription,
  type InnerBillingSummary,
  type InnerProviderSubscription,
} from '@coopenomics/innercoop';
import { DomainError } from '@coopenomics/extension-kit';
import { ProviderService } from '~/application/provider/services/provider.service';

const STATUSES = new Set<string>(Object.values(InnerAppSubscriptionStatus));

/** Статус провайдера в перечисление порта; незнакомое значение — EXPIRED: доступ не обещаем. */
function toStatus(value: unknown): InnerAppSubscriptionStatus {
  const upper = String(value ?? '').toUpperCase();
  return STATUSES.has(upper) ? (upper as InnerAppSubscriptionStatus) : InnerAppSubscriptionStatus.EXPIRED;
}

@Injectable()
export class ProviderAppsInnercoopAdapter implements IProviderAppsPort {
  private readonly logger = new Logger(ProviderAppsInnercoopAdapter.name);

  constructor(private readonly providerService: ProviderService) {}

  async listOffers(coopname: string): Promise<InnerAppOffer[] | null> {
    if (!this.providerService.isProviderAvailable()) return null;
    try {
      return await this.providerService.listAppOffers(coopname);
    }
    catch (error: any) {
      // Витрина без цены лучше, чем витрина, упавшая из-за провайдера.
      this.logger.warn(`Цены приложений для ${coopname} не получены: ${error?.message ?? error}`);
      return null;
    }
  }

  async listAppSubscriptions(coopname: string): Promise<InnerAppSubscription[] | null> {
    if (!this.providerService.isProviderAvailable()) return null;
    try {
      return (await this.providerService.listAppSubscriptions(coopname)).map((s) => ({
        package_id: s.package_id,
        status: toStatus(s.status),
        amount_per_period: Number(s.amount_per_period),
        started_at: s.started_at,
        expires_at: s.expires_at,
        is_trial: Boolean(s.is_trial),
        trial_ends_at: s.trial_ends_at ?? null,
        next_payment_due: s.next_payment_due ?? null,
      }));
    }
    catch (error: any) {
      this.logger.warn(`Подписки на приложения ${coopname} не получены: ${error?.message ?? error}`);
      return null;
    }
  }

  async subscribe(coopname: string, packageId: string): Promise<InnerAppSubscribeOutcome> {
    if (!this.providerService.isProviderAvailable()) return { status: 'unavailable' };
    try {
      const { subscription, created } = await this.providerService.subscribeApp(coopname, packageId);
      return { status: 'subscribed', created, subscription };
    }
    catch (error: any) {
      const message = error?.message ?? String(error);
      if (error instanceof DomainError && error.code === 'PROVIDER_APP_NOT_OFFERED') {
        return { status: 'notOffered', error: message };
      }
      this.logger.warn(`Подписка ${coopname} на ${packageId} не оформлена: ${message}`);
      return { status: 'failed', error: message };
    }
  }

  async cancel(coopname: string, packageId: string): Promise<InnerAppCancelOutcome> {
    if (!this.providerService.isProviderAvailable()) return { status: 'unavailable' };
    try {
      const subscription = await this.providerService.cancelApp(coopname, packageId);
      return { status: 'cancelled', subscription };
    }
    catch (error: any) {
      const message = error?.message ?? String(error);
      if (error instanceof DomainError && error.code === 'PROVIDER_APP_NOT_SUBSCRIBED') {
        return { status: 'notSubscribed' };
      }
      this.logger.warn(`Подписка ${coopname} на ${packageId} не отменена: ${message}`);
      return { status: 'failed', error: message };
    }
  }

  async listSubscriptions(coopname: string): Promise<InnerProviderSubscription[] | null> {
    if (!this.providerService.isProviderAvailable()) return null;
    try {
      const rows = await this.providerService.getUserSubscriptions(coopname);
      return rows.map((s) => {
        const code = s.subscription_type_code ?? null;
        return {
          id: s.id,
          name: s.subscription_type_name,
          code,
          kind: s.kind ?? null,
          package_id: code?.startsWith('catalog:') ? code.slice('catalog:'.length) : null,
          status: toStatus(s.status),
          is_trial: Boolean(s.is_trial),
          price: Number(s.price ?? 0),
          period_days: Number(s.period_days ?? 30),
          started_at: s.started_at,
          expires_at: s.expires_at,
          next_payment_due: s.next_payment_due ?? null,
        };
      });
    }
    catch (error: any) {
      this.logger.warn(`Подписки ${coopname} у провайдера не получены: ${error?.message ?? error}`);
      return null;
    }
  }

  async billingSummary(coopname: string): Promise<InnerBillingSummary | null> {
    if (!this.providerService.isProviderAvailable()) return null;
    try {
      const summary = await this.providerService.getBillingSummary(coopname);
      return {
        total_amount: Number(summary.total_amount ?? 0),
        currency: summary.currency || 'RUB',
        next_payment_due: summary.next_payment_due ?? null,
        items: (summary.items ?? []).map((item) => ({
          subscription_id: item.subscription_id,
          name: item.subscription_type_name,
          status: toStatus(item.status),
          amount: Number(item.amount ?? 0),
          // Старый провайдер поля не отдаёт — срок считается наступившим.
          is_due: item.is_due ?? true,
        })),
      };
    }
    catch (error: any) {
      this.logger.warn(`Сводка счёта ${coopname} не получена: ${error?.message ?? error}`);
      return null;
    }
  }
}
