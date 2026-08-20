import { Field, InputType, ObjectType, registerEnumType } from '@nestjs/graphql';
import { IsNotEmpty, IsString } from 'class-validator';
import {
  VerificationSource,
  VerificationStatus,
  VerificationType,
} from '~/domain/auth-v2/verification/verification.types';

registerEnumType(VerificationType, {
  name: 'ParticipantVerificationType',
  description: 'Уровень верификации пайщика',
});

registerEnumType(VerificationStatus, {
  name: 'ParticipantVerificationStatus',
  description: 'Статус подтверждения уровня верификации',
});

registerEnumType(VerificationSource, {
  name: 'ParticipantVerificationSource',
  description: 'Кто подтвердил уровень верификации',
});

@ObjectType('ParticipantVerification', { description: 'Подтверждённый уровень верификации пайщика' })
export class ParticipantVerificationDTO {
  @Field(() => VerificationType, { description: 'Уровень верификации' })
  type!: VerificationType;

  @Field(() => VerificationStatus, { description: 'Статус подтверждения' })
  status!: VerificationStatus;

  @Field(() => VerificationSource, { description: 'Кто подтвердил' })
  source!: VerificationSource;

  @Field(() => String, { description: 'Момент подтверждения' })
  verified_at!: string;

  @Field(() => String, { nullable: true, description: 'Кто провёл верификацию (аккаунт)' })
  attested_by?: string;
}

@InputType('VerifyParticipantOnsiteInput', {
  description: 'Верификация личности пайщика на кооперативном участке по паспорту',
})
export class VerifyParticipantOnsiteInputDTO {
  @Field(() => String, { description: 'Имя аккаунта пайщика' })
  @IsString()
  @IsNotEmpty()
  username!: string;

  @Field(() => String, { description: 'Кооперативный участок, где проводится верификация' })
  @IsString()
  @IsNotEmpty()
  braname!: string;
}

@InputType('UnverifyParticipantInput', {
  description: 'Отзыв верификации личности пайщика председателем кооператива',
})
export class UnverifyParticipantInputDTO {
  @Field(() => String, { description: 'Имя аккаунта пайщика' })
  @IsString()
  @IsNotEmpty()
  username!: string;
}
