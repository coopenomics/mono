import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsOptional, Matches, MaxLength } from 'class-validator';
import { MarketplaceSupplierModel } from '../../domain/entities/marketplace-supplier.types';

const EOSIO_NAME = /^[.1-5a-z]{1,12}$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Заявка пайщика на допуск по членской модели (путь 1). */
@InputType('MarketplaceRequestSupplierInput')
export class MarketplaceRequestSupplierInputDTO {
  @Field(() => String, { description: 'Номер договора с кооперативом' })
  @IsNotEmpty()
  @MaxLength(128)
  public contract_number!: string;

  @Field(() => String, { description: 'Дата заключения договора (ГГГГ-ММ-ДД)' })
  @Matches(ISO_DATE, { message: 'Дата договора в формате ГГГГ-ММ-ДД' })
  public contract_date!: string;
}

/** Прямое добавление поставщика администратором (путь 2). */
@InputType('MarketplaceAddSupplierInput')
export class MarketplaceAddSupplierInputDTO {
  @Field(() => String, { description: 'Аккаунт поставщика' })
  @IsNotEmpty()
  @MaxLength(13)
  @Matches(EOSIO_NAME, { message: 'Некорректный аккаунт (только [.1-5a-z], до 12 символов)' })
  public member_account!: string;

  @Field(() => MarketplaceSupplierModel, {
    nullable: true,
    description: 'Модель работы (по умолчанию членская)',
  })
  @IsOptional()
  public model?: MarketplaceSupplierModel;

  @Field(() => String, { nullable: true, description: 'Номер договора' })
  @IsOptional()
  @MaxLength(128)
  public contract_number?: string;

  @Field(() => String, { nullable: true, description: 'Дата заключения договора (ГГГГ-ММ-ДД)' })
  @IsOptional()
  @Matches(ISO_DATE, { message: 'Дата договора в формате ГГГГ-ММ-ДД' })
  public contract_date?: string;
}

/** Одобрение/отклонение заявки поставщика (председатель). */
@InputType('MarketplaceSupplierMemberInput')
export class MarketplaceSupplierMemberInputDTO {
  @Field(() => String, { description: 'Аккаунт поставщика' })
  @IsNotEmpty()
  @MaxLength(13)
  @Matches(EOSIO_NAME, { message: 'Некорректный аккаунт' })
  public member_account!: string;
}

/** Смена модели работы поставщика — требует переподписания договора. */
@InputType('MarketplaceSwitchSupplierModelInput')
export class MarketplaceSwitchSupplierModelInputDTO {
  @Field(() => MarketplaceSupplierModel, { description: 'Новая модель работы' })
  public model!: MarketplaceSupplierModel;

  @Field(() => String, { nullable: true, description: 'Номер нового договора (для членской)' })
  @IsOptional()
  @MaxLength(128)
  public contract_number?: string;

  @Field(() => String, { nullable: true, description: 'Дата нового договора (ГГГГ-ММ-ДД)' })
  @IsOptional()
  @Matches(ISO_DATE, { message: 'Дата договора в формате ГГГГ-ММ-ДД' })
  public contract_date?: string;
}
