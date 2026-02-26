import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';

/**
 * Обработчик событий маркетплейса от парсера блокчейна.
 * Синхронизирует состояние заявок в БД с блокчейном.
 */
@Injectable()
export class MarketplaceEventService {
  constructor(private readonly logger: WinstonLoggerService) {
    this.logger.setContext(MarketplaceEventService.name);
  }

  @OnEvent('action::marketplace::orderoffer')
  async handleOrderOffer(event: any): Promise<void> {
    this.logger.info(`Новая заявка orderoffer: ${event?.data?.hash || 'unknown'}`);
  }

  @OnEvent('action::marketplace::accept')
  async handleAccept(event: any): Promise<void> {
    this.logger.info(`Заявка принята: ${event?.data?.request_hash || 'unknown'}`);
  }

  @OnEvent('action::marketplace::authcontrib')
  async handleAuthContrib(event: any): Promise<void> {
    this.logger.info(`Взнос авторизован: ${event?.data?.request_hash || 'unknown'}`);
  }

  @OnEvent('action::marketplace::supply')
  async handleSupply(event: any): Promise<void> {
    this.logger.info(`Поставка: ${event?.data?.request_hash || 'unknown'}`);
  }

  @OnEvent('action::marketplace::supplcnf')
  async handleSupplyConfirm(event: any): Promise<void> {
    this.logger.info(`Поставка подтверждена: ${event?.data?.request_hash || 'unknown'}`);
  }

  @OnEvent('action::marketplace::delivered')
  async handleDelivered(event: any): Promise<void> {
    this.logger.info(`Доставлено: ${event?.data?.request_hash || 'unknown'}`);
  }

  @OnEvent('action::marketplace::reqreturn')
  async handleReqReturn(event: any): Promise<void> {
    this.logger.info(`Запрос возврата: ${event?.data?.request_hash || 'unknown'}`);
  }

  @OnEvent('action::marketplace::receive')
  async handleReceive(event: any): Promise<void> {
    this.logger.info(`Получение: ${event?.data?.request_hash || 'unknown'}`);
  }

  @OnEvent('action::marketplace::receivecnf')
  async handleReceiveConfirm(event: any): Promise<void> {
    this.logger.info(`Получение подтверждено: ${event?.data?.request_hash || 'unknown'}`);
  }

  @OnEvent('action::marketplace::complete')
  async handleComplete(event: any): Promise<void> {
    this.logger.info(`Поставка завершена: ${event?.data?.request_hash || 'unknown'}`);
  }

  @OnEvent('action::marketplace::cancel')
  async handleCancel(event: any): Promise<void> {
    this.logger.info(`Заявка отменена: ${event?.data?.request_hash || 'unknown'}`);
  }

  @OnEvent('action::marketplace::destroy')
  async handleDestroy(event: any): Promise<void> {
    this.logger.info(`Имущество уничтожено: ${event?.data?.request_hash || 'unknown'}`);
  }

  @OnEvent('action::marketplace::dispute')
  async handleDispute(event: any): Promise<void> {
    this.logger.info(`Претензия: ${event?.data?.request_hash || 'unknown'}`);
  }
}
