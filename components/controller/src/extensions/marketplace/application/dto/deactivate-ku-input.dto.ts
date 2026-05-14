import { Field, InputType } from '@nestjs/graphql';
import { IsIn, IsString } from 'class-validator';

@InputType('MarketplaceSetKUStatusInput')
export class SetKUStatusInputDTO {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsString()
  coopname!: string;

  @Field(() => String, { description: 'Идентификатор КУ в core (`braname`)' })
  @IsString()
  coreBraname!: string;

  @Field(() => String, { description: 'Целевой статус ПВЗ: ACTIVE или INACTIVE' })
  @IsIn(['ACTIVE', 'INACTIVE'])
  status!: 'ACTIVE' | 'INACTIVE';
}
