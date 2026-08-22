import { Field, InputType } from '@nestjs/graphql';
import { IsEnum, IsString } from 'class-validator';
import { KuDetailsStatuses } from '../../domain/entities/ku-details-domain.entity';
import { KuDetailsStatusEnum } from './ku-details.dto';

@InputType('MarketplaceSetKUStatusInput')
export class SetKUStatusInputDTO {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsString()
  coopname!: string;

  @Field(() => String, { description: 'Идентификатор КУ в core (`braname`)' })
  @IsString()
  coreBraname!: string;

  @Field(() => KuDetailsStatusEnum, { description: 'Целевой статус ПВЗ' })
  @IsEnum(KuDetailsStatuses)
  status!: KuDetailsStatusEnum;
}
