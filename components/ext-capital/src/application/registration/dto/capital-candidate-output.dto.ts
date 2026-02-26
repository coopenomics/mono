import { Field, ObjectType } from '@nestjs/graphql';
import { CandidateOutputDTO } from '~/application/registration/dto/candidate.dto';
import { ContributorStatus } from '~/extensions/capital/domain/enums/contributor-status.enum';

@ObjectType('CapitalCandidate')
export class CapitalCandidateOutputDTO extends CandidateOutputDTO {
  @Field(() => ContributorStatus, { nullable: true })
  capital_status?: ContributorStatus;

  @Field(() => String, { nullable: true })
  rate_per_hour?: string;

  @Field(() => Number, { nullable: true })
  hours_per_day?: number;

  @Field(() => String, { nullable: true })
  contributed_as_investor?: string;

  @Field(() => String, { nullable: true })
  contributed_as_creator?: string;

  @Field(() => String, { nullable: true })
  contributed_as_author?: string;

  @Field(() => String, { nullable: true })
  contributed_as_coordinator?: string;

  @Field(() => String, { nullable: true })
  contributed_as_contributor?: string;

  @Field(() => String, { nullable: true })
  contributed_as_propertor?: string;

  @Field(() => Number, { nullable: true })
  level?: number;

  @Field(() => String, { nullable: true })
  about?: string;

  @Field(() => String, { nullable: true })
  contributor_hash?: string;

  @Field(() => String, { nullable: true })
  memo?: string;
}
