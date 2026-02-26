import { Injectable, Inject, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { COOPLACE_BLOCKCHAIN_PORT, type CooplaceBlockchainPort } from '~/domain/cooplace/interfaces/cooplace-blockchain.port';
import { config } from '~/config';

/**
 * CycleService — управление циклами поставки.
 *
 * Циклы НЕ влияют на match (каждая заявка сразу в блокчейн).
 * Циклы определяют:
 * - Когда поставщик НАЧИНАЕТ поставку (supply) — при наборе min_units
 * - Когда цикл истекает — cancel всех заявок через блокчейн, возврат средств
 *
 * Поток:
 * 1. Карточка published, cycle_deadline задан
 * 2. Заказчики делают заказы → каждый сразу в блокчейн (средства блокируются)
 * 3. cycle_collected_units растёт
 * 4. Если min_units набраны → поставщику разрешено начать supply
 * 5. Если deadline истёк и min_units не набраны → cancel всех заказов через блокчейн
 */
@Injectable()
export class CycleService {
  private readonly logger = new Logger(CycleService.name);

  constructor(
    @Inject(COOPLACE_BLOCKCHAIN_PORT)
    private readonly blockchainPort: CooplaceBlockchainPort,
  ) {}

  /**
   * Проверить, можно ли поставщику начать поставку.
   */
  canStartSupply(collectedUnits: number, minUnits: number): boolean {
    if (!minUnits || minUnits === 0) return true;
    return collectedUnits >= minUnits;
  }

  /**
   * Проверить, истёк ли цикл.
   */
  isCycleExpired(deadline: Date | null | undefined): boolean {
    if (!deadline) return false;
    return new Date() > new Date(deadline);
  }

  /**
   * Отменить заявку в блокчейне (при истечении цикла).
   * Средства возвращаются заказчику через смарт-контракт.
   */
  async cancelOrderInBlockchain(requestHash: string, username: string): Promise<void> {
    try {
      await this.blockchainPort.cancelRequest({
        coopname: config.coopname,
        username,
        request_hash: requestHash,
      } as any);
      this.logger.log(`Заявка ${requestHash.substring(0, 16)}... отменена в блокчейне`);
    } catch (e: any) {
      this.logger.error(`Ошибка отмены заявки ${requestHash.substring(0, 16)}: ${e.message}`);
    }
  }

  /**
   * Периодическая проверка истёкших циклов.
   * Запускается каждые 5 минут.
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async checkExpiredCycles(): Promise<void> {
    this.logger.debug('Проверка истёкших циклов...');
    // TODO: query all published cards with cycle_deadline < now and cycle_active = true
    // For each: get all blockchain orders, cancel them, start new cycle
  }
}
