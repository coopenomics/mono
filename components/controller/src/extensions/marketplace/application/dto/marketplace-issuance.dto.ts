import { Field, Float, ID, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

@InputType('MarketplaceListIssuancesByBranameInput')
export class MarketplaceListIssuancesByBranameInputDTO {
  @Field(() => String, { description: 'Кооперативный участок выдачи.' })
  @IsString()
  @IsNotEmpty()
  public readonly delivery_braname!: string;
}

/**
 * Превью акта выдачи (registry 1105) для подписи ОПЕРАТОРОМ КУ первой подписью
 * (signiss1) в едином пути выдачи: оператор кладёт подписанный акт в бандл
 * (marketplaceCreateStockProposal), на цепь он уходит только при подписи пайщика.
 */
@InputType('MarketplaceIssueActPayloadInput')
export class MarketplaceIssueActPayloadInputDTO {
  @Field(() => ID, { description: 'Заказ, по которому формируется preview акта выдачи.' })
  @IsString()
  @IsNotEmpty()
  public readonly order_id!: string;

  @Field(() => Float, {
    nullable: true,
    description:
      'Фактически выдаваемое количество для предпросмотра акта (если не указано — берётся заказ).',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  public readonly actual_quantity?: number;

  @Field(() => String, {
    nullable: true,
    description:
      'Фактическая цена за единицу для предпросмотра акта (если не указано — берётся цена заказа).',
  })
  @IsOptional()
  @IsString()
  public readonly actual_unit_price?: string;
}
