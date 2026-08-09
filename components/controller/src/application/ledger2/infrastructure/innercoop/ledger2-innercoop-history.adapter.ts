import { Injectable } from '@nestjs/common';
import type { InnerLedger2HistoryFilter, ILedger2HistoryPort, InnerLedger2HistoryResult } from '@coopenomics/innercoop';
import { Ledger2Service } from '../../services/ledger2.service';

/**
 * Реализация `ILedger2HistoryPort` для consumer-extension'ов (marketplace,
 * capital, EMP). Тонкий passthrough к `Ledger2Service.getHistory` — поля
 * входа/выхода порта зеркалят `GetLedger2HistoryInputDTO`/`Ledger2OperationDTO`
 * 1:1, поэтому маппинга нет. Авторизация (какой кошелёк вправе смотреть
 * вызывающий) — ответственность consumer'а, порт её не делает.
 */
@Injectable()
export class Ledger2InnercoopHistoryAdapter implements ILedger2HistoryPort {
  constructor(private readonly ledger2Service: Ledger2Service) {}

  async getHistory(filter: InnerLedger2HistoryFilter): Promise<InnerLedger2HistoryResult> {
    return this.ledger2Service.getHistory(filter);
  }
}
