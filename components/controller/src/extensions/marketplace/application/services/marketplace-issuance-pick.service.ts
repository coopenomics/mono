import { Inject, Injectable } from '@nestjs/common';
import {
  MARKETPLACE_CONTAINER_REPOSITORY,
  type MarketplaceContainerDomainRepository,
} from '../../domain/repositories/marketplace-container.repository';
import {
  MARKETPLACE_INVENTORY_REPOSITORY,
  type MarketplaceInventoryDomainRepository,
} from '../../domain/repositories/marketplace-inventory.repository';
import { MarketplaceInventoryOnWarehouseStatuses } from '../../domain/entities/marketplace-inventory.types';
import type { MarketplaceInventoryDomainEntity } from '../../domain/entities/marketplace-inventory.entity';
import {
  MarketplaceHandoffCodeKind,
  parseMarketplaceHandoffCode,
} from '../../domain/marketplace-handoff-code';
import {
  MarketplaceIssuancePickTarget,
  MarketplaceIssuancePickVerdict,
  type MarketplaceIssuancePickScanDTO,
} from '../dto/marketplace-issuance-pick.dto';

/**
 * Подбор имущества на выдаче (99D-18). Оператор открыл выдачу пайщику, идёт
 * на склад и сканирует бокс или этикетку имущества. Сервер сверяет код с
 * заказами, открытыми в окне выдачи:
 *  - бокс — подсказка, куда идти: есть ли в нём имущество этой выдачи;
 *  - этикетка — доказательство: то ли это имущество и по какому заказу.
 *
 * Сервис только читает склад и ничего не меняет: режим мягкий, галку и
 * количество окно выдачи ставит само, отправку на подпись скан не блокирует.
 * Разбор кода живёт на сервере, как у общего сканера стола (598-62).
 */
@Injectable()
export class MarketplaceIssuancePickService {
  constructor(
    @Inject(MARKETPLACE_INVENTORY_REPOSITORY)
    private readonly inventory: MarketplaceInventoryDomainRepository,
    @Inject(MARKETPLACE_CONTAINER_REPOSITORY)
    private readonly containers: MarketplaceContainerDomainRepository
  ) {}

  async scan(coopname: string, braname: string, orderIds: string[], raw: string): Promise<MarketplaceIssuancePickScanDTO> {
    const code = raw.trim();
    const orders = new Set(orderIds);

    // Код бокса: QR бокса либо код с этикетки бокса, набранный руками.
    const parsed = parseMarketplaceHandoffCode(code, coopname);
    if (parsed?.kind === MarketplaceHandoffCodeKind.Container && parsed.coopname === coopname) {
      return this.scanContainer(coopname, braname, orders, parsed.ref);
    }

    // Иначе — штрих-код этикетки имущества (EAN-13 либо Code 128).
    const item = await this.inventory.findByBarcode(coopname, code);
    if (!item) return empty(null, MarketplaceIssuancePickVerdict.UNKNOWN);
    return this.scanLabel(braname, orders, item);
  }

  private scanLabel(
    braname: string,
    orders: Set<string>,
    item: MarketplaceInventoryDomainEntity
  ): MarketplaceIssuancePickScanDTO {
    const base = {
      ...empty(MarketplaceIssuancePickTarget.LABEL, MarketplaceIssuancePickVerdict.UNKNOWN),
      inventory_id: item.id,
      quantity: item.quantity_per_label,
      product_name: item.product_name_snapshot,
    };
    if (item.braname !== braname) return { ...base, verdict: MarketplaceIssuancePickVerdict.OTHER_BRANCH };
    if (!MarketplaceInventoryOnWarehouseStatuses.includes(item.status)) {
      return { ...base, verdict: MarketplaceIssuancePickVerdict.NOT_ON_WAREHOUSE };
    }
    const orderId = matchedOrder(item, orders);
    if (!orderId) return { ...base, verdict: MarketplaceIssuancePickVerdict.OTHER_ORDER };
    return { ...base, verdict: MarketplaceIssuancePickVerdict.MATCH, order_id: orderId };
  }

  private async scanContainer(
    coopname: string,
    braname: string,
    orders: Set<string>,
    containerCode: string
  ): Promise<MarketplaceIssuancePickScanDTO> {
    const container = await this.containers.findByCode(coopname, containerCode);
    if (!container) return empty(MarketplaceIssuancePickTarget.CONTAINER, MarketplaceIssuancePickVerdict.UNKNOWN);
    const base = { ...empty(MarketplaceIssuancePickTarget.CONTAINER, MarketplaceIssuancePickVerdict.UNKNOWN), container_code: container.code };
    if (container.braname !== braname) return { ...base, verdict: MarketplaceIssuancePickVerdict.OTHER_BRANCH };

    // Имущество выдачи на складе: адресное по заказу и зарезервированный
    // остаток кооператива под заказ из остатка. Заказов в окне единицы —
    // список по каждому дешевле отдельного запроса по боксу.
    const inBox = new Set<string>();
    for (const order_id of orders) {
      const [own, reserved] = await Promise.all([
        this.inventory.list({ coopname, order_id, status: [...MarketplaceInventoryOnWarehouseStatuses] }),
        this.inventory.list({ coopname, reserved_order_id: order_id, status: [...MarketplaceInventoryOnWarehouseStatuses] }),
      ]);
      if ([...own, ...reserved].some((i) => i.container_id === container.id)) inBox.add(order_id);
    }
    if (inBox.size === 0) return { ...base, verdict: MarketplaceIssuancePickVerdict.BOX_EMPTY };
    return { ...base, verdict: MarketplaceIssuancePickVerdict.MATCH, order_ids: [...inBox] };
  }
}

function empty(
  target: MarketplaceIssuancePickTarget | null,
  verdict: MarketplaceIssuancePickVerdict
): MarketplaceIssuancePickScanDTO {
  return {
    target,
    verdict,
    inventory_id: null,
    order_id: null,
    quantity: null,
    product_name: null,
    container_code: null,
    order_ids: [],
  };
}

/** Заказ выдачи, к которому относится позиция: адресная по заказу либо резерв остатка. */
function matchedOrder(item: MarketplaceInventoryDomainEntity, orders: Set<string>): string | null {
  if (orders.has(item.order_id)) return item.order_id;
  return item.reserved_order_id && orders.has(item.reserved_order_id) ? item.reserved_order_id : null;
}
