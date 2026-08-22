import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType('MarketplaceVitrine')
export class MarketplaceVitrineDTO {
  @Field(() => String, { description: 'Идентификатор витрины (MVP всегда "default")' })
  public readonly id!: string;

  @Field(() => String, { description: 'eosio::name кооператива-владельца витрины' })
  public readonly coopname!: string;

  @Field(() => String, { description: 'Отображаемое имя витрины' })
  public readonly display_name!: string;

  @Field(() => Boolean, { description: 'Дефолтная витрина кооператива (MVP — всегда true)' })
  public readonly is_default!: boolean;

  @Field(() => Date)
  public readonly created_at!: Date;

  @Field(() => Date)
  public readonly updated_at!: Date;

  constructor(init: {
    id: string;
    coopname: string;
    display_name: string;
    is_default: boolean;
    created_at: Date;
    updated_at: Date;
  }) {
    this.id = init.id;
    this.coopname = init.coopname;
    this.display_name = init.display_name;
    this.is_default = init.is_default;
    this.created_at = init.created_at;
    this.updated_at = init.updated_at;
  }
}
