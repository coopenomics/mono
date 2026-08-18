import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Workflows } from '@coopenomics/notifications';
import { platformSettings, AmountFormatterUtils } from '@coopenomics/extension-kit';
import { LOGGER_PORT, type ILoggerPort, ACCOUNT_PORT, type IAccountPort, NOTIFICATION_PORT, type INotificationPort } from '@coopenomics/innercoop';
import {
  MARKETPLACE_KU_CHAIRMAN_SERVICE,
  type MarketplaceKuChairmanService,
} from './marketplace-ku-chairman.service';
import {
  MARKETPLACE_APL_SUPPLIER_SIGN_REQUEST_EVENT,
  MARKETPLACE_APL_RECEPTION_CANCELLED_BY_SUPPLIER_EVENT,
  MARKETPLACE_CASHIER_NEW_PAYMENT_EVENT,
  MARKETPLACE_ORDER_READY_TO_RECEIVE_EVENT,
  MARKETPLACE_NEW_ORDER_FOR_SUPPLIER_EVENT,
  MARKETPLACE_ORDER_DECLINED_BY_SUPPLIER_EVENT,
  MARKETPLACE_RETURN_CLAIM_DECIDED_EVENT,
  MARKETPLACE_RETURN_CLAIM_FINALIZED_EVENT,
  MARKETPLACE_RETURN_CLAIM_SUBMITTED_EVENT,
  MARKETPLACE_RETURN_ACCEPTED_FOR_SUPPLIER_EVENT,
  MARKETPLACE_SUPPLIER_PAYMENT_CONFIRMED_EVENT,
  MARKETPLACE_SUPPLIER_PAYMENT_DECLINED_EVENT,
  MARKETPLACE_NEW_SUPPLIER_REQUEST_EVENT,
  MARKETPLACE_SUPPLIER_APPROVED_EVENT,
  MARKETPLACE_AID_PAYOUT_CONFIRMED_EVENT,
  MARKETPLACE_AID_COUNCIL_DECIDED_EVENT,
  MARKETPLACE_OFFER_MODERATION_REQUESTED_EVENT,
  MARKETPLACE_OFFER_APPROVED_EVENT,
  MARKETPLACE_OFFER_REJECTED_EVENT,
  type MarketplaceAidPayoutConfirmedEvent,
  type MarketplaceAidCouncilDecidedEvent,
  type MarketplaceAplSupplierSignRequestEvent,
  type MarketplaceAplReceptionCancelledBySupplierEvent,
  type MarketplaceCashierNewPaymentEvent,
  type MarketplaceOrderReadyToReceiveEvent,
  type MarketplaceNewOrderForSupplierEvent,
  type MarketplaceOrderDeclinedBySupplierEvent,
  type MarketplaceReturnClaimDecidedEvent,
  type MarketplaceReturnClaimFinalizedEvent,
  type MarketplaceReturnClaimSubmittedEvent,
  type MarketplaceReturnAcceptedForSupplierEvent,
  type MarketplaceSupplierPaymentConfirmedEvent,
  type MarketplaceSupplierPaymentDeclinedEvent,
  type MarketplaceNewSupplierRequestEvent,
  type MarketplaceSupplierApprovedEvent,
  type MarketplaceOfferModerationRequestedEvent,
  type MarketplaceOfferApprovedEvent,
  type MarketplaceOfferRejectedEvent,
} from '../events/marketplace-notification.events';

/**
 * Story 5.4 / 5.6 / 5.7 — push-уведомления marketplace flow.
 *
 * Слушает event-bus EventEmitter2 (per-contract канал marketplace) и шлёт
 * уведомление через Центр уведомлений трём ролям:
 *  - поставщику при создании АПП варианта Б (требуется первая подпись);
 *  - кассиру (в MVP — председателю; extension-роль cashier появится позже)
 *    при формировании запроса исходящего платежа;
 *  - поставщику при подтверждении выплаты кассиром.
 *
 * Provider не блокирующий: ошибки отправки / отсутствие subscriber_id
 * логируются как warn, основной flow marketplace-сервиса не падает
 * (INV-12: emit идёт ПОСЛЕ save в PG, поэтому проблема доставки не
 * влияет на доменную целостность).
 */
@Injectable()
export class MarketplaceNotificationService implements OnModuleInit {
  constructor(
    @Inject(NOTIFICATION_PORT) private readonly notificationSenderService: INotificationPort,
    @Inject(ACCOUNT_PORT)
    private readonly accountPort: IAccountPort,
    @Inject(MARKETPLACE_KU_CHAIRMAN_SERVICE)
    private readonly kuChairmanService: MarketplaceKuChairmanService,
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort
  ) {
    this.logger.setContext(MarketplaceNotificationService.name);
  }

  async onModuleInit() {
    this.logger.log('MarketplaceNotificationService инициализирован');
  }

  @OnEvent(MARKETPLACE_APL_SUPPLIER_SIGN_REQUEST_EVENT)
  async handleAplSupplierSignRequest(event: MarketplaceAplSupplierSignRequestEvent): Promise<void> {
    try {
      const supplierName = await this.accountPort.getDisplayName(event.supplier_account);
      const payload: Workflows.MarketplaceAplSupplierSignRequest.IPayload = {
        supplierName,
        kuName: event.ku_name,
        ttnNumber: event.ttn_number,
        expeditorName: event.expeditor_name,
        coopname: event.coopname,
        apl_reception_id: event.apl_reception_id,
        // Подпись поставки живёт на карточке партии во «Входящих заказах» —
        // отдельной страницы «Подпись передачи» у поставщика нет.
        deepLinkUrl: `${platformSettings().frontendUrl}/${event.coopname}/market-supplier/incoming-orders`,
      };
      await this.notificationSenderService.notifyUser(
        event.supplier_account,
        Workflows.MarketplaceAplSupplierSignRequest.id,
        payload
      );
      this.logger.log(
        `АПП ${event.apl_reception_id}: push поставщику ${event.supplier_account} отправлен.`
      );
    } catch (err: any) {
      this.logger.warn(
        `АПП ${event.apl_reception_id}: ошибка отправки push поставщику (${err.message}) — flow не блокируется.`
      );
    }
  }

  @OnEvent(MARKETPLACE_APL_RECEPTION_CANCELLED_BY_SUPPLIER_EVENT)
  async handleAplReceptionCancelledBySupplier(
    event: MarketplaceAplReceptionCancelledBySupplierEvent
  ): Promise<void> {
    try {
      const operatorName = await this.accountPort.getDisplayName(event.operator_account);
      const supplierName = await this.accountPort.getDisplayName(event.supplier_account);
      let kuName = event.braname;
      try {
        kuName = await this.accountPort.getDisplayName(event.braname);
      } catch {
        /* оставляем braname */
      }
      const payload: Workflows.MarketplaceAplReceptionCancelledBySupplier.IPayload = {
        operatorName,
        supplierName,
        kuName,
        coopname: event.coopname,
        apl_reception_id: event.apl_reception_id,
        deepLinkUrl: `${platformSettings().frontendUrl}/${event.coopname}/market-pvz/reception`,
      };
      await this.notificationSenderService.notifyUser(
        event.operator_account,
        Workflows.MarketplaceAplReceptionCancelledBySupplier.id,
        payload
      );
      this.logger.log(
        `АПП ${event.apl_reception_id}: push оператору ${event.operator_account} об отмене поставщиком отправлен.`
      );
    } catch (err: any) {
      this.logger.warn(
        `АПП ${event.apl_reception_id}: ошибка отправки push оператору об отмене поставщиком (${err.message}) — flow не блокируется.`
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

      const cashierName = await this.accountPort.getDisplayName(cashier.username);
      const supplierName = await this.accountPort.getDisplayName(event.supplier_account);
      const payload: Workflows.MarketplaceCashierNewPayment.IPayload = {
        cashierName,
        supplierName,
        amount: AmountFormatterUtils.formatAmountSafe(event.amount),
        apl_reception_id: event.apl_reception_id,
        payment_request_id: event.payment_request_id,
        coopname: event.coopname,
        // Кассирского стола пока нет — MVP использует стол совета (роль
        // председателя, см. комментарий выше). Реестр платежей фильтруется по
        // владельцу платежа (routeUsername в PaymentsPage.vue) — ведём сразу
        // на платежи конкретного поставщика, а не на общий список.
        deepLinkUrl: `${platformSettings().frontendUrl}/${event.coopname}/soviet/payments/${event.supplier_account}`,
      };
      await this.notificationSenderService.notifyUser(
        cashier.username,
        Workflows.MarketplaceCashierNewPayment.id,
        payload
      );
      this.logger.log(
        `Payment ${event.payment_request_id}: push кассиру ${cashier.username} отправлен.`
      );
    } catch (err: any) {
      this.logger.warn(
        `Payment ${event.payment_request_id}: ошибка отправки push кассиру (${err.message}) — flow не блокируется.`
      );
    }
  }

  @OnEvent(MARKETPLACE_NEW_SUPPLIER_REQUEST_EVENT)
  async handleNewSupplierRequest(event: MarketplaceNewSupplierRequestEvent): Promise<void> {
    try {
      const chairman = await this.findAdminRecipient();
      if (!chairman) {
        this.logger.warn(
          `Заявка поставщика ${event.member_account}: администратор не найден — push пропущен.`
        );
        return;
      }

      const chairmanName = await this.accountPort.getDisplayName(chairman.username);
      const supplierName = await this.accountPort.getDisplayName(event.member_account);
      const payload: Workflows.MarketplaceNewSupplierRequest.IPayload = {
        chairmanName,
        supplierName,
        contractNumber: event.contract_number,
        coopname: event.coopname,
        deepLinkUrl: `${platformSettings().frontendUrl}/${event.coopname}/market-admin/suppliers`,
      };
      await this.notificationSenderService.notifyUser(
        chairman.username,
        Workflows.MarketplaceNewSupplierRequest.id,
        payload
      );
      this.logger.log(
        `Заявка поставщика ${event.member_account}: push председателю ${chairman.username} отправлен.`
      );
    } catch (err: any) {
      this.logger.warn(
        `Заявка поставщика ${event.member_account}: ошибка отправки push председателю (${err.message}) — flow не блокируется.`
      );
    }
  }

  @OnEvent(MARKETPLACE_SUPPLIER_APPROVED_EVENT)
  async handleSupplierApproved(event: MarketplaceSupplierApprovedEvent): Promise<void> {
    try {
      const supplierName = await this.accountPort.getDisplayName(event.member_account);
      const payload: Workflows.MarketplaceSupplierApproved.IPayload = {
        supplierName,
        contractNumber: event.contract_number,
        coopname: event.coopname,
        deepLinkUrl: `${platformSettings().frontendUrl}/${event.coopname}/market-supplier/my-offers`,
      };
      await this.notificationSenderService.notifyUser(
        event.member_account,
        Workflows.MarketplaceSupplierApproved.id,
        payload
      );
      this.logger.log(
        `Заявка поставщика ${event.member_account}: push об одобрении допуска отправлен.`
      );
    } catch (err: any) {
      this.logger.warn(
        `Заявка поставщика ${event.member_account}: ошибка отправки push об одобрении (${err.message}) — flow не блокируется.`
      );
    }
  }

  @OnEvent(MARKETPLACE_SUPPLIER_PAYMENT_CONFIRMED_EVENT)
  async handleSupplierPaymentConfirmed(event: MarketplaceSupplierPaymentConfirmedEvent): Promise<void> {
    try {
      const supplierName = await this.accountPort.getDisplayName(event.supplier_account);
      const payload: Workflows.MarketplaceSupplierPaymentConfirmed.IPayload = {
        supplierName,
        amount: AmountFormatterUtils.formatAmountSafe(event.amount),
        paymentReference: event.payment_reference,
        apl_reception_id: event.apl_reception_id,
        payment_request_id: event.payment_request_id,
        coopname: event.coopname,
        deepLinkUrl: `${platformSettings().frontendUrl}/${event.coopname}/market-supplier/payments`,
      };
      await this.notificationSenderService.notifyUser(
        event.supplier_account,
        Workflows.MarketplaceSupplierPaymentConfirmed.id,
        payload
      );
      this.logger.log(
        `Payment ${event.payment_request_id}: push поставщику ${event.supplier_account} о выплате отправлен.`
      );
    } catch (err: any) {
      this.logger.warn(
        `Payment ${event.payment_request_id}: ошибка отправки push поставщику (${err.message}) — flow не блокируется.`
      );
    }
  }

  @OnEvent(MARKETPLACE_ORDER_READY_TO_RECEIVE_EVENT)
  async handleOrderReadyToReceive(event: MarketplaceOrderReadyToReceiveEvent): Promise<void> {
    try {
      const ordererName = await this.accountPort.getDisplayName(event.orderer_account);
      let kuName = event.braname;
      try {
        kuName = await this.accountPort.getDisplayName(event.braname);
      } catch {
        /* оставляем braname */
      }
      const payload: Workflows.MarketplaceOrderReady.IPayload = {
        ordererName,
        kuName,
        coopname: event.coopname,
        order_id: event.order_id,
        deepLinkUrl: `${platformSettings().frontendUrl}/${event.coopname}/market/my-orders`,
      };
      await this.notificationSenderService.notifyUser(
        event.orderer_account,
        Workflows.MarketplaceOrderReady.id,
        payload
      );
      this.logger.log(
        `Order ${event.order_id}: push заказчику ${event.orderer_account} о готовности к получению отправлен.`
      );
    } catch (err: any) {
      this.logger.warn(
        `Order ${event.order_id}: ошибка отправки push заказчику о готовности (${err.message}) — flow не блокируется.`
      );
    }
  }

  @OnEvent(MARKETPLACE_RETURN_CLAIM_SUBMITTED_EVENT)
  async handleReturnClaimSubmitted(event: MarketplaceReturnClaimSubmittedEvent): Promise<void> {
    try {
      // Адресуем всем операторам КУ доставки (trustee + trusted) — они
      // равны в правах по столу ПВЗ, новый return-claim видят все. Веер
      // уведомлений сохраняет инвариант «никто не пропустил» без ввода
      // понятия «главный получатель уведомления».
      const operators = await this.kuChairmanService.listOperatorsOfBranch(
        event.coopname,
        event.delivery_braname
      );
      if (operators.length === 0) {
        this.logger.warn(
          `Заявление на возврат ${event.claim_id}: у КУ ${event.delivery_braname} нет ни председателя, ни доверенных лиц — push пропущен.`
        );
        return;
      }
      const ordererName = await this.accountPort.getDisplayName(event.orderer_account);
      const reasonExcerpt =
        event.reason_text.length > 240 ? event.reason_text.slice(0, 240) + '…' : event.reason_text;
      for (const operatorAccount of operators) {
        try {
          const recipientName = await this.accountPort.getDisplayName(operatorAccount);
          const payload: Workflows.MarketplaceReturnClaimSubmitted.IPayload = {
            recipientName,
            ordererName,
            brananame: event.delivery_braname,
            coopname: event.coopname,
            claim_id: event.claim_id,
            order_id: event.order_id,
            reasonExcerpt,
            deepLinkUrl: `${platformSettings().frontendUrl}/${event.coopname}/market-pvz/returns/${event.claim_id}`,
          };
          await this.notificationSenderService.notifyUser(
            operatorAccount,
            Workflows.MarketplaceReturnClaimSubmitted.id,
            payload
          );
          this.logger.log(
            `Заявление на возврат ${event.claim_id}: push оператору ${operatorAccount} отправлен.`
          );
        } catch (innerErr: any) {
          this.logger.warn(
            `Заявление на возврат ${event.claim_id}: ошибка push оператору ${operatorAccount} (${innerErr.message}) — продолжаем веер.`
          );
        }
      }
    } catch (err: any) {
      this.logger.warn(
        `Заявление на возврат ${event.claim_id}: ошибка push операторам КУ (${err.message}) — flow не блокируется.`
      );
    }
  }

  @OnEvent(MARKETPLACE_RETURN_CLAIM_DECIDED_EVENT)
  async handleReturnClaimDecided(event: MarketplaceReturnClaimDecidedEvent): Promise<void> {
    // approve_visit, reject_remote, accept_at_visit, reject_at_visit — для
    // approve_visit отправляем приглашение на очный осмотр; финальные исходы
    // ещё раз продублируются finalized-событием с восстановленной суммой.
    if (event.decision !== 'approve_visit') {
      // Финал — пользуем finalized-листенер.
      return;
    }
    try {
      const ordererName = await this.accountPort.getDisplayName(event.orderer_account);
      let kuName = event.braname;
      try {
        kuName = await this.accountPort.getDisplayName(event.braname);
      } catch {
        /* оставляем braname */
      }
      const decisionHuman = `Председатель пригласил вас на очный осмотр на КУ ${kuName}`;
      const payload: Workflows.MarketplaceReturnClaimDecided.IPayload = {
        ordererName,
        decisionHuman,
        brananame: kuName,
        coopname: event.coopname,
        claim_id: event.claim_id,
        order_id: '',
        comment: event.comment,
        deepLinkUrl: `${platformSettings().frontendUrl}/${event.coopname}/market/returns/${event.claim_id}`,
      };
      await this.notificationSenderService.notifyUser(
        event.orderer_account,
        Workflows.MarketplaceReturnClaimDecided.id,
        payload
      );
      this.logger.log(
        `Заявление на возврат ${event.claim_id}: push заказчику ${event.orderer_account} (одобрен очный визит) отправлен.`
      );
    } catch (err: any) {
      this.logger.warn(
        `Заявление на возврат ${event.claim_id}: ошибка push заказчику (${err.message}) — flow не блокируется.`
      );
    }
  }

  @OnEvent(MARKETPLACE_RETURN_CLAIM_FINALIZED_EVENT)
  async handleReturnClaimFinalized(event: MarketplaceReturnClaimFinalizedEvent): Promise<void> {
    try {
      const ordererName = await this.accountPort.getDisplayName(event.orderer_account);
      let outcomeHuman: string;
      let returnedAmount: string | undefined;
      switch (event.decision) {
        case 'accept_at_visit':
          outcomeHuman = 'Возврат принят — средства восстановлены на программе Стола Заказов';
          returnedAmount = event.ledger_snapshot?.amount
            ? AmountFormatterUtils.formatAmountSafe(event.ledger_snapshot.amount)
            : undefined;
          break;
        case 'reject_remote':
          outcomeHuman = 'Возврат отклонён удалённо председателем';
          break;
        case 'reject_at_visit':
          outcomeHuman = 'Возврат отклонён по результатам очного осмотра';
          break;
        default:
          outcomeHuman = 'Возврат завершён';
      }
      const payload: Workflows.MarketplaceReturnClaimFinalized.IPayload = {
        ordererName,
        outcomeHuman,
        coopname: event.coopname,
        claim_id: event.claim_id,
        order_id: '',
        returnedAmount,
        // Готовый суффикс для in-app/push — {% if %} в теле шага Центром
        // уведомлений не вычисляется (см. комментарий в схеме воркфлоу).
        returnedAmountSuffix: returnedAmount ? ` — ${returnedAmount} ₽ восстановлены` : '',
        deepLinkUrl: `${platformSettings().frontendUrl}/${event.coopname}/market/returns/${event.claim_id}`,
      };
      await this.notificationSenderService.notifyUser(
        event.orderer_account,
        Workflows.MarketplaceReturnClaimFinalized.id,
        payload
      );
      this.logger.log(
        `Заявление на возврат ${event.claim_id}: финальный push заказчику ${event.orderer_account} отправлен (${event.decision}).`
      );
    } catch (err: any) {
      this.logger.warn(
        `Заявление на возврат ${event.claim_id}: ошибка финального push заказчику (${err.message}) — flow не блокируется.`
      );
    }
  }

  @OnEvent(MARKETPLACE_SUPPLIER_PAYMENT_DECLINED_EVENT)
  async handleSupplierPaymentDeclined(event: MarketplaceSupplierPaymentDeclinedEvent): Promise<void> {
    try {
      const supplierName = await this.accountPort.getDisplayName(event.supplier_account);
      const payload: Workflows.MarketplaceSupplierPaymentDeclined.IPayload = {
        supplierName,
        amount: AmountFormatterUtils.formatAmountSafe(event.amount),
        reason: event.reason,
        apl_reception_id: event.apl_reception_id,
        payment_request_id: event.payment_request_id,
        coopname: event.coopname,
        deepLinkUrl: `${platformSettings().frontendUrl}/${event.coopname}/market-supplier/payments`,
      };
      await this.notificationSenderService.notifyUser(
        event.supplier_account,
        Workflows.MarketplaceSupplierPaymentDeclined.id,
        payload
      );
      this.logger.log(
        `Payment ${event.payment_request_id}: push поставщику ${event.supplier_account} об отказе выплаты отправлен.`
      );
    } catch (err: any) {
      this.logger.warn(
        `Payment ${event.payment_request_id}: ошибка отправки push поставщику об отказе (${err.message}) — flow не блокируется.`
      );
    }
  }

  @OnEvent(MARKETPLACE_AID_COUNCIL_DECIDED_EVENT)
  async handleAidCouncilDecided(event: MarketplaceAidCouncilDecidedEvent): Promise<void> {
    try {
      const memberName = await this.accountPort.getDisplayName(event.member_account);
      const outcomeHuman = event.approved
        ? 'Совет одобрил выплату — заявка передана кассиру, ожидайте перевод на указанные реквизиты.'
        : 'Совет отказал в выплате — средства остались на вашем кошельке, заявление можно подать заново.';
      const payload: Workflows.MarketplaceAidCouncilDecided.IPayload = {
        memberName,
        amount: AmountFormatterUtils.formatAmountSafe(event.amount),
        outcomeHuman,
        // Готовый суффикс: ветвление в теле шага Центром уведомлений не вычисляется.
        reasonSuffix: !event.approved && event.reason ? ` Причина: ${event.reason}.` : '',
        coopname: event.coopname,
        deepLinkUrl: `${platformSettings().frontendUrl}/${event.coopname}/market-pvz/economy`,
      };
      await this.notificationSenderService.notifyUser(
        event.member_account,
        Workflows.MarketplaceAidCouncilDecided.id,
        payload
      );
      this.logger.log(
        `Матпомощь ${event.member_account}: push о решении совета отправлен (approved=${event.approved}).`
      );
    } catch (err: any) {
      this.logger.warn(
        `Матпомощь ${event.member_account}: ошибка отправки push о решении совета (${err.message}) — flow не блокируется.`
      );
    }
  }

  @OnEvent(MARKETPLACE_AID_PAYOUT_CONFIRMED_EVENT)
  async handleAidPayoutConfirmed(event: MarketplaceAidPayoutConfirmedEvent): Promise<void> {
    try {
      const memberName = await this.accountPort.getDisplayName(event.member_account);
      const payload: Workflows.MarketplaceAidPayoutConfirmed.IPayload = {
        memberName,
        amount: AmountFormatterUtils.formatAmountSafe(event.amount),
        paymentDestination: event.payment_destination ?? '',
        coopname: event.coopname,
        deepLinkUrl: `${platformSettings().frontendUrl}/${event.coopname}/market-pvz/economy`,
      };
      await this.notificationSenderService.notifyUser(
        event.member_account,
        Workflows.MarketplaceAidPayoutConfirmed.id,
        payload
      );
      this.logger.log(
        `Матпомощь ${event.member_account}: push о выплате отправлен.`
      );
    } catch (err: any) {
      this.logger.warn(
        `Матпомощь ${event.member_account}: ошибка отправки push о выплате (${err.message}) — flow не блокируется.`
      );
    }
  }

  @OnEvent(MARKETPLACE_NEW_ORDER_FOR_SUPPLIER_EVENT)
  async handleNewOrderForSupplier(event: MarketplaceNewOrderForSupplierEvent): Promise<void> {
    try {
      const supplierName = await this.accountPort.getDisplayName(event.supplier_account);
      const ordererName = await this.accountPort.getDisplayName(event.orderer_account);
      const payload: Workflows.MarketplaceNewOrderForSupplier.IPayload = {
        supplierName,
        ordererName,
        quantity: event.quantity,
        totalCost: AmountFormatterUtils.formatAmountSafe(event.total_cost),
        coopname: event.coopname,
        order_id: event.order_id,
        deepLinkUrl: `${platformSettings().frontendUrl}/${event.coopname}/market-supplier/incoming-orders`,
      };
      await this.notificationSenderService.notifyUser(
        event.supplier_account,
        Workflows.MarketplaceNewOrderForSupplier.id,
        payload
      );
      this.logger.log(
        `Order ${event.order_id}: уведомление поставщику ${event.supplier_account} о новом заказе отправлено.`
      );
    } catch (err: any) {
      this.logger.warn(
        `Order ${event.order_id}: ошибка отправки уведомления поставщику о новом заказе (${err.message}) — flow не блокируется.`
      );
    }
  }

  @OnEvent(MARKETPLACE_ORDER_DECLINED_BY_SUPPLIER_EVENT)
  async handleOrderDeclinedBySupplier(event: MarketplaceOrderDeclinedBySupplierEvent): Promise<void> {
    try {
      const ordererName = await this.accountPort.getDisplayName(event.orderer_account);
      // КУ резолвится в человеческое имя участка (account_kind=branch); при сбое
      // деградируем к braname, чтобы текст не остался пустым.
      let kuName = event.delivery_braname;
      try {
        kuName = await this.accountPort.getDisplayName(event.delivery_braname);
      } catch {
        /* оставляем braname */
      }
      const reasonExcerpt =
        event.reason.length > 240 ? event.reason.slice(0, 240) + '…' : event.reason;
      const payload: Workflows.MarketplaceOrderDeclinedBySupplier.IPayload = {
        ordererName,
        productName: event.product_name,
        kuName,
        reasonExcerpt,
        coopname: event.coopname,
        order_id: event.order_id,
        deepLinkUrl: `${platformSettings().frontendUrl}/${event.coopname}/market/my-orders`,
      };
      await this.notificationSenderService.notifyUser(
        event.orderer_account,
        Workflows.MarketplaceOrderDeclinedBySupplier.id,
        payload
      );
      this.logger.log(
        `Order ${event.order_id}: push заказчику ${event.orderer_account} об отказе поставщика отправлен.`
      );
    } catch (err: any) {
      this.logger.warn(
        `Order ${event.order_id}: ошибка отправки push заказчику об отказе поставщика (${err.message}) — flow не блокируется.`
      );
    }
  }

  @OnEvent(MARKETPLACE_RETURN_ACCEPTED_FOR_SUPPLIER_EVENT)
  async handleReturnAcceptedForSupplier(
    event: MarketplaceReturnAcceptedForSupplierEvent
  ): Promise<void> {
    try {
      const supplierName = await this.accountPort.getDisplayName(event.supplier_account);
      const reasonExcerpt =
        event.inspection_result.length > 240
          ? event.inspection_result.slice(0, 240) + '…'
          : event.inspection_result;
      const payload: Workflows.MarketplaceReturnAcceptedSupplier.IPayload = {
        supplierName,
        kuName: event.braname,
        reasonExcerpt,
        coopname: event.coopname,
        claim_id: event.claim_id,
        order_id: event.order_id,
        deepLinkUrl: `${platformSettings().frontendUrl}/${event.coopname}/market-supplier/incoming-orders`,
      };
      await this.notificationSenderService.notifyUser(
        event.supplier_account,
        Workflows.MarketplaceReturnAcceptedSupplier.id,
        payload
      );
      this.logger.log(
        `Заявление на возврат ${event.claim_id}: уведомление поставщику ${event.supplier_account} о приёме возврата в кооператив отправлено.`
      );
    } catch (err: any) {
      this.logger.warn(
        `Заявление на возврат ${event.claim_id}: ошибка отправки уведомления поставщику о приёме возврата (${err.message}) — flow не блокируется.`
      );
    }
  }
  /**
   * Адресат уведомлений стола администратора.
   *
   * Право `Offer:moderate` и реестр поставщиков живут в extension-роли `admin`,
   * а её по маппингу core-ролей получает председатель — поэтому ищем аккаунт с
   * core-ролью `chairman`. Отдельной extension-роли модератора пока нет; когда
   * появится, менять фильтр нужно здесь одном месте.
   */
  private async findAdminRecipient(): Promise<{ username: string } | null> {
    const admins = await this.accountPort.getAccounts(
      { role: 'chairman' },
      { page: 1, limit: 1, sortOrder: 'ASC' }
    );
    return admins.items?.[0] ?? null;
  }

  @OnEvent(MARKETPLACE_OFFER_MODERATION_REQUESTED_EVENT)
  async handleOfferOnModeration(event: MarketplaceOfferModerationRequestedEvent): Promise<void> {
    try {
      const admin = await this.findAdminRecipient();
      if (!admin) {
        this.logger.warn(
          `Предложение ${event.offer_id}: администратор не найден — уведомление о модерации пропущено.`
        );
        return;
      }
      const payload: Workflows.MarketplaceOfferOnModeration.IPayload = {
        recipientName: await this.accountPort.getDisplayName(admin.username),
        supplierName: await this.accountPort.getDisplayName(event.supplier_account),
        productName: event.product_name,
        coopname: event.coopname,
        deepLinkUrl: `${platformSettings().frontendUrl}/${event.coopname}/market-admin/moderation`,
      };
      await this.notificationSenderService.notifyUser(
        admin.username,
        Workflows.MarketplaceOfferOnModeration.id,
        payload
      );
      this.logger.log(
        `Предложение ${event.offer_id}: уведомление о модерации администратору ${admin.username} отправлено.`
      );
    } catch (err: any) {
      this.logger.warn(
        `Предложение ${event.offer_id}: ошибка уведомления администратора о модерации (${err.message}) — flow не блокируется.`
      );
    }
  }

  @OnEvent(MARKETPLACE_OFFER_APPROVED_EVENT)
  async handleOfferApproved(event: MarketplaceOfferApprovedEvent): Promise<void> {
    try {
      const payload: Workflows.MarketplaceOfferApproved.IPayload = {
        supplierName: await this.accountPort.getDisplayName(event.supplier_account),
        productName: event.product_name,
        coopname: event.coopname,
        deepLinkUrl: `${platformSettings().frontendUrl}/${event.coopname}/market-supplier/my-offers`,
      };
      await this.notificationSenderService.notifyUser(
        event.supplier_account,
        Workflows.MarketplaceOfferApproved.id,
        payload
      );
      this.logger.log(
        `Предложение ${event.offer_id}: уведомление об одобрении поставщику ${event.supplier_account} отправлено.`
      );
    } catch (err: any) {
      this.logger.warn(
        `Предложение ${event.offer_id}: ошибка уведомления поставщика об одобрении (${err.message}) — flow не блокируется.`
      );
    }
  }

  @OnEvent(MARKETPLACE_OFFER_REJECTED_EVENT)
  async handleOfferRejected(event: MarketplaceOfferRejectedEvent): Promise<void> {
    try {
      const payload: Workflows.MarketplaceOfferRejected.IPayload = {
        supplierName: await this.accountPort.getDisplayName(event.supplier_account),
        productName: event.product_name,
        reason: event.reason,
        coopname: event.coopname,
        deepLinkUrl: `${platformSettings().frontendUrl}/${event.coopname}/market-supplier/my-offers`,
      };
      await this.notificationSenderService.notifyUser(
        event.supplier_account,
        Workflows.MarketplaceOfferRejected.id,
        payload
      );
      this.logger.log(
        `Предложение ${event.offer_id}: уведомление об отказе поставщику ${event.supplier_account} отправлено.`
      );
    } catch (err: any) {
      this.logger.warn(
        `Предложение ${event.offer_id}: ошибка уведомления поставщика об отказе (${err.message}) — flow не блокируется.`
      );
    }
  }
}
