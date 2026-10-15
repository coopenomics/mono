import { Field, InputType, ObjectType, registerEnumType } from '@nestjs/graphql';
import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { SafeMarkup } from '@coopenomics/extension-kit';

export enum ChairmanOnboardingAgendaStepEnum {
  wallet_agreement = 'wallet_agreement',
  signature_agreement = 'signature_agreement',
  privacy_agreement = 'privacy_agreement',
  user_agreement = 'user_agreement',
  participant_application = 'participant_application',
  voskhod_membership = 'voskhod_membership',
}

registerEnumType(ChairmanOnboardingAgendaStepEnum, {
  name: 'ChairmanOnboardingAgendaStep',
});

@InputType('ChairmanOnboardingAgendaInput')
export class ChairmanOnboardingAgendaInputDTO {
  @Field(() => ChairmanOnboardingAgendaStepEnum)
  @IsEnum(ChairmanOnboardingAgendaStepEnum)
  step!: ChairmanOnboardingAgendaStepEnum;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  @SafeMarkup()
  title?: string;

  @Field(() => String)
  @IsString()
  @IsNotEmpty()
  @SafeMarkup()
  question!: string;

  @Field(() => String)
  @IsString()
  @IsNotEmpty()
  @SafeMarkup()
  decision!: string;
}

@ObjectType('ChairmanOnboardingState')
export class ChairmanOnboardingStateDTO {
  @Field(() => Boolean)
  wallet_agreement_done!: boolean;

  @Field(() => String, { nullable: true })
  onboarding_wallet_agreement_hash?: string | null;

  @Field(() => Boolean)
  signature_agreement_done!: boolean;

  @Field(() => String, { nullable: true })
  onboarding_signature_agreement_hash?: string | null;

  @Field(() => Boolean)
  privacy_agreement_done!: boolean;

  @Field(() => String, { nullable: true })
  onboarding_privacy_agreement_hash?: string | null;

  @Field(() => Boolean)
  user_agreement_done!: boolean;

  @Field(() => String, { nullable: true })
  onboarding_user_agreement_hash?: string | null;

  @Field(() => Boolean)
  participant_application_done!: boolean;

  @Field(() => String, { nullable: true })
  onboarding_participant_application_hash?: string | null;

  @Field(() => Boolean)
  voskhod_membership_done!: boolean;

  @Field(() => String, { nullable: true })
  onboarding_voskhod_membership_hash?: string | null;

  @Field(() => Boolean)
  general_meet_done!: boolean;

  @Field(() => String, { nullable: true })
  onboarding_general_meet_hash?: string | null;

  @Field(() => String)
  onboarding_init_at!: string;

  @Field(() => String)
  onboarding_expire_at!: string;
}

@InputType('ChairmanOnboardingGeneralMeetInput')
export class ChairmanOnboardingGeneralMeetInputDTO {
  @Field(() => String)
  @IsString()
  @IsNotEmpty()
  proposal_hash!: string;
}
