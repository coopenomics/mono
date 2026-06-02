import { Body, Controller, HttpCode, HttpStatus, Logger, Post, UseGuards } from '@nestjs/common';
import { ServerSecretGuard } from '../guards/server-secret.guard';
import { BillingNotificationRequestDTO } from '../dto/billing-notification.dto';
import { BillingNotificationBridgeService } from '../services/billing-notification-bridge.service';

/**
 * Epic 14 — входящий канал биллинговых оповещений от провайдера (Восход backend).
 * Защищён общим SERVER_SECRET (ServerSecretGuard), симметрично провайдеру.
 */
@Controller('billing-notifications')
@UseGuards(ServerSecretGuard)
export class BillingNotificationController {
  private readonly logger = new Logger(BillingNotificationController.name);

  constructor(private readonly bridge: BillingNotificationBridgeService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async receive(@Body() dto: BillingNotificationRequestDTO): Promise<{ accepted: true }> {
    // Не пробрасываем ошибку Novu наружу — провайдеру важен лишь факт приёма intent'а;
    // повтор/ретрай при сбое — задача провайдера, дедуп тоже у него.
    try {
      await this.bridge.handleIntent(dto);
    } catch (error: any) {
      this.logger.error(
        `Ошибка обработки billing-notification kind=${dto.kind} coop=${dto.coopname}: ${error.message}`,
        error.stack
      );
    }
    return { accepted: true };
  }
}
