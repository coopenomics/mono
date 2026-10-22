import { Field, InputType } from '@nestjs/graphql';
import { IsOptional, IsString } from 'class-validator';

@InputType('CapitalShareTransferFilter', { description: 'Отбор истории трансляций паевого взноса' })
export class ShareTransferFilterInputDTO {
  @Field(() => String, {
    nullable: true,
    description: 'Пайщик. Не указан — история всех пайщиков кооператива (только председателю)',
  })
  @IsOptional()
  @IsString()
  username?: string;
}
