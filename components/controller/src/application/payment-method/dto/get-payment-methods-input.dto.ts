// payment-method.dto.ts
import { Field, InputType } from '@nestjs/graphql';
import { IsString, IsOptional } from 'class-validator';
import { PaginationInputDTO } from '@coopenomics/extension-kit';

@InputType('GetPaymentMethodsInput')
export class GetPaymentMethodsInputDTO extends PaginationInputDTO {
  @Field(() => String, { nullable: true, description: 'Имя пользователя для фильтрации методов оплаты' })
  @IsOptional()
  @IsString()
  username?: string;
}
