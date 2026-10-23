import { Field, InputType, Int } from '@nestjs/graphql';

@InputType('ProcessesFilter')
export class ProcessesFilterInput {
  @Field(() => String) coopname!: string;
  @Field(() => String, { nullable: true }) processType?: string;
  @Field(() => String, { nullable: true }) username?: string;
  @Field(() => String, { nullable: true, description: 'Идентификатор процесса — точечная адресация одного процесса по его хэшу' })
  processHash?: string;
  @Field(() => Int, { nullable: true }) fromBlock?: number;
  @Field(() => Int, { nullable: true }) toBlock?: number;
}
