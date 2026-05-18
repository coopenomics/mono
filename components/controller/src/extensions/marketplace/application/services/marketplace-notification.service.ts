import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Workflows } from '@coopenomics/notifications';
import config from '~/config/config';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import { NOVU_WORKFLOW_PORT, type NovuWorkflowPort } from '~/domain/notification/interfaces/novu-workflow.port';
import { ACCOUNT_DATA_PORT, type AccountDataPort } from '~/domain/account/ports/account-data.port';
import type { WorkflowTriggerDomainInterface } from '~/domain/notification/interfaces/workflow-trigger-domain.interface';
import {
  MARKETPLACE_APL_SUPPLIER_SIGN_REQUEST_EVENT,
  MARKETPLACE_CASHIER_NEW_PAYMENT_EVENT,
  MARKETPLACE_SUPPLIER_PAYMENT_CONFIRMED_EVENT,
  MARKETPLACE_SUPPLIER_PAYMENT_DECLINED_EVENT,
  type MarketplaceAplSupplierSignRequestEvent,
  type MarketplaceCashierNewPaymentEvent,
  type MarketplaceSupplierPaymentConfirmedEvent,
  type MarketplaceSupplierPaymentDeclinedEvent,
} from '../events/marketplace-notification.events';

/**
 * Story 5.4 / 5.6 / 5.7 — push-уведомления marketplace flow.
 *
 * Слушает event-bus EventEmitter2 (per-contract канал marketplace) и
 * шлёт Novu workflow трём ролям:
 *  - поставщику при создании АПП варианта Б (требуется первая подпись);
 *  - кассиру (в MVP — председателю; extension-роль cashier появится позже)
 *    при формировании запроса исходящего платежа;
 *  - поставщику при подтверждении выплаты кассиром.
 *
 * Provider не блокирующий: ошибки Novu / отсутствие subscriber_id
 * логируются как warn, основной flow marketplace-сервиса не падает
 * (INV-12: emit идёт ПОСЛЕ save в PG, поэтому проблема доставки не
 * влияет на доменную целостность).
 */
@Injectable()
export class MarketplaceNotificationService implements OnModuleInit {
  constructor(
    @Inject(NOVU_WORKFLOW_PORT)
    private readonly novuWorkflowPort: NovuWorkflowPort,
    @Inject(ACCOUNT_DATA_PORT)
    private readonly accountPort: AccountDataPort,
    private readonly logger: WinstonLoggerService
  ) {
    this.logger.setContext(MarketplaceNotificationService.name);
  }

  async onModuleInit() {
    this.logger.log('MarketplaceNotificationService инициализирован');
  }

  @OnEvent(MARKETPLACE_APL_SUPPLIER_SIGN_REQUEST_EVENT)
  async handleAplSupplierSignRequest(event: MarketplaceAplSupplierSignRequestEvent): Promise<void> {
    try {
      const supplierAccount = await this.accountPort.getAccount(event.supplier_account);
      const subscriberId = supplierAccount.provider_account?.subscriber_id?.trim();
      const email = supplierAccount.provider_account?.email;
      if (!subscriberId || !email) {
        this.logger.warn(
          `АПП ${event.apl_reception_id}: subscriber_id/email поставщика ${event.supplier_account} не найден — push пропущен.`
        );
        return;
      }

      const supplierName = await this.accountPort.getDisplayName(event.supplier_account);
      const payload: Workflows.MarketplaceAplSupplierSignRequest.IPayload = {
        supplierName,
        kuName: event.ku_name,
        ttnNumber: event.ttn_number,
        expeditorName: event.expeditor_name,
        coopname: event.coopname,
        apl_reception_id: event.apl_reception_id,
        deepLinkUrl: `${config.frontend_url}/${event.coopname}/offerer/PendingAplReceptions/${event.apl_reception_id}`,
      };
      const triggerData: WorkflowTriggerDomainInterface = {
        name: Workflows.MarketplaceAplSupplierSignRequest.id,
        to: { subscriberId, email },
        payload,
      };
      await this.novuWorkflowPort.triggerWorkflow(triggerData);
      this.logger.log(
        `АПП ${event.apl_reception_id}: push поставщику ${event.supplier_account} отправлен.`
      );
    } catch (err: any) {
      this.logger.warn(
        `АПП ${event.apl_reception_id}: ошибка отправки push поставщику (${err.message}) — flow не блокируется.`
      );
    }
  }

  @OnEvent(MARKETPLACE_CASHIER_NEW_PAYMENT_EVENT)
  async handleCashierNewPayment(event: MarketplaceCashierNewPaymentEvent): Promise<void> {
    try {
      // MVP: кассиром выступает председатель кооператива. Когда появится
      // extension-роль cashier — поменять фильтр на role: 'cashier'.
      const chairmen = await this.accountPort.getAccounts(
        { role: 'chairman' },
        { page: 1, limit: 1, sortOrder: 'ASC' }
      );
      if (!chairmen.items || chairmen.items.length === 0) {
        this.logger.warn(
          `Payment ${event.payment_request_id}: председатель/кассир не найден — push пропущен.`
        );
        return;
      }
      const cashier = chairmen.items[0];
      const subscriberId = cashier.provider_account?.subscriber_id?.trim();
      const email = cashier.provider_account?.email;
      if (!subscriberId || !email) {
        this.logger.warn(
          `Payment ${event.payment_request_id}: subscriber_id/email кассира ${cashier.username} не найден — push пропущен.`
        );
        return;
      }

      const cashierName = await this.accountPort.getDisplayName(cashier.username);
      const supplierName = await this.accountPort.getDisplayName(event.supplier_account);
      const payload: Workflows.MarketplaceCashierNewPayment.IPayload = {
        cashierName,
        supplierName,
        amount: event.amount,
        apl_reception_id: event.apl_reception_id,
        payment_request_id: event.payment_request_id,
        coopname: event.coopname,
        deepLinkUrl: `${config.frontend_url}/${event.coopname}/cashier/Payments`,
      };
      const triggerData: WorkflowTriggerDomainInterface = {
        name: Workflows.MarketplaceCashierNewPayment.id,
        to: { subscriberId, email },
        payload,
      };
      await this.novuWorkflowPort.triggerWorkflow(triggerData);
      this.logger.log(
        `Payment ${event.payment_request_id}: push кассиру ${cashier.username} отправлен.`
      );
    } catch (err: any) {
      this.logger.warn(
        `Payment ${event.payment_request_id}: ошибка отправки push кассиру (${err.message}) — flow не блокируется.`
      );
    }
  }

  @OnEvent(MARKETPLACE_SUPPLIER_PAYMENT_CONFIRMED_EVENT)
  async handleSupplierPaymentConfirmed(event: MarketplaceSupplierPaymentConfirmedEvent): Promise<void> {
    try {
      const supplierAccount = await this.accountPort.getAccount(event.supplier_account);
      const subscriberId = supplierAccount.provider_account?.subscriber_id?.trim();
      const email = supplierAccount.provider_account?.email;
      if (!subscriberId || !email) {
        this.logger.warn(
          `Payment ${event.payment_request_id}: subscriber_id/email поставщика ${event.supplier_account} не найден — push пропущен.`
        );
        return;
      }

      const supplierName = await this.accountPort.getDisplayName(event.supplier_account);
      const payload: Workflows.MarketplaceSupplierPaymentConfirmed.IPayload = {
        supplierName,
        amount: event.amount,
        paymentReference: event.payment_reference,
        apl_reception_id: event.apl_reception_id,
        payment_request_id: event.payment_request_id,
        coopname: event.coopname,
        deepLinkUrl: `${config.frontend_url}/${event.coopname}/offerer/PaymentHistory`,
      };
      const triggerData: WorkflowTriggerDomainInterface = {
        name: Workflows.MarketplaceSupplierPaymentConfirmed.id,
        to: { subscriberId, email },
        payload,
      };
      await this.novuWorkflowPort.triggerWorkflow(triggerData);
      this.logger.log(
        `Payment ${event.payment_request_id}: push поставщику ${event.supplier_account} о выплате отправлен.`
      );
    } catch (err: any) {
      this.logger.warn(
        `Payment ${event.payment_request_id}: ошибка отправки push поставщику (${err.message}) — flow не блокируется.`
      );
    }
  }

  @OnEvent(MARKETPLACE_SUPPLIER_PAYMENT_DECLINED_EVENT)
  async handleSupplierPaymentDeclined(event: MarketplaceSupplierPaymentDeclinedEvent): Promise<void> {
    try {
      const supplierAccount = await this.accountPort.getAccount(event.supplier_account);
      const subscriberId = supplierAccount.provider_account?.subscriber_id?.trim();
      const email = supplierAccount.provider_account?.email;
      if (!subscriberId || !email) {
        this.logger.warn(
          `Payment ${event.payment_request_id}: subscriber_id/email поставщика ${event.supplier_account} не найден — push пропущен.`
        );
        return;
      }

      const supplierName = await this.accountPort.getDisplayName(event.supplier_account);
      const payload: Workflows.MarketplaceSupplierPaymentDeclined.IPayload = {
        supplierName,
        amount: event.amount,
        reason: event.reason,
        apl_reception_id: event.apl_reception_id,
        payment_request_id: event.payment_request_id,
        coopname: event.coopname,
        deepLinkUrl: `${config.frontend_url}/${event.coopname}/offerer/PaymentHistory`,
      };
      const triggerData: WorkflowTriggerDomainInterface = {
        name: Workflows.MarketplaceSupplierPaymentDeclined.id,
        to: { subscriberId, email },
        payload,
      };
      await this.novuWorkflowPort.triggerWorkflow(triggerData);
      this.logger.log(
        `Payment ${event.payment_request_id}: push поставщику ${event.supplier_account} об отказе выплаты отправлен.`
      );
    } catch (err: any) {
      this.logger.warn(
        `Payment ${event.payment_request_id}: ошибка отправки push поставщику об отказе (${err.message}) — flow не блокируется.`
      );
    }
  }
}
