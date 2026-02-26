import { InputType, Field, Int } from '@nestjs/graphql';
import { IsOptional, IsNumber } from 'class-validator';

/**
 * Input для получения атрибутов категории и типа
 */
@InputType()
export class GetCategoryAttributesInput {
  @Field(() => Int, { description: 'ID категории' })
  @IsNumber()
  categoryId!: number;

  @Field(() => Int, { description: 'ID типа товара' })
  @IsNumber()
  typeId!: number;

  @Field({ description: 'Включать значения словарей', nullable: true, defaultValue: true })
  @IsOptional()
  includeDictionaryValues?: boolean;

  @Field({ description: 'Только обязательные атрибуты', nullable: true, defaultValue: false })
  @IsOptional()
  onlyRequired?: boolean;
}
