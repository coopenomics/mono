import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, Matches, MaxLength } from 'class-validator';

@InputType('MarketplaceAddToWhitelistInput')
export class MarketplaceAddToWhitelistInputDTO {
  @Field(() => String, { description: 'eosio::name пайщика-поставщика (3-12 chars, [.12345abcdefghijklmnopqrstuvwxyz])' })
  @IsNotEmpty()
  @MaxLength(13)
  @Matches(/^[.1-5a-z]{1,12}$/, { message: 'Некорректный eosio::name (только [.1-5a-z], до 12 символов)' })
  public member_account!: string;
}

@InputType('MarketplaceRemoveFromWhitelistInput')
export class MarketplaceRemoveFromWhitelistInputDTO {
  @Field(() => String, { description: 'eosio::name пайщика-поставщика' })
  @IsNotEmpty()
  @MaxLength(13)
  @Matches(/^[.1-5a-z]{1,12}$/, { message: 'Некорректный eosio::name' })
  public member_account!: string;
}
