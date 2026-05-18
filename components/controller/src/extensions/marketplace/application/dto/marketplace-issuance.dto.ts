import { Field, ID, InputType, Int, ObjectType } from '@nestjs/graphql';
import { IsInt, IsNotEmpty, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { MarketplaceIssueActSignedDocumentInputDTO } from '~/application/document/documents-dto/marketplace-issue-act-document.dto';
import { MarketplaceOrderDTO } from './marketplace-order.dto';

/**
 * Story 6.1: вход на открытие выдачи председателем КУ (первая подпись АПП).
 */
@InputType('MarketplaceOpenIssuanceInput')
export class MarketplaceOpenIssuanceInputDTO {
  @Field(() => ID, { description: 'Идентификатор заказа, выдачу которого открываем.' })
  @IsString()
  @IsNotEmpty()
  public readonly order_id!: string;

  @Field(() => MarketplaceIssueActSignedDocumentInputDTO, {
    description:
      'Подписанный председателем кооперативного участка акт выдачи. Backend верифицирует подпись и отправляет on-chain первую подпись.',
  })
  @ValidateNested()
  @Type(() => MarketplaceIssueActSignedDocumentInputDTO)
  public readonly signed_document!: MarketplaceIssueActSignedDocumentInputDTO;
}

/**
 * Story 6.3: вход на финальную подпись заказчика (получение имущества).
 *
 * `actual_quantity` указывается оператором перед сканированием подписи и
 * влияет на корректирующие операции в композитной транзакции `signiss2`
 * (см. FR23-25 и контракт `signiss2.cpp`).
 *
 * `delivery_signer` — учётная запись стороны кооператива (председатель КУ
 * или доверенное им лицо), подписывающая акт вместе с заказчиком.
 */
@InputType('MarketplaceFinalizeIssuanceInput')
export class MarketplaceFinalizeIssuanceInputDTO {
  @Field(() => ID, { description: 'Идентификатор заказа, который выдаём пайщику.' })
  @IsString()
  @IsNotEmpty()
  public readonly order_id!: string;

  @Field(() => Int, {
    description: 'Фактически выдаваемое количество единиц (равно/меньше/больше заказа).',
  })
  @IsInt()
  @Min(1)
  public readonly actual_quantity!: number;

  @Field(() => String, {
    description: 'Учётная запись стороны кооператива, подписывающей акт вместе с заказчиком.',
  })
  @IsString()
  @IsNotEmpty()
  public readonly delivery_signer!: string;

  @Field(() => MarketplaceIssueActSignedDocumentInputDTO, {
    description:
      'Подписанный заказчиком и стороной кооператива акт выдачи. Backend верифицирует подписи и отправляет on-chain финальную подпись со всеми корректирующими операциями.',
  })
  @ValidateNested()
  @Type(() => MarketplaceIssueActSignedDocumentInputDTO)
  public readonly signed_document!: MarketplaceIssueActSignedDocumentInputDTO;
}

@InputType('MarketplaceListIssuancesByBranameInput')
export class MarketplaceListIssuancesByBranameInputDTO {
  @Field(() => String, { description: 'Кооперативный участок выдачи.' })
  @IsString()
  @IsNotEmpty()
  public readonly delivery_braname!: string;
}

@InputType('MarketplaceIssueActPayloadInput')
export class MarketplaceIssueActPayloadInputDTO {
  @Field(() => ID, { description: 'Заказ, по которому формируется preview акта выдачи.' })
  @IsString()
  @IsNotEmpty()
  public readonly order_id!: string;

  @Field(() => Int, {
    nullable: true,
    description:
      'Фактически выдаваемое количество для финальной подписи (если не указано — берётся заказ).',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  public readonly actual_quantity?: number;
}

@ObjectType('MarketplaceIssuanceResult', {
  description: 'Результат подписания акта выдачи имущества пайщику.',
})
export class MarketplaceIssuanceResultDTO {
  @Field(() => MarketplaceOrderDTO, { description: 'Заказ после применения подписи.' })
  public readonly order!: MarketplaceOrderDTO;

  @Field(() => String, { description: 'Хэш транзакции подписи в блокчейне.' })
  public readonly tx_hash!: string;

  constructor(init: { order: MarketplaceOrderDTO; tx_hash: string }) {
    this.order = init.order;
    this.tx_hash = init.tx_hash;
  }
}
