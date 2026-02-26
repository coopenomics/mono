import { Injectable, Inject, Logger } from '@nestjs/common';
import { PRODUCT_CARD_REPOSITORY, type ProductCardRepository } from '../repositories/product-card.repository';
import { type ProductCardEntity, ProductCardStatus, ProductCardType } from '../entities/product-card.entity';

@Injectable()
export class ProductCardService {
  private readonly logger = new Logger(ProductCardService.name);

  constructor(
    @Inject(PRODUCT_CARD_REPOSITORY) private readonly cardRepo: ProductCardRepository,
  ) {}

  async createCard(coopname: string, username: string, data: Partial<ProductCardEntity>): Promise<ProductCardEntity> {
    return this.cardRepo.create({
      ...data,
      coopname,
      username,
      status: ProductCardStatus.DRAFT,
      cycle_collected_units: 0,
      cycle_number: 1,
      cycle_active: true,
    });
  }

  async submitForModeration(id: string, username: string): Promise<ProductCardEntity> {
    const card = await this.cardRepo.findById(id);
    if (!card) throw new Error('Карточка не найдена');
    if (card.username !== username) throw new Error('Нет доступа');
    if (card.status !== ProductCardStatus.DRAFT) throw new Error('Только черновики можно отправить на модерацию');

    return this.cardRepo.update(id, { status: ProductCardStatus.MODERATION });
  }

  async approve(id: string): Promise<ProductCardEntity> {
    const card = await this.cardRepo.findById(id);
    if (!card) throw new Error('Карточка не найдена');
    if (card.status !== ProductCardStatus.MODERATION) throw new Error('Только карточки на модерации можно одобрить');

    return this.cardRepo.update(id, { status: ProductCardStatus.PUBLISHED });
  }

  async reject(id: string): Promise<ProductCardEntity> {
    const card = await this.cardRepo.findById(id);
    if (!card) throw new Error('Карточка не найдена');
    if (card.status !== ProductCardStatus.MODERATION) throw new Error('Только карточки на модерации можно отклонить');

    return this.cardRepo.update(id, { status: ProductCardStatus.DRAFT });
  }

  async archive(id: string, username: string): Promise<ProductCardEntity> {
    const card = await this.cardRepo.findById(id);
    if (!card) throw new Error('Карточка не найдена');
    if (card.username !== username) throw new Error('Нет доступа');

    return this.cardRepo.update(id, { status: ProductCardStatus.ARCHIVED });
  }

  /**
   * Добавить заказ к карточке (увеличить cycle_collected_units).
   * Возвращает true если цикл набрал min_units — можно запускать поставку.
   */
  async addOrderToCard(cardId: string, units: number): Promise<{ card: ProductCardEntity; cycleReady: boolean }> {
    const card = await this.cardRepo.findById(cardId);
    if (!card) throw new Error('Карточка не найдена');
    if (card.status !== ProductCardStatus.PUBLISHED) throw new Error('Карточка не опубликована');
    if (!card.cycle_active) throw new Error('Цикл не активен');

    const newCollected = card.cycle_collected_units + units;
    const updated = await this.cardRepo.update(cardId, { cycle_collected_units: newCollected });
    const cycleReady = card.min_units ? newCollected >= card.min_units : true;

    if (cycleReady) {
      this.logger.log(`Цикл #${card.cycle_number} карточки ${cardId} набрал ${newCollected}/${card.min_units} — готов к запуску поставки`);
    }

    return { card: updated, cycleReady };
  }

  /**
   * Проверить дедлайн цикла. Если истёк и min_units не набран — возврат средств и новый цикл.
   */
  async checkCycleDeadline(cardId: string): Promise<{ expired: boolean; card: ProductCardEntity }> {
    const card = await this.cardRepo.findById(cardId);
    if (!card) throw new Error('Карточка не найдена');

    if (!card.cycle_deadline || !card.cycle_active) {
      return { expired: false, card };
    }

    const now = new Date();
    if (now < card.cycle_deadline) {
      return { expired: false, card };
    }

    const minMet = card.min_units ? card.cycle_collected_units >= card.min_units : true;
    if (minMet) {
      return { expired: false, card };
    }

    this.logger.warn(`Цикл #${card.cycle_number} карточки ${cardId} истёк: ${card.cycle_collected_units}/${card.min_units}. Запуск нового цикла.`);

    const updated = await this.cardRepo.update(cardId, {
      cycle_collected_units: 0,
      cycle_number: card.cycle_number + 1,
      cycle_active: true,
    });

    return { expired: true, card: updated };
  }

  /**
   * Начать новый цикл с новым дедлайном.
   */
  async startNewCycle(cardId: string, deadline: Date): Promise<ProductCardEntity> {
    return this.cardRepo.update(cardId, {
      cycle_deadline: deadline,
      cycle_collected_units: 0,
      cycle_active: true,
    });
  }
}
