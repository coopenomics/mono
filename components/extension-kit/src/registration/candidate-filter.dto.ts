import { Field, InputType } from '@nestjs/graphql';

@InputType('CandidateFilterInput')
export class CandidateFilterInputDTO {
  @Field(() => String, { nullable: true })
  referer?: string;
}
