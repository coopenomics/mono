import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
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
    private readonly eventBus: EventEmitter2,
    private readonly logger: WinstonLoggerService
  ) {
    this.logger.setContext(MarketplaceStockProposalService.name);
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

  /** Пайщик принимает: по каждой строке — заказ из остатка (средства блокируются здесь). */
  async acceptProposal(
    coopname: string,
    proposal_id: string,
    member_account: string
  ): Promise<MarketplaceStockProposalAcceptResult> {
    const proposal = await this.loadProposal(coopname, proposal_id);
    if (proposal.member_account !== member_account) {
      throw new ForbiddenException('Принять предложение может только его адресат.');
    }
    this.assertProposed(proposal);

    // Построчно: успехи сохраняем, на первом фейле останавливаемся и
    // компенсируем уже созданные заказы (атомарность докладки — UX-инвариант:
    // пайщик принимает её целиком).
    const order_ids: string[] = [];
    try {
      for (const item of proposal.items) {
        const { order } = await this.stockService.createStockOrder({
          coopname,
          orderer_account: member_account,
          offer_id: item.offer_id,
          quantity: item.quantity,
          checkout_id: proposal.id,
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
