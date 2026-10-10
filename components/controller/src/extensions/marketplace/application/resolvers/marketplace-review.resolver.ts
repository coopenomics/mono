import { Inject, Injectable, UseGuards } from '@nestjs/common';
import { Args, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import {
  DomainError,
  GqlJwtAuthGuard,
  PaginationInputDTO,
  platformSettings,
  RequireRight,
  RightsGuard,
} from '@coopenomics/extension-kit';
import { canAccess } from '../access/marketplace-access-matrix';
import { CurrentMarketplaceMember } from '../decorators/current-marketplace-member.decorator';
import type { IMarketplaceCurrentMember } from '../dto/marketplace-current-member.dto';
import {
  MarketplaceCreateReviewInputDTO,
  MarketplaceListReviewsFilterInputDTO,
  MarketplaceReviewDTO,
  MarketplaceReviewPaginationResultDTO,
  MarketplaceReviewSummaryDTO,
  MarketplaceReviewSummaryInputDTO,
  MarketplaceSetReviewStatusInputDTO,
  MarketplaceUpdateMyReviewInputDTO,
} from '../dto/marketplace-review.dto';
import { MarketplaceMembershipGuard } from '../guards/marketplace-membership.guard';
import type { MarketplaceRole } from '../membership/marketplace-roles.mapper';
import type { MarketplaceReviewDomainEntity } from '../../domain/entities/marketplace-review.entity';
import {
  MARKETPLACE_OFFER_REPOSITORY,
  type MarketplaceOfferDomainRepository,
} from '../../domain/repositories/marketplace-offer.repository';
import { MarketplaceOrderDisplayService } from '../services/marketplace-order-display.service';
import { MarketplaceReviewService } from '../services/marketplace-review.service';

/** Вправе ли пайщик скрывать отзывы — он же видит скрытые и причину скрытия. */
function canModerate(member: IMarketplaceCurrentMember): boolean {
  return canAccess(member.marketplace_roles as MarketplaceRole[], 'Review', 'moderate');
}

/**
 * Отзывы заказчиков о полученном имуществе. Отзыв пишет заказчик по своему
 * полученному заказу; читают все пайщики Стола заказов — на карточке
 * предложения и в профиле поставщика; администратор скрывает отзыв с причиной.
 */
@Resolver()
@Injectable()
export class MarketplaceReviewResolver {
  constructor(private readonly reviews: MarketplaceReviewService) {}

  @Mutation(() => MarketplaceReviewDTO, {
    name: 'marketplaceCreateReview',
    description: 'Заказчик оставляет отзыв по полученному заказу: оценка от 1 до 5 и текст.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, RightsGuard)
  @RequireRight('Review', 'create:own', { of: 'Order', id: 'data.order_id' })
  async marketplaceCreateReview(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('data') data: MarketplaceCreateReviewInputDTO
  ): Promise<MarketplaceReviewDTO> {
    const review = await this.reviews.create({
      coopname: platformSettings().coopname,
      author_account: member.username,
      order_id: data.order_id,
      stars: data.stars,
      text: data.text,
    });
    return new MarketplaceReviewDTO(review, { reveal_hidden_reason: true });
  }

  @Mutation(() => MarketplaceReviewDTO, {
    name: 'marketplaceUpdateMyReview',
    description: 'Автор правит свой отзыв: оценку и текст.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, RightsGuard)
  @RequireRight('Review', 'update:own', { of: 'Review', id: 'data.id' })
  async marketplaceUpdateMyReview(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('data') data: MarketplaceUpdateMyReviewInputDTO
  ): Promise<MarketplaceReviewDTO> {
    const review = await this.reviews.updateMine({
      coopname: platformSettings().coopname,
      author_account: member.username,
      id: data.id,
      stars: data.stars,
      text: data.text,
    });
    return new MarketplaceReviewDTO(review, { reveal_hidden_reason: true });
  }

  @Mutation(() => MarketplaceReviewDTO, {
    name: 'marketplaceSetReviewStatus',
    description: 'Администратор скрывает отзыв с причиной либо возвращает его в публикацию.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, RightsGuard)
  @RequireRight('Review', 'moderate')
  async marketplaceSetReviewStatus(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('data') data: MarketplaceSetReviewStatusInputDTO
  ): Promise<MarketplaceReviewDTO> {
    const review = await this.reviews.setStatus({
      coopname: platformSettings().coopname,
      actor_account: member.username,
      id: data.id,
      status: data.status,
      reason: data.reason,
    });
    return new MarketplaceReviewDTO(review, { reveal_hidden_reason: true });
  }

  @Query(() => MarketplaceReviewPaginationResultDTO, {
    name: 'marketplaceListReviews',
    description:
      'Отзывы о предложении, обо всех предложениях поставщика либо одного автора. Скрытые отзывы видит только администратор.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, RightsGuard)
  @RequireRight('Review', 'read')
  async marketplaceListReviews(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('filter', { nullable: true }) filter?: MarketplaceListReviewsFilterInputDTO,
    @Args('options', { nullable: true }) options?: PaginationInputDTO
  ): Promise<MarketplaceReviewPaginationResultDTO> {
    const can_moderate = canModerate(member);
    const page = await this.reviews.list(
      { coopname: platformSettings().coopname, ...(filter ?? {}) },
      {
        page: options?.page ?? 1,
        limit: options?.limit ?? 10,
        sortBy: options?.sortBy ?? 'created_at',
        sortOrder: options?.sortOrder ?? 'DESC',
      },
      { can_moderate }
    );
    return {
      items: page.items.map((review) => this.toDTO(review, member, can_moderate)),
      totalCount: page.totalCount,
      totalPages: page.totalPages,
      currentPage: page.currentPage,
    };
  }

  @Query(() => MarketplaceReviewSummaryDTO, {
    name: 'marketplaceReviewSummary',
    description:
      'Сводная оценка по опубликованным отзывам о предложении либо обо всех предложениях поставщика: средняя, число отзывов и распределение по оценкам.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, RightsGuard)
  @RequireRight('Review', 'read')
  async marketplaceReviewSummary(
    @Args('filter') filter: MarketplaceReviewSummaryInputDTO
  ): Promise<MarketplaceReviewSummaryDTO> {
    // Сводка считается по одному объекту: предложению либо поставщику.
    if (Boolean(filter.offer_id) === Boolean(filter.supplier_account)) {
      throw DomainError.badRequest('MARKETPLACE_REVIEW_SUMMARY_TARGET_REQUIRED');
    }
    const target = filter.offer_id
      ? { offer_id: filter.offer_id }
      : { supplier_account: filter.supplier_account as string };
    return new MarketplaceReviewSummaryDTO(await this.reviews.summary(platformSettings().coopname, target));
  }

  @Query(() => MarketplaceReviewDTO, {
    name: 'marketplaceMyReviewByOrder',
    nullable: true,
    description: 'Отзыв заказчика по его заказу. Пусто — отзыв ещё не оставлен.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, RightsGuard)
  @RequireRight('Review', 'read')
  async marketplaceMyReviewByOrder(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('order_id', { type: () => String, description: 'Идентификатор заказа.' }) order_id: string
  ): Promise<MarketplaceReviewDTO | null> {
    const review = await this.reviews.findMineByOrder(platformSettings().coopname, member.username, order_id);
    return review ? new MarketplaceReviewDTO(review, { reveal_hidden_reason: true }) : null;
  }

  private toDTO(
    review: MarketplaceReviewDomainEntity,
    member: IMarketplaceCurrentMember,
    can_moderate: boolean
  ): MarketplaceReviewDTO {
    return new MarketplaceReviewDTO(review, {
      reveal_hidden_reason: can_moderate || review.author_account === member.username,
    });
  }
}

/**
 * Отображаемые поля отзыва: название предложения и имя автора берутся на
 * сервере, стол их отдельно не дозапрашивает.
 */
@Resolver(() => MarketplaceReviewDTO)
@Injectable()
export class MarketplaceReviewFieldsResolver {
  constructor(
    @Inject(MARKETPLACE_OFFER_REPOSITORY)
    private readonly offers: MarketplaceOfferDomainRepository,
    private readonly display: MarketplaceOrderDisplayService
  ) {}

  @ResolveField('offer_name', () => String, {
    nullable: true,
    description: 'Название предложения, о котором отзыв.',
  })
  async offerName(@Parent() review: MarketplaceReviewDTO): Promise<string | null> {
    const offer = await this.offers.findById(review.offer_id);
    return offer?.product_name ?? null;
  }

  @ResolveField('author_name', () => String, {
    nullable: true,
    description: 'Имя автора отзыва (ФИО физлица либо наименование организации).',
  })
  async authorName(@Parent() review: MarketplaceReviewDTO): Promise<string | null> {
    return this.display.resolveAccountName(review.author_account);
  }
}
