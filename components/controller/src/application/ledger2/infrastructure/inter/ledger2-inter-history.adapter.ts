import { Injectable } from '@nestjs/common';
import type { InterLedger2HistoryFilter, InterLedger2HistoryPort, InterLedger2HistoryResult } from '@coopenomics/inter';
import { Ledger2Service } from '../../services/ledger2.service';

/**
 * Реализация `InterLedger2HistoryPort` для consumer-extension'ов (marketplace,
 * capital, EMP). Тонкий passthrough к `Ledger2Service.getHistory` — поля
 * входа/выхода порта зеркалят `GetLedger2HistoryInputDTO`/`Ledger2OperationDTO`
 * 1:1, поэтому маппинга нет. Авторизация (какой кошелёк вправе смотреть
 * вызывающий) — ответственность consumer'а, порт её не делает.
 */
@Injectable()
export class Ledger2InterHistoryAdapter implements InterLedger2HistoryPort {
  constructor(private readonly ledger2Service: Ledger2Service) {}

  async getHistory(filter: InterLedger2HistoryFilter): Promise<InterLedger2HistoryResult> {
    return this.ledger2Service.getHistory(filter);
  }
}
