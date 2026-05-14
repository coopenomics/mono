import { Field, InputType, Int, ObjectType } from '@nestjs/graphql';

@ObjectType('MarketplaceCppStatus')
export class MarketplaceCppStatusDTO {
  @Field(() => String, {
    description: '`active` — Совет принял положение ЦПП; `not_accepted` — расширение не подключено',
  })
  public readonly status!: 'active' | 'not_accepted';

  @Field(() => Int, { nullable: true })
  public readonly document_registry_id?: number;

  @Field(() => String, { nullable: true })
  public readonly accepted_at?: string;

  @Field(() => String, { nullable: true })
  public readonly accepted_by_board_decision_id?: string;

  constructor(init: {
    status: 'active' | 'not_accepted';
    document_registry_id?: number;
    accepted_at?: string;
    accepted_by_board_decision_id?: string;
  }) {
    this.status = init.status;
    this.document_registry_id = init.document_registry_id;
    this.accepted_at = init.accepted_at;
    this.accepted_by_board_decision_id = init.accepted_by_board_decision_id;
  }
}

@InputType('MarketplaceAcceptCppInput')
export class MarketplaceAcceptCppInputDTO {
  @Field(() => Int, {
    description: 'registry_id рендеренного instance положения ЦПП (Story 1.7 даст id из cooptypes)',
  })
  public document_registry_id!: number;

  @Field(() => String, {
    description: 'id решения Совета (FR40, Эпик 8). В MVP — stub string председателя.',
  })
  public accepted_by_board_decision_id!: string;
}
