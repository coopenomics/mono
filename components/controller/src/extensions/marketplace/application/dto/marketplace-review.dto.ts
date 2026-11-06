import { Field, Float, InputType, Int, ObjectType, registerEnumType } from '@nestjs/graphql';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { createPaginationResult } from '@coopenomics/extension-kit';
import type { MarketplaceReviewDomainEntity } from '../../domain/entities/marketplace-review.entity';
import {
  MARKETPLACE_REVIEW_HIDDEN_REASON_MAX,
  MARKETPLACE_REVIEW_STARS_MAX,
  MARKETPLACE_REVIEW_STARS_MIN,
  MARKETPLACE_REVIEW_TEXT_MAX,
  MarketplaceReviewStatuses,
  type MarketplaceReviewSummary,
} from '../../domain/entities/marketplace-review.types';

export const MarketplaceReviewStatusEnum = MarketplaceReviewStatuses;
export type MarketplaceReviewStatusEnum =
  (typeof MarketplaceReviewStatusEnum)[keyof typeof MarketplaceReviewStatusEnum];
registerEnumType(MarketplaceReviewStatusEnum, {
  name: 'MarketplaceReviewStatus',
  description:
    'Состояние отзыва: PUBLISHED — опубликован и виден пайщикам, HIDDEN — скрыт администратором.',
});

@ObjectType('MarketplaceReview')
export class MarketplaceReviewDTO {
  @Field(() => String, { description: 'Идентификатор отзыва.' })
  public readonly id!: string;

  @Field(() => String, { description: 'Заказ, по которому оставлен отзыв.' })
  public readonly order_id!: string;

  @Field(() => String, { description: 'Предложение, о котором отзыв.' })
  public readonly offer_id!: string;

  @Field(() => String, { description: 'Учётная запись поставщика этого предложения.' })
  public readonly supplier_account!: string;

  @Field(() => String, { description: 'Учётная запись автора отзыва.' })
  public readonly author_account!: string;

  @Field(() => Int, { description: 'Оценка от 1 до 5.' })
  public readonly stars!: number;

  @Field(() => String, { description: 'Текст отзыва; может быть пустым, если автор поставил только оценку.' })
  public readonly text!: string;

  @Field(() => MarketplaceReviewStatusEnum, { description: 'Состояние отзыва.' })
  public readonly status!: MarketplaceReviewStatusEnum;

  @Field(() => String, {
    nullable: true,
    description: 'Причина, по которой администратор скрыл отзыв. Видна автору и администратору.',
  })
  public readonly hidden_reason!: string | null;

  @Field(() => Date, { description: 'Когда отзыв оставлен.' })
  public readonly created_at!: Date;

  @Field(() => Date, { description: 'Когда отзыв последний раз менялся.' })
  public readonly updated_at!: Date;

  constructor(review: MarketplaceReviewDomainEntity, options: { reveal_hidden_reason: boolean }) {
    this.id = review.id;
    this.order_id = review.order_id;
    this.offer_id = review.offer_id;
    this.supplier_account = review.supplier_account;
    this.author_account = review.author_account;
    this.stars = review.stars;
    this.text = review.text;
    this.status = review.status;
    this.hidden_reason = options.reveal_hidden_reason ? review.hidden_reason : null;
    this.created_at = review.created_at;
    this.updated_at = review.updated_at;
  }
}

@ObjectType('MarketplaceReviewPaginationResult')
export class MarketplaceReviewPaginationResultDTO extends createPaginationResult(
  MarketplaceReviewDTO,
  'MarketplaceReview'
) {}

@ObjectType('MarketplaceReviewStarsCount')
export class MarketplaceReviewStarsCountDTO {
  @Field(() => Int, { description: 'Оценка от 1 до 5.' })
  public readonly stars!: number;

  @Field(() => Int, { description: 'Число отзывов с такой оценкой.' })
  public readonly count!: number;

  constructor(init: { stars: number; count: number }) {
    this.stars = init.stars;
    this.count = init.count;
  }
}

@ObjectType('MarketplaceReviewSummary')
export class MarketplaceReviewSummaryDTO {
  @Field(() => Float, { nullable: true, description: 'Средняя оценка. Пусто — отзывов нет.' })
  public readonly rating_avg!: number | null;

  @Field(() => Int, { description: 'Число опубликованных отзывов.' })
  public readonly reviews_count!: number;

  @Field(() => [MarketplaceReviewStarsCountDTO], {
    description: 'Распределение отзывов по оценкам, от пяти звёзд к одной.',
  })
  public readonly stars_breakdown!: MarketplaceReviewStarsCountDTO[];

  constructor(summary: MarketplaceReviewSummary) {
    this.rating_avg = summary.rating_avg;
    this.reviews_count = summary.reviews_count;
    this.stars_breakdown = summary.stars_breakdown.map((row) => new MarketplaceReviewStarsCountDTO(row));
  }
}

@InputType('MarketplaceCreateReviewInput')
export class MarketplaceCreateReviewInputDTO {
  @Field(() => String, { description: 'Полученный заказ, о котором отзыв.' })
  @IsUUID()
  public readonly order_id!: string;

  @Field(() => Int, { description: 'Оценка от 1 до 5.' })
  @IsInt()
  @Min(MARKETPLACE_REVIEW_STARS_MIN)
  @Max(MARKETPLACE_REVIEW_STARS_MAX)
  public readonly stars!: number;

  @Field(() => String, { nullable: true, description: 'Текст отзыва.' })
  @IsOptional()
  @IsString()
  @MaxLength(MARKETPLACE_REVIEW_TEXT_MAX)
  public readonly text?: string | null;
}

@InputType('MarketplaceUpdateMyReviewInput')
export class MarketplaceUpdateMyReviewInputDTO {
  @Field(() => String, { description: 'Идентификатор отзыва.' })
  @IsUUID()
  public readonly id!: string;

  @Field(() => Int, { description: 'Оценка от 1 до 5.' })
  @IsInt()
  @Min(MARKETPLACE_REVIEW_STARS_MIN)
  @Max(MARKETPLACE_REVIEW_STARS_MAX)
  public readonly stars!: number;

  @Field(() => String, { nullable: true, description: 'Текст отзыва.' })
  @IsOptional()
  @IsString()
  @MaxLength(MARKETPLACE_REVIEW_TEXT_MAX)
  public readonly text?: string | null;
}

@InputType('MarketplaceSetReviewStatusInput')
export class MarketplaceSetReviewStatusInputDTO {
  @Field(() => String, { description: 'Идентификатор отзыва.' })
  @IsUUID()
  public readonly id!: string;

  @Field(() => MarketplaceReviewStatusEnum, {
    description: 'Новое состояние: HIDDEN — скрыть, PUBLISHED — вернуть в публикацию.',
  })
  @IsIn(Object.values(MarketplaceReviewStatuses))
  public readonly status!: MarketplaceReviewStatusEnum;

  @Field(() => String, { nullable: true, description: 'Причина скрытия. Обязательна, когда отзыв скрывают.' })
  @IsOptional()
  @IsString()
  @MaxLength(MARKETPLACE_REVIEW_HIDDEN_REASON_MAX)
  public readonly reason?: string | null;
}

@InputType('MarketplaceListReviewsFilterInput')
export class MarketplaceListReviewsFilterInputDTO {
  @Field(() => String, { nullable: true, description: 'Отзывы об одном предложении.' })
  @IsOptional()
  @IsUUID()
  public readonly offer_id?: string | null;

  @Field(() => String, { nullable: true, description: 'Отзывы обо всех предложениях поставщика.' })
  @IsOptional()
  @IsString()
  public readonly supplier_account?: string | null;

  @Field(() => String, { nullable: true, description: 'Отзывы одного автора.' })
  @IsOptional()
  @IsString()
  public readonly author_account?: string | null;

  @Field(() => String, { nullable: true, description: 'Подстрока текста отзыва.' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  public readonly search?: string | null;

  @Field(() => Boolean, {
    nullable: true,
    description: 'Показать и скрытые отзывы. Действует только для администратора.',
  })
  @IsOptional()
  @IsBoolean()
  public readonly include_hidden?: boolean | null;

  @Field(() => MarketplaceReviewStatusEnum, {
    nullable: true,
    description: 'Отбор по состоянию — вместе с показом скрытых.',
  })
  @IsOptional()
  @IsIn(Object.values(MarketplaceReviewStatuses))
  public readonly status?: MarketplaceReviewStatusEnum | null;
}

@InputType('MarketplaceReviewSummaryInput')
export class MarketplaceReviewSummaryInputDTO {
  @Field(() => String, { nullable: true, description: 'Сводка по одному предложению.' })
  @IsOptional()
  @IsUUID()
  public readonly offer_id?: string | null;

  @Field(() => String, { nullable: true, description: 'Сводка по всем предложениям поставщика.' })
  @IsOptional()
  @IsString()
  public readonly supplier_account?: string | null;
}
