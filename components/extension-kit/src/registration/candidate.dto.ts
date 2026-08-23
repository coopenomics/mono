import { Field, ObjectType, registerEnumType } from '@nestjs/graphql';

/**
 * Состояние заявки на вступление.
 *
 * Перечень и форма кандидата живут в каркасе: заявку показывает и ядро, и
 * расширения, а `CapitalCandidate` от этой формы наследуется — базовый класс
 * инъекцией не подменить, он обязан лежать в пакете.
 */
export enum CandidateStatus {
  PENDING = 'pending',
  REGISTERED = 'registered',
  FAILED = 'failed',
}

registerEnumType(CandidateStatus, {
  name: 'CandidateStatus',
});

@ObjectType('Candidate')
export class CandidateOutputDTO {
  @Field(() => String)
  username!: string;

  @Field(() => String, { nullable: true })
  username_display_name?: string;

  @Field(() => String)
  coopname!: string;

  @Field(() => String, { nullable: true })
  braname?: string;

  @Field(() => CandidateStatus)
  status!: CandidateStatus;

  @Field(() => String)
  type!: string;

  @Field(() => Date)
  created_at!: Date;

  @Field(() => Date, { nullable: true })
  registered_at?: Date;

  @Field(() => String, { nullable: true })
  referer?: string;

  @Field(() => String, { nullable: true })
  referer_display_name?: string;

  @Field(() => String)
  public_key!: string;

  @Field(() => String, { nullable: true })
  program_key?: string;
}
