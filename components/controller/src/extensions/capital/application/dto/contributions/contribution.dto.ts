import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { IsNotEmpty, IsString } from 'class-validator';
import { ContributionKind } from '../../../domain/enums/contribution-kind.enum';

@ObjectType('CapitalContribution', { description: 'Паевой взнос пайщика в программу Благороста' })
export class ContributionOutputDTO {
  @Field(() => String, { description: 'Номер операции в книге учёта' })
  id!: string;

  @Field(() => ContributionKind, { description: 'Вид взноса' })
  kind!: ContributionKind;

  @Field(() => String, { description: 'Сумма взноса' })
  amount!: string;

  @Field(() => String, { description: 'Дата взноса' })
  created_at!: string;

  @Field(() => String, { nullable: true, description: 'Идентификатор процесса: взноса имуществом, результата или инвестиции' })
  process_hash?: string | null;

  @Field(() => String, { nullable: true, description: 'Пояснение операции' })
  memo?: string | null;
}

@InputType('CapitalContributionsFilter')
export class ContributionsFilterInputDTO {
  @Field(() => String, { description: 'Имя пайщика' })
  @IsString()
  @IsNotEmpty()
  username!: string;
}
