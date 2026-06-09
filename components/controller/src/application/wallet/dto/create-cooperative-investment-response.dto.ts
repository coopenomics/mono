import { Field, ObjectType } from '@nestjs/graphql';

/**
 * DTO для ответа создания заявки кооператива на инвестирование
 * в ЦПП кооператива-оператора платформы
 */
@ObjectType('CreateCooperativeInvestmentResponse')
export class CreateCooperativeInvestmentResponseDTO {
  @Field(() => String, { description: 'Хеш созданной заявки на инвестирование' })
  invest_hash!: string;
}
