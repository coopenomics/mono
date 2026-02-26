import { Field, InputType, ObjectType, registerEnumType } from '@nestjs/graphql';
import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export enum CapitalOnboardingStepEnum {
  generator_program_template = 'generator_program_template',
  generation_contract_template = 'generation_contract_template',
  generator_offer_template = 'generator_offer_template',
  blagorost_program = 'blagorost_program',
  blagorost_offer_template = 'blagorost_offer_template',
}

registerEnumType(CapitalOnboardingStepEnum, {
  name: 'CapitalOnboardingStep',
});

@InputType('CapitalOnboardingStepInput')
export class CapitalOnboardingStepInputDTO {
  @Field(() => CapitalOnboardingStepEnum)
  @IsEnum(CapitalOnboardingStepEnum)
  step!: CapitalOnboardingStepEnum;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @Field(() => String)
  @IsString()
  @IsNotEmpty()
  question!: string;

  @Field(() => String)
  @IsString()
  @IsNotEmpty()
  decision!: string;
}

@ObjectType('CapitalOnboardingState')
export class CapitalOnboardingStateDTO {
  @Field(() => Boolean)
  generator_program_template_done!: boolean;

  @Field(() => String, { nullable: true })
  onboarding_generator_program_template_hash?: string | null;

  @Field(() => Boolean)
  generation_contract_template_done!: boolean;

  @Field(() => String, { nullable: true })
  onboarding_generation_contract_template_hash?: string | null;

  @Field(() => Boolean)
  generator_offer_template_done!: boolean;

  @Field(() => String, { nullable: true })
  onboarding_generator_offer_template_hash?: string | null;

  @Field(() => Boolean)
  blagorost_provision_done!: boolean;

  @Field(() => String, { nullable: true })
  onboarding_blagorost_provision_hash?: string | null;

  @Field(() => Boolean)
  blagorost_offer_template_done!: boolean;

  @Field(() => String, { nullable: true })
  onboarding_blagorost_offer_template_hash?: string | null;

  @Field(() => String)
  onboarding_init_at!: string;

  @Field(() => String)
  onboarding_expire_at!: string;
}
