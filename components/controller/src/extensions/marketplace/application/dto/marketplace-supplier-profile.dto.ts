import { Field, Float, InputType, Int, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import {
  MARKETPLACE_SUPPLIER_PROFILE_ABOUT_MAX,
  MARKETPLACE_SUPPLIER_PROFILE_NAME_MAX,
} from '../../domain/entities/marketplace-supplier-profile.entity';
import type { SupplierProfileView } from '../services/marketplace-supplier-profile.service';

@ObjectType('MarketplaceSupplierProfile')
export class MarketplaceSupplierProfileDTO {
  @Field(() => String, { description: 'Учётная запись поставщика.' })
  public readonly supplier_account!: string;

  @Field(() => String, {
    description: 'Имя поставщика на его странице: заданное им название либо имя из сертификата.',
  })
  public readonly display_name!: string;

  @Field(() => String, {
    nullable: true,
    description: 'Название, которое поставщик задал сам. Пусто — показывается имя из сертификата.',
  })
  public readonly custom_display_name!: string | null;

  @Field(() => String, { description: 'Что поставщик рассказывает о себе.' })
  public readonly about!: string;

  @Field(() => String, {
    nullable: true,
    description: 'Ссылка на обложку профиля; подписана и ограничена по времени. Пусто — обложки нет.',
  })
  public readonly cover_url!: string | null;

  @Field(() => Boolean, {
    description: 'Профиль кооператива: он поставляет имущество со своего склада.',
  })
  public readonly is_cooperative!: boolean;

  @Field(() => Int, { description: 'Число предложений поставщика, доступных к заказу.' })
  public readonly offers_count!: number;

  @Field(() => Float, {
    nullable: true,
    description: 'Средняя оценка по отзывам на все предложения поставщика. Пусто — отзывов нет.',
  })
  public readonly rating_avg!: number | null;

  @Field(() => Int, { description: 'Число отзывов на все предложения поставщика.' })
  public readonly reviews_count!: number;

  @Field(() => Date, { nullable: true, description: 'Когда поставщик последний раз правил профиль.' })
  public readonly updated_at!: Date | null;

  constructor(view: SupplierProfileView, cover_url: string | null) {
    this.supplier_account = view.supplier_account;
    this.display_name = view.display_name;
    this.custom_display_name = view.custom_display_name;
    this.about = view.about;
    this.cover_url = cover_url;
    this.is_cooperative = view.is_cooperative;
    this.offers_count = view.offers_count;
    this.rating_avg = view.rating_avg;
    this.reviews_count = view.reviews_count;
    this.updated_at = view.updated_at;
  }
}

@InputType('MarketplaceSupplierProfileCoverInput')
export class MarketplaceSupplierProfileCoverInputDTO {
  @Field(() => String, { description: 'Содержимое изображения в base64.' })
  @IsString()
  @IsNotEmpty()
  public readonly base64!: string;

  @Field(() => String, { description: 'Тип изображения: image/jpeg, image/png либо image/webp.' })
  @IsString()
  @IsNotEmpty()
  public readonly mime_type!: string;
}

@InputType('MarketplaceUpdateSupplierProfileInput')
export class MarketplaceUpdateSupplierProfileInputDTO {
  @Field(() => String, {
    nullable: true,
    description: 'Что поставщик рассказывает о себе. Не задано — текст остаётся прежним.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(MARKETPLACE_SUPPLIER_PROFILE_ABOUT_MAX)
  public readonly about?: string | null;

  @Field(() => String, {
    nullable: true,
    description:
      'Название на странице поставщика. Пустая строка возвращает имя из сертификата; не задано — название остаётся прежним.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(MARKETPLACE_SUPPLIER_PROFILE_NAME_MAX)
  public readonly display_name?: string | null;

  @Field(() => MarketplaceSupplierProfileCoverInputDTO, {
    nullable: true,
    description: 'Новая обложка профиля. Не задана — обложка остаётся прежней.',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => MarketplaceSupplierProfileCoverInputDTO)
  public readonly cover?: MarketplaceSupplierProfileCoverInputDTO | null;

  @Field(() => Boolean, { nullable: true, description: 'Убрать обложку профиля.' })
  @IsOptional()
  @IsBoolean()
  public readonly remove_cover?: boolean | null;
}
