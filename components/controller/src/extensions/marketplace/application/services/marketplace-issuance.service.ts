import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cooperative, type MarketContract } from 'cooptypes';
import { PublicKey, Signature } from '@wharfkit/antelope';
import http from 'http-status';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import { HttpApiError } from '~/utils/httpApiError';
import {
  MARKETPLACE_ASSET_CONFIG,
  type MarketplaceAssetConfig,
} from './marketplace-asset.config';
import { DocumentDomainService } from '~/domain/document/services/document-domain.service';
import type { DocumentDomainEntity } from '~/domain/document/entity/document-domain.entity';
import type { ISignedDocumentDomainInterface } from '~/domain/document/interfaces/signed-document-domain.interface';
import type { MarketplaceIssueActSignedDocumentInputDTO } from '~/application/document/documents-dto/marketplace-issue-act-document.dto';
import { SignedDigitalDocumentInputDTO } from '~/application/document/dto/signed-digital-document-input.dto';
import {
  MARKETPLACE_ORDER_REPOSITORY,
  type MarketplaceOrderDomainRepository,
} from '../../domain/repositories/marketplace-order.repository';
import {
  MARKETPLACE_CANONICAL_BLOCKCHAIN_PORT,
  type MarketplaceCanonicalBlockchainPort,
} from '../../domain/ports/marketplace-canonical-blockchain.port';
import {
  MARKETPLACE_INVENTORY_REPOSITORY,
  type MarketplaceInventoryDomainRepository,
} from '../../domain/repositories/marketplace-inventory.repository';
import {
  MARKETPLACE_OFFER_REPOSITORY,
  type MarketplaceOfferDomainRepository,
} from '../../domain/repositories/marketplace-offer.repository';
import { computeActNumber } from '../shared/act-number.util';
import { marketplaceOrderUnitLabel } from '../shared/unit-label.util';
import { toQuantityAsset } from '../shared/quantity.util';
import type { MarketplaceOrderDomainEntity } from '../../domain/entities/marketplace-order.entity';
import type { MarketplaceOrderIssuanceFactSnapshot } from '../../domain/entities/marketplace-order.types';
import {
  MARKETPLACE_ORDER_READY_TO_RECEIVE_EVENT,
  type MarketplaceOrderReadyToReceiveEvent,
} from '../events/marketplace-notification.events';

export interface MarketplaceOpenIssuanceInput {
  coopname: string;
  chairman_account: string;
  order_id: string;
  actual_quantity: number;
  /** Скорректированная оператором цена за единицу (бэйр-десятичная строка). */
  actual_unit_price: string;
  signed_document: MarketplaceIssueActSignedDocumentInputDTO;
}

export interface MarketplaceFinalizeIssuanceInput {
  coopname: string;
  orderer_account: string;
  order_id: string;
  signed_document: MarketplaceIssueActSignedDocumentInputDTO;
}

export interface MarketplaceIssuanceResult {
  order: MarketplaceOrderDomainEntity;
  tx_hash: string;
}

/**
 * Story 6.1 / 6.3 (Эпик 6, FR21-FR25): state machine выдачи имущества
 * пайщику на ПВЗ с двойной подписью АПП-выдачи и тремя ветками сверки
 * фактического количества с заказом.
 *
 * Flow:
 *
 *  1. `openIssuance(order_id, actual_quantity, chairman_signed_document)` —
 *     оператор КУ сверяет привезённое имущество с заказом и фиксирует
 *     фактическое количество (`actual_quantity`) прямо при открытии выдачи;
 *     председатель КУ подписывает акт с этим количеством. Backend верифицирует
 *     подпись, сохраняет снапшот фактической выдачи (`issuance_fact`),
 *     отправляет on-chain `signiss1`, переводит Order
 *     ACCEPTED_TO_COOP → READY_TO_RECEIVE и эмитит push заказчику
 *     `marketplace-order-ready` (FR22).
 *
 *  2. `finalizeIssuance(order_id, signed_document)` — заказчик закрывает
 *     выдачу финальной подписью в своём кабинете на своём устройстве: он
 *     лишь подтверждает уже сформированный акт, факт не редактирует.
 *     `actual_quantity` и `delivery_signer` backend берёт из заказа
 *     (зафиксированы оператором при открытии). Backend верифицирует обе
 *     подписи в `signed_document.signatures`, отправляет on-chain `signiss2`
 *     с этим `actual_quantity` — C++ контракт сам исполняет корректирующие
 *     операции (`o.mkt.unlock` если actual<ordered / `o.mkt.lock` если
 *     actual>ordered, FR23) и `o.mkt.consum` (BURN w.mkt.order, Дт 86 /
 *     Кт 10, FR24). Order переводится READY_TO_RECEIVE → RECEIVED.
 *
 * При расхождении фактического количества с заказом и нехватке средств
 * пайщика на доплату (`actual > заказ`, L6 guard) транзакция `signiss2`
 * фейлится на цепи, backend пробрасывает ошибку клиенту с человеческим
 * сообщением (FR25).
 */
@Injectable()
export class MarketplaceIssuanceService {
  constructor(
    @Inject(MARKETPLACE_ORDER_REPOSITORY)
    private readonly orderRepo: MarketplaceOrderDomainRepository,
    @Inject(MARKETPLACE_INVENTORY_REPOSITORY)
    private readonly inventoryRepo: MarketplaceInventoryDomainRepository,
    @Inject(MARKETPLACE_OFFER_REPOSITORY)
    private readonly offerRepo: MarketplaceOfferDomainRepository,
    @Inject(MARKETPLACE_CANONICAL_BLOCKCHAIN_PORT)
    private readonly chainPort: MarketplaceCanonicalBlockchainPort,
    @Inject(MARKETPLACE_ASSET_CONFIG)
    private readonly assetConfig: MarketplaceAssetConfig,
    private readonly documentDomainService: DocumentDomainService,
    private readonly eventBus: EventEmitter2,
    private readonly logger: WinstonLoggerService
  ) {
    this.logger.setContext(MarketplaceIssuanceService.name);
  }

  /**
   * Preview-документ для подписания председателем КУ (первая подпись АПП
   * выдачи). Рендерится через factory под registry_id=1102. Клиент
   * подписывает hash приватным ключом председателя и возвращает результат
   * в `openIssuance`.
   */
  async getOpenIssuanceSignablePayload(
    coopname: string,
    order_id: string,
    chairman_account: string,
    actual_quantity?: number,
    actual_unit_price?: string
  ): Promise<DocumentDomainEntity> {
    const order = await this.loadOrder(coopname, order_id);
    if (order.status !== 'ACCEPTED_TO_COOP') {
      throw new ConflictException(
        `Заказ в статусе «${order.status}», открытие выдачи недопустимо.`
      );
    }
    // Оператор сверяет факт при открытии: акт формируется на фактически
    // выдаваемое количество и цену. Дефолт и потолок — принятое на склад
    // (не заказ!): выдать больше физического остатка нельзя, и акт на большее
    // даже не формируем.
    const available = await this.loadAvailableOnWarehouse(order);
    this.assertWithinWarehouse(order, actual_quantity ?? null, available);
    const fact_quantity =
      actual_quantity && actual_quantity > 0
        ? actual_quantity
        : Math.min(order.quantity, available);
    const fact_unit_price =
      actual_unit_price && Number.parseFloat(actual_unit_price) > 0
        ? actual_unit_price
        : order.price_per_unit;
    return this.generateIssueActDocument({
      order,
      transmitter: chairman_account,
      actual_quantity: fact_quantity,
      actual_unit_price: fact_unit_price,
    });
  }

  async openIssuance(input: MarketplaceOpenIssuanceInput): Promise<MarketplaceIssuanceResult> {
    const order = await this.loadOrder(input.coopname, input.order_id);
    if (order.status !== 'ACCEPTED_TO_COOP') {
      throw new ConflictException(
        `Заказ в статусе «${order.status}», открытие выдачи недопустимо.`
      );
    }
    if (order.chairman_signed_at !== null) {
      throw new ConflictException('Первая подпись выдачи уже зафиксирована для этого заказа.');
    }
    if (input.actual_quantity <= 0) {
      throw new BadRequestException('Фактическое количество должно быть больше нуля.');
    }
    if (Number.parseFloat(input.actual_unit_price) <= 0) {
      throw new BadRequestException('Фактическая цена за единицу должна быть больше нуля.');
    }

    // Гард склада: выдать можно только то, что физически принято на склад КУ
    // по этому заказу и ещё не выдано. Без него акт подписывался на заказанное
    // количество при недопоставке (инцидент 2026-06-09: заказ 10, принято 5,
    // выдано «10»).
    const available = await this.loadAvailableOnWarehouse(order);
    this.assertWithinWarehouse(order, input.actual_quantity, available);

    // Заказ из остатка: цена публикации уже не выше цены прибытия (только
    // уценка) — повышение цены на выдаче открыло бы «наценку», под которую
    // нет доходной проводки (requirement 76, вопрос 4).
    if (
      this.isStockOrder(order) &&
      Number.parseFloat(input.actual_unit_price) > Number.parseFloat(order.price_per_unit) + 1e-9
    ) {
      throw new ConflictException(
        'По заказу со склада кооператива цену при выдаче можно только снизить.'
      );
    }

    this.verifyDocumentSignature(input.signed_document);

    // Факт (кол-во + цена) фиксируется оператором при открытии выдачи и
    // сохраняется на заказе; финальная подпись заказчика берёт его из снапшота,
    // а не редактирует.
    const factSnapshot = this.buildIssuanceFactSnapshot(
      order,
      input.actual_quantity,
      input.actual_unit_price
    );

    const act = new SignedDigitalDocumentInputDTO(input.signed_document).toDocument() as MarketContract.Actions.SignIss1.ISignIss1['act'];

    let tx;
    try {
      tx = await this.chainPort.signIss1({
        coopname: order.coopname,
        signer: input.chairman_account,
        order_hash: order.order_hash,
        act,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Открытие выдачи order ${order.id}: on-chain signiss1 упал (${message}); статус не меняется, повторите подпись.`
      );
      throw new ConflictException(
        `Открытие выдачи на цепи не выполнено: ${message}. Повторите подписание.`
      );
    }

    const txHash = this.extractTxHash(tx);
    if (!txHash) {
      // Если on-chain ответ не содержит хэша, мы не сможем восстановить
      // tx по запросу аудитора; синтетический hash 'signiss1-<uuid>' попадёт
      // в audit-trail как несуществующий — лучше отдать ошибку и повторить.
      throw new ConflictException(
        `Не получен tx_hash от блокчейна для open issuance order ${order.id}. Повторите подписание.`
      );
    }
    const updated = await this.orderRepo.applyIssuanceOpened(order.id, {
      chairman_account: input.chairman_account,
      signiss1_tx_hash: txHash,
      current_warehouse_braname: order.delivery_braname,
      // факт зафиксирован оператором при открытии — сохраняем снапшот, чтобы
      // финальная подпись заказчика взяла actual_quantity отсюда.
      issuance_fact: factSnapshot,
      // канон 2-подписи: сохраняем подписанный председателем документ, чтобы
      // заказчик получил его как DocumentAggregate и наложил вторую подпись.
      issue_act_signiss1_document:
        input.signed_document as unknown as ISignedDocumentDomainInterface,
    });

    this.logger.log(
      `Выдача order ${order.id} открыта председателем ${input.chairman_account} (tx=${txHash}); статус READY_TO_RECEIVE.`
    );

    // Story 6.1 / FR22: push заказчику — заказ готов на ПВЗ.
    const event: MarketplaceOrderReadyToReceiveEvent = {
      coopname: updated.coopname,
      order_id: updated.id,
      order_hash: updated.order_hash,
      orderer_account: updated.orderer_account,
      braname: updated.delivery_braname,
    };
    this.eventBus.emit(MARKETPLACE_ORDER_READY_TO_RECEIVE_EVENT, event);

    return { order: updated, tx_hash: txHash };
  }

  async finalizeIssuance(
    input: MarketplaceFinalizeIssuanceInput
  ): Promise<MarketplaceIssuanceResult> {
    const order = await this.loadOrder(input.coopname, input.order_id);
    // Канон выдачи: финальную подпись заказчик ставит сам в своём кабинете на
    // своём устройстве своим ключом. Авторизуем по самой подписи, а не по JWT
    // submitter'а: закрывающую подпись акта обязан нести ключ заказчика-владельца
    // заказа. Криптовалидность всех подписей проверяется ниже в
    // verifyDocumentSignature; submitter уже ограничен RoleGuard'ом
    // 'Issuance','sign:final'.
    const ordererSigned = (input.signed_document.signatures ?? []).some(
      (sig) => sig.signer === order.orderer_account
    );
    if (!ordererSigned) {
      throw new ForbiddenException(
        'Финальная подпись акта выдачи должна быть выполнена ключом заказчика-владельца заказа.'
      );
    }
    if (order.status !== 'READY_TO_RECEIVE') {
      throw new ConflictException(
        `Заказ в статусе «${order.status}», финальная подпись выдачи недопустима.`
      );
    }
    if (order.orderer_signed_at !== null) {
      throw new ConflictException(
        'Финальная подпись выдачи уже зафиксирована для этого заказа.'
      );
    }
    // Факт зафиксирован оператором при открытии выдачи (issuance_fact); сторона
    // кооператива — председатель, открывший выдачу (chairman_account). Заказчик
    // ничего из этого не передаёт и не редактирует.
    const actual_quantity = order.issuance_fact?.actual_quantity;
    if (!actual_quantity || actual_quantity <= 0) {
      throw new ConflictException(
        `Заказ ${order.id}: фактическое количество не зафиксировано при открытии выдачи — финализация недоступна.`
      );
    }
    const delivery_signer = order.chairman_account;
    if (!delivery_signer) {
      throw new ConflictException(
        `Заказ ${order.id}: не найден председатель, открывший выдачу — финализация недоступна.`
      );
    }
    // Цена за единицу тоже зафиксирована при открытии (оператор мог изменить её).
    const fact_unit_price = order.issuance_fact?.fact_unit_price ?? order.price_per_unit;

    this.verifyDocumentSignature(input.signed_document);

    const act = new SignedDigitalDocumentInputDTO(input.signed_document).toDocument() as MarketContract.Actions.SignIss2.ISignIss2['act'];

    let tx;
    try {
      tx = await this.chainPort.signIss2({
        coopname: order.coopname,
        orderer: order.orderer_account,
        order_hash: order.order_hash,
        actual_quantity: toQuantityAsset(actual_quantity, order.unit_of_measure),
        actual_unit_price: this.formatAsset(fact_unit_price),
        delivery_signer,
        act,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Финальная подпись выдачи order ${order.id}: on-chain signiss2 упал (${message}); статус не меняется, повторите подпись.`
      );
      throw new ConflictException(
        `Финальная подпись выдачи на цепи не выполнена: ${message}. Повторите подписание.`
      );
    }

    const txHash = this.extractTxHash(tx);
    if (!txHash) {
      throw new ConflictException(
        `Не получен tx_hash от блокчейна для finalize issuance order ${order.id}. Повторите подписание.`
      );
    }
    const factSnapshot =
      order.issuance_fact ?? this.buildIssuanceFactSnapshot(order, actual_quantity, fact_unit_price);
    const warrantyUntil =
      order.warranty_period_secs > 0
        ? new Date(Date.now() + order.warranty_period_secs * 1000)
        : null;

    const updated = await this.orderRepo.applyIssuanceFinalized(order.id, {
      delivery_signer_account: delivery_signer,
      signiss2_tx_hash: txHash,
      issuance_fact: factSnapshot,
      warranty_until: warrantyUntil,
    });

    // Выдача завершена — имущество ушло пайщику: выданное помечаем ISSUED,
    // а невостребованная дельта (выдано меньше принятого) переходит в
    // обезличенный остаток склада КУ (requirement 76) — собственность
    // кооператива, доступная к перепредложению пайщикам после публикации.
    // Best-effort: на сводный учёт это не должно ронять закрытие выдачи.
    try {
      if (this.isStockOrder(order)) {
        // Заказ из остатка: выданное — ISSUED, невыданный резерв возвращается
        // в свободный опубликованный остаток.
        const { released, issued_arrival_cost } = await this.inventoryRepo.finalizeReservedIssue(
          order.coopname,
          order.id,
          actual_quantity,
          order.price_per_unit
        );
        this.logger.log(
          `Выдача stock-order ${order.id}: выдано ${actual_quantity}, возвращено в остаток ${released} ед.`
        );
        // requirement 76 (вопрос 4): уценка — разница между стоимостью прибытия
        // выданного и фактической суммой — выбывает со счёта 10 в прочие
        // расходы (o.mkt.loss, Дт 91 / Кт 10). Вместе с o.mkt.consum даёт
        // выбытие по полной стоимости прибытия: на складе ничего не зависает.
        // Погашение накопленного на 91 (Дт 86 / Кт 91) — отдельный будущий
        // процесс по образцу списания скоропорта.
        await this.submitMarkdownLoss(order, issued_arrival_cost, factSnapshot.fact_cost);
      } else {
        // Цена прибытия = цена заказа (закупочная при приёмке); если приёмка
        // прошла по скорректированной цене, оператор уточнит цену публикации.
        const detached = await this.inventoryRepo.detachRemainderToStock(
          order.coopname,
          order.id,
          actual_quantity,
          order.price_per_unit
        );
        this.logger.log(
          `Выдача order ${order.id}: выдано ${actual_quantity}, в обезличенный остаток КУ ушло ${detached} ед.`
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Выдача order ${order.id}: не удалось закрыть складские позиции (${message}); склад покажет их как остаток до ручной сверки.`
      );
    }

    this.logger.log(
      `Выдача order ${order.id} завершена: actual_quantity=${actual_quantity}, diff=${factSnapshot.diff_state}, fact_cost=${factSnapshot.fact_cost} (tx=${txHash}).`
    );

    return { order: updated, tx_hash: txHash };
  }

  // ── private ──

  /**
   * Заказ из остатка кооператива (requirement 76): продавец — сам кооператив.
   * Такой заказ не имеет приёмки — выдача идёт из зарезервированных позиций
   * обезличенного остатка.
   */
  private isStockOrder(order: MarketplaceOrderDomainEntity): boolean {
    return order.supplier_account === order.coopname;
  }

  /**
   * Списание уценки по заказу из остатка (chain `markdown`, o.mkt.loss).
   * Best-effort: сбой не роняет закрытие выдачи — расход дослать можно
   * повторным вызовом (на цепи guard идемпотентности по заказу).
   */
  private async submitMarkdownLoss(
    order: MarketplaceOrderDomainEntity,
    issued_arrival_cost: string,
    fact_cost: string
  ): Promise<void> {
    const delta = Number.parseFloat(issued_arrival_cost) - Number.parseFloat(fact_cost);
    const minStep = 10 ** -this.assetConfig.decimals;
    if (!Number.isFinite(delta) || delta < minStep) return;
    try {
      await this.chainPort.markdown({
        coopname: order.coopname,
        order_hash: order.order_hash,
        amount: this.formatAsset(delta.toFixed(this.assetConfig.decimals)),
      });
      this.logger.log(
        `Stock-order ${order.id}: уценка ${delta.toFixed(this.assetConfig.decimals)} списана в прочие расходы (o.mkt.loss, Дт 91 / Кт 10).`
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Stock-order ${order.id}: списание уценки не прошло (${message}); на счёте 10 осталась разница ${delta.toFixed(this.assetConfig.decimals)} — дослать вручную повторным markdown.`
      );
    }
  }

  /** Принято на склад КУ по заказу и ещё не выдано (Σ RECEIVED/LABELED). */
  private async loadAvailableOnWarehouse(
    order: MarketplaceOrderDomainEntity
  ): Promise<number> {
    const sums = this.isStockOrder(order)
      ? await this.inventoryRepo.sumReservedByOrders(order.coopname, [order.id])
      : await this.inventoryRepo.sumOnWarehouseByOrders(order.coopname, [order.id]);
    return sums.get(order.id) ?? 0;
  }

  /**
   * Инвариант выдачи: со склада нельзя выдать больше, чем физически принято
   * по заказу. Применяется и к превью акта (его нельзя сформировать на
   * большее), и к самой мутации открытия выдачи.
   */
  private assertWithinWarehouse(
    order: MarketplaceOrderDomainEntity,
    requested_quantity: number | null,
    available: number
  ): void {
    if (available <= 0) {
      throw new ConflictException(
        `По заказу ${order.id} нет принятого на склад имущества — выдача недоступна до приёмки поставки.`
      );
    }
    if (requested_quantity !== null && requested_quantity > available) {
      throw new ConflictException(
        `Нельзя выдать больше, чем принято на склад: доступно ${available}, запрошено ${requested_quantity}.`
      );
    }
  }

  private async loadOrder(
    coopname: string,
    order_id: string
  ): Promise<MarketplaceOrderDomainEntity> {
    const order = await this.orderRepo.findById(order_id);
    if (!order || order.coopname !== coopname) {
      throw new NotFoundException(`Заказ ${order_id} не найден.`);
    }
    return order;
  }

  private async generateIssueActDocument(input: {
    order: MarketplaceOrderDomainEntity;
    transmitter: string;
    actual_quantity: number;
    actual_unit_price?: string;
  }): Promise<DocumentDomainEntity> {
    const unit_price = input.actual_unit_price ?? input.order.price_per_unit;
    // Артикул/наименование/единица — из оферты заказа: акт выдачи несёт ИМЕННО
    // заказ заказчика (его СКУ, кол-во и стоимость), а не заглушку фабрики.
    const offer = await this.offerRepo.findById(input.order.offer_id);
    return this.buildIssueActDocument({
      coopname: input.order.coopname,
      orderer_account: input.order.orderer_account,
      order_id: input.order.id,
      order_hash: input.order.order_hash,
      delivery_braname: input.order.delivery_braname,
      supplier_account: input.order.supplier_account,
      offer_id: input.order.offer_id,
      product_title: offer?.product_name ?? 'Товар по предложению',
      unit_of_measurement: offer
        ? marketplaceOrderUnitLabel(offer.unit_of_measure)
        : '',
      transmitter: input.transmitter,
      actual_quantity: input.actual_quantity,
      unit_price,
    });
  }

  /**
   * АПП-выдачи (registry 1105) для строки докладки со склада — заказа ещё нет,
   * поэтому поля берутся из оффера остатка и детерминированного order_hash.
   * Оператор КУ подписывает этот документ первой подписью (signiss1) при
   * формировании бандла; пайщик контрподписывает его (signiss2) одной кнопкой.
   * supplier_account = coopname (продавец — кооператив, маркер stock-заказа).
   */
  async generateStockIssueActDocument(input: {
    coopname: string;
    orderer_account: string;
    order_hash: string;
    braname: string;
    transmitter: string;
    offer_id: string;
    product_title: string;
    /** Готовый ярлык единицы заказа (фасовки) — строит вызывающая сторона из оферты. */
    unit_of_measurement: string;
    quantity: number;
    unit_price: string;
  }): Promise<DocumentDomainEntity> {
    return this.buildIssueActDocument({
      coopname: input.coopname,
      orderer_account: input.orderer_account,
      // Заказа ещё нет — человеко-номер акта берём из order_hash; на цепи
      // документ привязывается к заказу по order_hash (package=order_hash).
      order_id: computeActNumber(input.order_hash),
      order_hash: input.order_hash,
      delivery_braname: input.braname,
      supplier_account: input.coopname,
      offer_id: input.offer_id,
      product_title: input.product_title,
      unit_of_measurement: input.unit_of_measurement,
      transmitter: input.transmitter,
      actual_quantity: input.quantity,
      unit_price: input.unit_price,
    });
  }

  private async buildIssueActDocument(p: {
    coopname: string;
    orderer_account: string;
    order_id: string;
    order_hash: string;
    delivery_braname: string;
    supplier_account: string;
    offer_id: string;
    product_title: string;
    /** Готовый ярлык единицы заказа (фасовки). */
    unit_of_measurement: string;
    transmitter: string;
    actual_quantity: number;
    unit_price: string;
  }): Promise<DocumentDomainEntity> {
    // Акт выдачи ведётся В ЕДИНИЦАХ ЗАКАЗА (фасовках), без пересчёта в базовые:
    // количество = число единиц заказа, цена — за единицу заказа.
    const total_amount = (p.actual_quantity * Number.parseFloat(p.unit_price)).toFixed(4);
    const action: Cooperative.Registry.MarketplaceAplIssuance.Action = {
      registry_id: Cooperative.Registry.MarketplaceAplIssuance.registry_id,
      coopname: p.coopname,
      username: p.orderer_account,
      order_id: p.order_id,
      order_hash: p.order_hash,
      reception_id: p.order_id,
      act_id: computeActNumber(p.order_hash),
      transmitter: p.transmitter,
      braname: p.delivery_braname,
      accept_braname: p.delivery_braname,
      fact_quantity: p.actual_quantity,
      total_amount,
      supplier_account: p.supplier_account,
      sku: p.offer_id,
      product_title: p.product_title,
      unit_of_measurement: p.unit_of_measurement,
      unit_cost: p.unit_price,
      currency: this.assetConfig.symbol,
      // false: тело акта выдачи сохраняется в стор документов, чтобы заказчик
      // мог получить исходник по doc_hash через buildDocumentAggregate и
      // наложить вторую подпись поверх подписи председателя (канон 2-подписи).
      skip_save: false,
    };
    return this.documentDomainService.generateDocument({ data: action });
  }

  private buildIssuanceFactSnapshot(
    order: MarketplaceOrderDomainEntity,
    actual_quantity: number,
    actual_unit_price: string
  ): MarketplaceOrderIssuanceFactSnapshot {
    const decimals = this.assetConfig.decimals;
    const unitPrice = Number.parseFloat(actual_unit_price);
    const fact_unit_price = unitPrice.toFixed(decimals);
    const factCostNum = actual_quantity * unitPrice;
    const fact_cost = factCostNum.toFixed(decimals);
    // diff_state по СТОИМОСТИ (цена могла измениться, не только количество):
    // именно стоимость определяет ветку возврата/доплаты в signiss2.
    const orderedCostNum = Number.parseFloat(order.total_cost);
    let diff_state: MarketplaceOrderIssuanceFactSnapshot['diff_state'];
    if (factCostNum === orderedCostNum) diff_state = 'equal';
    else if (factCostNum < orderedCostNum) diff_state = 'less';
    else diff_state = 'more';
    return { actual_quantity, fact_unit_price, fact_cost, diff_state };
  }

  private formatAsset(value: string): string {
    const amount = Number.parseFloat(value);
    return `${amount.toFixed(this.assetConfig.decimals)} ${this.assetConfig.symbol}`;
  }

  private verifyDocumentSignature(document: ISignedDocumentDomainInterface): void {
    if (!document.signatures || document.signatures.length === 0) {
      throw new HttpApiError(http.BAD_REQUEST, 'Документ не подписан: signatures пуст.');
    }
    for (const sig of document.signatures) {
      const publicKey = PublicKey.from(sig.public_key);
      const signature = Signature.from(sig.signature);
      const verified = signature.verifyDigest(sig.signed_hash, publicKey);
      if (!verified) {
        throw new HttpApiError(http.BAD_REQUEST, 'Недействительная подпись акта выдачи.');
      }
    }
  }

  private extractTxHash(tx: unknown): string {
    const candidate = tx as
      | {
          response?: { transaction_id?: string };
          resolved?: { transaction?: { id?: string } };
          transaction?: { id?: string };
        }
      | undefined;
    return (
      candidate?.response?.transaction_id ??
      candidate?.resolved?.transaction?.id ??
      candidate?.transaction?.id ??
      ''
    );
  }
}

export const MARKETPLACE_ISSUANCE_SERVICE = Symbol('MARKETPLACE_ISSUANCE_SERVICE');
