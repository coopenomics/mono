import { Field, InputType, ObjectType, registerEnumType } from '@nestjs/graphql';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { InnerAccountType } from '@coopenomics/innercoop';
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

  @Field(() => String, {
    nullable: true,
    description: 'Кооперативный участок, где сверена личность; пусто — сверял совет кооператива',
  })
  attested_in?: string;
}

@InputType('VerifyParticipantOnsiteInput', {
  description: 'Верификация личности пайщика по паспорту при личной явке',
})
export class VerifyParticipantOnsiteInputDTO {
  @Field(() => String, { description: 'Имя аккаунта пайщика' })
  @IsString()
  @IsNotEmpty()
  username!: string;

  @Field(() => String, {
    nullable: true,
    description: 'Кооперативный участок, где проводится сверка; не указывается, если сверяет совет кооператива',
  })
  @IsString()
  @IsOptional()
  braname?: string;
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

@ObjectType('ParticipantIdentityForVerification', {
  description: 'Данные пайщика для сверки с документом, удостоверяющим личность',
})
export class ParticipantIdentityForVerificationDTO {
  @Field(() => String, { description: 'Имя аккаунта пайщика' })
  username!: string;

  @Field(() => InnerAccountType, { description: 'Тип пайщика' })
  type!: InnerAccountType;

  @Field(() => String, { description: 'ФИО или наименование' })
  full_name!: string;

  @Field(() => String, { nullable: true, description: 'Дата рождения' })
  birthdate?: string | null;

  @Field(() => String, { nullable: true, description: 'Серия паспорта' })
  passport_series?: string | null;

  @Field(() => String, { nullable: true, description: 'Номер паспорта' })
  passport_number?: string | null;

  @Field(() => String, { nullable: true, description: 'Кем выдан паспорт' })
  passport_issued_by?: string | null;

  @Field(() => String, { nullable: true, description: 'Дата выдачи паспорта' })
  passport_issued_at?: string | null;

  @Field(() => String, { nullable: true, description: 'Код подразделения' })
  passport_code?: string | null;

  @Field(() => String, { nullable: true, description: 'Адрес регистрации' })
  full_address?: string | null;

  @Field(() => String, { nullable: true, description: 'ИНН' })
  inn?: string | null;

  @Field(() => String, { nullable: true, description: 'ОГРН' })
  ogrn?: string | null;

  @Field(() => String, { nullable: true, description: 'ФИО представителя организации' })
  representative_name?: string | null;

  @Field(() => String, { nullable: true, description: 'Должность представителя' })
  representative_position?: string | null;

  @Field(() => String, { nullable: true, description: 'На основании чего действует представитель' })
  representative_based_on?: string | null;
}

@InputType('ParticipantIdentityForVerificationInput', {
  description: 'Запрос данных пайщика для сверки личности перед подтверждением',
})
export class ParticipantIdentityForVerificationInputDTO {
  @Field(() => String, { description: 'Имя аккаунта пайщика' })
  @IsString()
  @IsNotEmpty()
  username!: string;

  @Field(() => String, {
    nullable: true,
    description: 'Кооперативный участок, где идёт сверка; не указывается, если сверяет совет кооператива',
  })
  @IsString()
  @IsOptional()
  braname?: string;
}
