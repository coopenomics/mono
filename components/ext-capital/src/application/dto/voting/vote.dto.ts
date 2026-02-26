import { ObjectType, Field, Int } from '@nestjs/graphql';
import { BaseOutputDTO } from '~/shared/dto/base.dto';
/**
 * GraphQL Output DTO для сущности Vote
 */
@ObjectType('CapitalVote', {
  description: 'Голос в системе CAPITAL',
})
export class VoteOutputDTO extends BaseOutputDTO {
  @Field(() => Int, {
    nullable: true,
    description: 'ID в блокчейне',
  })
  id?: number;

  @Field(() => String, {
    nullable: true,
    description: 'Название кооператива',
  })
  coopname?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Хеш проекта',
  })
  project_hash?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Голосующий',
  })
  voter?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Отображаемое имя голосующего',
  })
  voter_display_name?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Получатель',
  })
  recipient?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Отображаемое имя получателя голоса',
  })
  recipient_display_name?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Сумма голоса',
  })
  amount?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Дата голосования',
  })
  voted_at?: string;
}
