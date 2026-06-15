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
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import { DocumentDomainService } from '~/domain/document/services/document-domain.service';
import { SignedDigitalDocumentInputDTO } from '~/application/document/dto/signed-digital-document-input.dto';
import {
  USER_WALLET_REPOSITORY,
  type UserWalletRepository,
} from '~/domain/wallet/repositories/user-wallet.repository';
import type { DocumentDomainEntity } from '~/domain/document/entity/document-domain.entity';
import type { MarketplaceConvertStatementSignedInputDTO } from '~/application/document/documents-dto/marketplace-convert-statement-document.dto';
import { computeStockOrderHash, computeConvertAnchorHash } from '../shared/order-hash.util';
import {
  MARKETPLACE_ECONOMY_SERVICE,
  MarketplaceEconomyService,
} from './marketplace-economy.service';
import {
  MARKETPLACE_STOCK_PROPOSAL_REPOSITORY,
  type MarketplaceStockProposalDomainRepository,
} from '../../domain/repositories/marketplace-stock-proposal.repository';
import {
  MARKETPLACE_OFFER_REPOSITORY,
  type MarketplaceOfferDomainRepository,
} from '../../domain/repositories/marketplace-offer.repository';
import { MarketplaceStockService, MARKETPLACE_STOCK_SERVICE } from './marketplace-stock.service';
import { MarketplaceOfferStatuses } from '../../domain/entities/marketplace-offer.types';
import {
  MarketplaceStockProposalStatuses,
  type MarketplaceStockProposalItem,
  type MarketplaceStockProposalStatus,
} from '../../domain/entities/marketplace-stock-proposal.types';
import type { MarketplaceStockProposalDomainEntity } from '../../domain/entities/marketplace-stock-proposal.entity';
import {
  MARKETPLACE_STOCK_PROPOSAL_CREATED_EVENT,
  MARKETPLACE_STOCK_PROPOSAL_RESOLVED_EVENT,
  type MarketplaceStockProposalCreatedEvent,
  type MarketplaceStockProposalResolvedEvent,
} from '../events/marketplace-notification.events';

export interface MarketplaceStockProposalCreateInput {
  coopname: string;
  operator_account: string;
  braname: string;
  member_account: string;
  items: Array<{ offer_id: string; quantity: number }>;
}

export interface MarketplaceStockProposalAcceptResult {
  proposal: MarketplaceStockProposalDomainEntity;
  order_ids: string[];
}

/** Строка-заказ к созданию при принятии: offer + предвычисленный order_hash. */
export interface MarketplaceStockAcceptOrderLine {
  offer_id: string;
  order_hash: string;
}

/**
 * Полезная нагрузка к подписи при принятии предложения/докладки. Заявление о
 * конвертации — ОДНО на весь дефицит (не по каждой строке): `convert` != null
 * только когда членских средств не хватает; при замене из высвобожденных средств
 * `convert` == null — пайщику подписывать нечего.
 */
export interface MarketplaceStockAcceptPayload {
  order_lines: MarketplaceStockAcceptOrderLine[];
  convert: {
    amount: string;
    convert_hash: string;
    document: DocumentDomainEntity;
  } | null;
}

/** Вход принятия: строки-заказы + единое подписанное Заявление (или его нет). */
export interface MarketplaceStockAcceptInput {
  order_lines: MarketplaceStockAcceptOrderLine[];
  signed_convert?: MarketplaceConvertStatementSignedInputDTO | null;
}

/**
 * requirement 76, решения 10–11: двухфазная докладка у стойки выдачи.
 *
 * Оператор после QR-резолва пайщика (заказ не обязателен — «просто зашёл»)
 * накидывает опубликованные позиции остатка своего КУ в предложение →
 * пайщику немедленно уходит websocket-сигнал → пайщик принимает → по каждой
 * строке создаётся заказ из остатка (stockorder: средства блокируются ИМЕННО
 * на акцепте; при нехватке паевых средств акцепт фейлится с человеческим
 * сообщением) → у стойки открывается выдача и акт уходит в гейт «подписи на
 * месте». До акцепта (и после акцепта — до своей подписи на акте, через
 * отмену заказов) оператор управляет судьбой докладки вручную: отозвать,
 * переформировать; автоаннулирования по таймауту нет.
 */
@Injectable()
export class MarketplaceStockProposalService {
  constructor(
    @Inject(MARKETPLACE_STOCK_PROPOSAL_REPOSITORY)
    private readonly proposalRepo: MarketplaceStockProposalDomainRepository,
    @Inject(MARKETPLACE_OFFER_REPOSITORY)
    private readonly offerRepo: MarketplaceOfferDomainRepository,
    @Inject(MARKETPLACE_STOCK_SERVICE)
    private readonly stockService: MarketplaceStockService,
    @Inject(MARKETPLACE_ECONOMY_SERVICE)
    private readonly economyService: MarketplaceEconomyService,
    @Inject(USER_WALLET_REPOSITORY)
    private readonly userWalletRepo: UserWalletRepository,
    private readonly documentDomainService: DocumentDomainService,
    private readonly eventBus: EventEmitter2,
    private readonly logger: WinstonLoggerService
  ) {
    this.logger.setContext(MarketplaceStockProposalService.name);
  }

  /**
   * Полезная нагрузка к подписи при принятии докладки. order_hash каждого
   * будущего stock-заказа рождается здесь и возвращается в order_lines (пайщик
   * вернёт их в acceptProposal). Заявление о конвертации — ОДНО на весь дефицит
   * сверх уже внесённых членских средств; если членских хватает (замена из
   * высвобожденных средств) — convert == null, подписывать нечего.
   */
  async getAcceptSignablePayloads(
    coopname: string,
    proposal_id: string,
    member_account: string
  ): Promise<MarketplaceStockAcceptPayload> {
    const proposal = await this.loadProposal(coopname, proposal_id);
    if (proposal.member_account !== member_account) {
      throw new ForbiddenException('Подписать заявления может только адресат предложения.');
    }
    this.assertProposed(proposal);

    const feePercent = await this.economyService.getMembershipFeeContractPercent(coopname);

    // order_hash на каждую строку + суммарная потребность в членских средствах.
    const order_lines: MarketplaceStockAcceptOrderLine[] = [];
    let neededUnits = 0n;
    for (const item of proposal.items) {
      order_lines.push({
        offer_id: item.offer_id,
        order_hash: computeStockOrderHash(coopname, member_account, item.offer_id),
      });
      neededUnits += this.economyService.lineUnits(item.unit_price, item.quantity, feePercent);
    }

    // Дефицит = потребность − уже внесённые членские средства. Конвертируем
    // только его, одним заявлением.
    const memberUnits = await this.readMemberUnits(coopname, member_account);
    const deficitUnits = neededUnits > memberUnits ? neededUnits - memberUnits : 0n;

    if (deficitUnits === 0n) {
      return { order_lines, convert: null };
    }

    const amount = this.economyService.unitsToAsset(deficitUnits);
    const convert_hash = computeConvertAnchorHash(coopname, member_account, proposal_id);
    const action: Cooperative.Registry.MarketplaceConvertStatement.Action = {
      registry_id: Cooperative.Registry.MarketplaceConvertStatement.registry_id,
      coopname,
      username: member_account,
      lang: 'ru',
      order_hash: convert_hash,
      amount,
      skip_save: false,
    };
    const document = await this.documentDomainService.generateDocument({ data: action });
    return { order_lines, convert: { amount, convert_hash, document } };
  }

  /** Баланс членского кошелька «Стола заказов» пайщика в минимальных единицах. */
  private async readMemberUnits(coopname: string, member_account: string): Promise<bigint> {
    const wallet = await this.userWalletRepo.findByWalletAndUsername(
      coopname,
      'w.mkt.member',
      member_account
    );
    return wallet?.available ? this.economyService.assetToUnits(wallet.available) : 0n;
  }

  async createProposal(
    input: MarketplaceStockProposalCreateInput
  ): Promise<MarketplaceStockProposalDomainEntity> {
    if (input.items.length === 0) {
      throw new BadRequestException('Предложение пустое — добавьте позиции из остатка.');
    }
    if (input.member_account === input.operator_account) {
      throw new BadRequestException('Нельзя отправить предложение самому себе.');
    }

    // Снапшоты строк: только активные офферы кооператива ИМЕННО этого КУ,
    // количество в пределах доступного остатка.
    const items: MarketplaceStockProposalItem[] = [];
    for (const line of input.items) {
      if (!Number.isInteger(line.quantity) || line.quantity <= 0) {
        throw new BadRequestException('Количество в строке должно быть целым числом больше нуля.');
      }
      const offer = await this.offerRepo.findById(line.offer_id);
      if (!offer || offer.coopname !== input.coopname) {
        throw new NotFoundException('Предложение остатка не найдено.');
      }
      if (offer.stock_braname !== input.braname) {
        throw new BadRequestException(
          `«${offer.product_name}» — остаток другого КУ, со стойки ${input.braname} не докладывается.`
        );
      }
      if (offer.status !== MarketplaceOfferStatuses.ACTIVE) {
        throw new BadRequestException(`«${offer.product_name}» снят с публикации.`);
      }
      if (offer.quantity_available < line.quantity) {
        throw new BadRequestException(
          `«${offer.product_name}»: на складе свободно ${offer.quantity_available} ед., нельзя предложить ${line.quantity}.`
        );
      }
      items.push({
        offer_id: offer.id,
        quantity: line.quantity,
        unit_price: offer.price_per_unit,
        product_name: offer.product_name,
      });
    }

    const proposal = await this.proposalRepo.create({
      coopname: input.coopname,
      braname: input.braname,
      member_account: input.member_account,
      operator_account: input.operator_account,
      items,
    });

    const event: MarketplaceStockProposalCreatedEvent = {
      coopname: proposal.coopname,
      proposal_id: proposal.id,
      member_account: proposal.member_account,
      braname: proposal.braname,
    };
    this.eventBus.emit(MARKETPLACE_STOCK_PROPOSAL_CREATED_EVENT, event);

    this.logger.log(
      `Докладка: предложение ${proposal.id} пайщику ${proposal.member_account} (${items.length} строк, КУ ${proposal.braname}, оператор ${input.operator_account}).`
    );
    return proposal;
  }

  /** Пайщик принимает: одна конвертация на дефицит + заказ из остатка по строкам. */
  async acceptProposal(
    coopname: string,
    proposal_id: string,
    member_account: string,
    input: MarketplaceStockAcceptInput
  ): Promise<MarketplaceStockProposalAcceptResult> {
    const proposal = await this.loadProposal(coopname, proposal_id);
    if (proposal.member_account !== member_account) {
      throw new ForbiddenException('Принять предложение может только его адресат.');
    }
    this.assertProposed(proposal);

    const feePercent = await this.economyService.getMembershipFeeContractPercent(coopname);

    // order_hash по строкам — из подписанной пайщиком нагрузки (привязка по offer_id).
    const orderHashByOffer = new Map(
      (input.order_lines ?? []).map((l) => [l.offer_id, l.order_hash])
    );

    // Потребность в членских средствах и дефицит сверх уже внесённых (как в
    // getAcceptSignablePayloads — суммы должны совпасть с подписанным заявлением).
    let neededUnits = 0n;
    for (const item of proposal.items) {
      neededUnits += this.economyService.lineUnits(item.unit_price, item.quantity, feePercent);
    }
    const memberUnits = await this.readMemberUnits(coopname, member_account);
    const deficitUnits = neededUnits > memberUnits ? neededUnits - memberUnits : 0n;

    // Дефицит покрываем ОДНОЙ конвертацией паевого на всю сумму; при замене из
    // высвобожденных средств дефицит 0 → конвертации и подписи нет.
    if (deficitUnits > 0n) {
      if (!input.signed_convert) {
        throw new BadRequestException(
          'Нет подписанного заявления о конвертации паевого взноса — обновите принятие предложения.'
        );
      }
      const meta = input.signed_convert.meta;
      const expectedAmount = this.economyService.unitsToAsset(deficitUnits);
      const expectedHash = computeConvertAnchorHash(coopname, member_account, proposal_id);
      if (
        meta.registry_id !== Cooperative.Registry.MarketplaceConvertStatement.registry_id ||
        meta.order_hash !== expectedHash ||
        meta.amount !== expectedAmount
      ) {
        throw new BadRequestException(
          'Заявление о конвертации не соответствует сумме доплаты — обновите принятие.'
        );
      }
      const convert_statement = new SignedDigitalDocumentInputDTO(
        input.signed_convert
      ).toDocument() as MarketContract.Actions.Convert.IConvert['convert_statement'];
      await this.stockService.convertToMember({
        coopname,
        orderer: member_account,
        amount: expectedAmount,
        convert_statement,
      });
    }

    // Построчно: успехи сохраняем, на первом фейле останавливаемся и
    // компенсируем уже созданные заказы (атомарность докладки — UX-инвариант:
    // пайщик принимает её целиком). Все средства уже в членском → заказ из
    // остатка фондируется из них, Заявление на строку не нужно.
    const order_ids: string[] = [];
    try {
      for (const item of proposal.items) {
        const order_hash = orderHashByOffer.get(item.offer_id);
        if (!order_hash) {
          throw new BadRequestException(
            'Состав принятия не совпадает с предложением — обновите принятие предложения.'
          );
        }
        const { order } = await this.stockService.createStockOrder({
          coopname,
          orderer_account: member_account,
          offer_id: item.offer_id,
          quantity: item.quantity,
          checkout_id: proposal.id,
          order_hash,
        });
        order_ids.push(order.id);
      }
    } catch (error) {
      for (const orderId of order_ids) {
        try {
          await this.stockService.cancelStockOrder(
            coopname,
            orderId,
            member_account,
            'Акцепт докладки не завершился — строка отменена'
          );
        } catch (compErr: any) {
          this.logger.error(
            `acceptProposal: компенсирующая отмена stock-order ${orderId} упала: ${compErr.message}. РУЧНАЯ СВЕРКА!`
          );
        }
      }
      throw error;
    }

    const resolved = await this.proposalRepo.applyResolution(
      proposal.id,
      MarketplaceStockProposalStatuses.PROPOSED,
      MarketplaceStockProposalStatuses.ACCEPTED,
      order_ids
    );
    if (!resolved) {
      // Гонка: оператор отозвал предложение, пока создавались заказы.
      for (const orderId of order_ids) {
        try {
          await this.stockService.cancelStockOrder(
            coopname,
            orderId,
            member_account,
            'Предложение было отозвано оператором'
          );
        } catch (compErr: any) {
          this.logger.error(
            `acceptProposal: отмена после гонки cancel/accept упала (order=${orderId}): ${compErr.message}`
          );
        }
      }
      throw new ConflictException('Предложение уже отозвано оператором.');
    }

    this.emitResolved(resolved);
    this.logger.log(
      `Докладка ${proposal.id} принята пайщиком ${member_account}: создано заказов из остатка — ${order_ids.length}.`
    );
    return { proposal: resolved, order_ids };
  }

  /** Пайщик отказывается от предложения. */
  async declineProposal(
    coopname: string,
    proposal_id: string,
    member_account: string
  ): Promise<MarketplaceStockProposalDomainEntity> {
    const proposal = await this.loadProposal(coopname, proposal_id);
    if (proposal.member_account !== member_account) {
      throw new ForbiddenException('Отказаться от предложения может только его адресат.');
    }
    this.assertProposed(proposal);
    const resolved = await this.proposalRepo.applyResolution(
      proposal.id,
      MarketplaceStockProposalStatuses.PROPOSED,
      MarketplaceStockProposalStatuses.DECLINED
    );
    if (!resolved) throw new ConflictException('Предложение уже разрешено.');
    this.emitResolved(resolved);
    return resolved;
  }

  /** Оператор отзывает предложение (переформирование «а ещё сметаны положите»). */
  async cancelProposal(
    coopname: string,
    proposal_id: string,
    operator_account: string
  ): Promise<MarketplaceStockProposalDomainEntity> {
    const proposal = await this.loadProposal(coopname, proposal_id);
    this.assertProposed(proposal);
    const resolved = await this.proposalRepo.applyResolution(
      proposal.id,
      MarketplaceStockProposalStatuses.PROPOSED,
      MarketplaceStockProposalStatuses.CANCELLED
    );
    if (!resolved) throw new ConflictException('Предложение уже разрешено.');
    this.emitResolved(resolved);
    this.logger.log(`Докладка ${proposal.id} отозвана оператором ${operator_account}.`);
    return resolved;
  }

  async listProposals(filter: {
    coopname: string;
    member_account?: string;
    braname?: string | string[];
    status?: MarketplaceStockProposalStatus[];
  }): Promise<MarketplaceStockProposalDomainEntity[]> {
    return this.proposalRepo.list(filter);
  }

  // ── private ──────────────────────────────────────────────────────────

  private async loadProposal(
    coopname: string,
    proposal_id: string
  ): Promise<MarketplaceStockProposalDomainEntity> {
    const proposal = await this.proposalRepo.findById(proposal_id);
    if (!proposal || proposal.coopname !== coopname) {
      throw new NotFoundException('Предложение докладки не найдено.');
    }
    return proposal;
  }

  private assertProposed(proposal: MarketplaceStockProposalDomainEntity): void {
    if (proposal.status !== MarketplaceStockProposalStatuses.PROPOSED) {
      throw new ConflictException(
        `Предложение уже разрешено (статус «${proposal.status}»).`
      );
    }
  }

  private emitResolved(proposal: MarketplaceStockProposalDomainEntity): void {
    const event: MarketplaceStockProposalResolvedEvent = {
      coopname: proposal.coopname,
      proposal_id: proposal.id,
      member_account: proposal.member_account,
      braname: proposal.braname,
      resolution: proposal.status,
    };
    this.eventBus.emit(MARKETPLACE_STOCK_PROPOSAL_RESOLVED_EVENT, event);
  }
}

export const MARKETPLACE_STOCK_PROPOSAL_SERVICE = Symbol('MARKETPLACE_STOCK_PROPOSAL_SERVICE');
