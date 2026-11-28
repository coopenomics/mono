import { Field, InputType } from '@nestjs/graphql';
import { IsString } from 'class-validator';

/**
 * Запрос узла кооператива оператору: пополнить бак AXON сразу, без ожидания
 * планового такта. Узел называет только свой кооператив; остаток и право на
 * пополнение оператор сверяет по цепи и у провайдера сам.
 */
@InputType('RequestTankTopupInput')
export class RequestTankTopupInputDTO {
  @Field(() => String, { description: 'Имя аккаунта кооператива, чей бак AXON опустел' })
  @IsString()
  coopname!: string;
}
