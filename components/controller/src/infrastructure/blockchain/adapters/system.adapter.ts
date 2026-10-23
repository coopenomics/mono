import { Injectable } from '@nestjs/common';
import { BlockchainService } from '../blockchain.service';
import type { SystemBlockchainPort } from '~/domain/system/interfaces/system-blockchain.port';
import type { GetInfoResult } from '~/types/shared/blockchain.types';

/**
 * Системный порт к цепи. Конвертация паевого взноса в AXON отсюда убрана
 * (Epic 13, решение @ant 2026-06-11): действие `soviet::converttoaxn`
 * упразднено в пользу двухшаговой модели — пайщик переводит паевой → членский
 * на `w.wal.bill` (`billing::convert`, BillingBlockchainAdapter), AXON
 * кооперативу докупает хаб (`billing::converttoaxn` подписью оператора).
 */
@Injectable()
export class SystemBlockchainAdapter implements SystemBlockchainPort {
  constructor(private readonly blockchainService: BlockchainService) {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getInfo(coopname: string): Promise<GetInfoResult> {
    return this.blockchainService.getInfo();
  }
}
