import { Field, InputType } from '@nestjs/graphql';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

@InputType('ListMarketplaceKUInput')
export class ListMarketplaceKUInputDTO {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsString()
  coopname!: string;

  @Field(() => Boolean, {
    description: 'Только активные ПВЗ. Для заказчиков/поставщиков всегда `true`; для admin-стола `false`.',
    nullable: true,
    defaultValue: false,
  })
  @IsOptional()
  @IsBoolean()
  onlyActive?: boolean;
}
