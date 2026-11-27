import { Field, Float, InputType, Int, ObjectType } from '@nestjs/graphql';
import { IsInt, IsNumber, IsOptional, Matches, Max, Min } from 'class-validator';

/** Верхняя граница цены приложения, ₽ в месяц: защита от опечатки на порядки. */
export const APP_PRICE_MAX_RUB = 1_000_000;

/** Цена пакета кооператива-издателя в каталоге приложений. */
@ObjectType('AppsPackagePricing')
export class AppsPackagePricingDTO {
  @Field(() => String, { description: 'Идентификатор пакета (например, @voskhod/demoapp)' })
  packageId!: string;

  @Field(() => Float, {
    nullable: true,
    description: 'Цена подписки, ₽ в месяц. Пусто — цена не назначена, первый выпуск не одобряется',
  })
  rubPerMonth?: number | null;

  @Field(() => Int, { description: 'Пробный срок, дней; 0 — оплата с первого дня' })
  trialDays!: number;

  @Field(() => String, {
    nullable: true,
    description: 'Действующая версия приложения. Пусто — действующего выпуска нет',
  })
  lastActiveVersion?: string | null;

  @Field(() => Boolean, {
    description: 'Пакет записан в каталоге: подан первый выпуск. Нет — цена назначена при регистрации',
  })
  inCatalog!: boolean;

  @Field(() => String, { nullable: true, description: 'Когда цена назначена (ISO 8601)' })
  updatedAt?: string | null;
}

/** Назначение цены своему пакету. */
@InputType('SetAppsPackagePricingInput')
export class SetAppsPackagePricingInputDTO {
  @Field(() => String, { description: 'Идентификатор пакета своего кооператива (@scope/name)' })
  @Matches(/^@[a-z1-5.]{1,12}\/[a-z0-9][a-z0-9._-]{0,63}$/)
  packageId!: string;

  @Field(() => Float, { description: 'Цена подписки, ₽ в месяц; 0 — бесплатно' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(APP_PRICE_MAX_RUB)
  rubPerMonth!: number;

  @Field(() => Int, { nullable: true, description: 'Пробный срок, дней; по умолчанию 0' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(365)
  trialDays?: number | null;
}
