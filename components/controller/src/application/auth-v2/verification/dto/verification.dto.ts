import { Field, InputType, Int, ObjectType, registerEnumType } from '@nestjs/graphql';
import { IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { InnerAccountType } from '@coopenomics/innercoop';
import {
  VerificationSource,
  VerificationStatus,
  VerificationType,
} from '~/domain/auth-v2/verification/verification.types';
import { VerificationReviewStatus } from '~/domain/auth-v2/verification/verification-review.types';

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

@InputType('VerificationPhotoInput', { description: 'Снимок сверки личности' })
export class VerificationPhotoInputDTO {
  @Field(() => String, { description: 'Содержимое файла в base64' })
  @IsString()
  @IsNotEmpty()
  content_base64!: string;

  @Field(() => String, { description: 'MIME-тип снимка' })
  @IsString()
  @IsNotEmpty()
  mime_type!: string;

  @Field(() => Int, { description: 'Размер файла в байтах' })
  @IsInt()
  size_bytes!: number;

  @Field(() => String, { description: 'SHA-256 содержимого в hex' })
  @IsString()
  @IsNotEmpty()
  checksum_sha256!: string;

  @Field(() => String, { nullable: true, description: 'Исходное имя файла' })
  @IsString()
  @IsOptional()
  original_filename?: string;
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

  @Field(() => [VerificationPhotoInputDTO], {
    nullable: true,
    description: 'Снимки сверки: пайщик, разворот паспорта, пайщик с паспортом. На участке обязательны',
  })
  @IsOptional()
  photos?: VerificationPhotoInputDTO[];
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

registerEnumType(VerificationReviewStatus, {
  name: 'VerificationReviewStatus',
  description: 'Состояние проверки сверки личности советом кооператива',
});

@ObjectType('VerificationReviewPhoto', { description: 'Ссылка на снимок сверки, действительна несколько минут' })
export class VerificationReviewPhotoDTO {
  @Field(() => String, { description: 'Ключ объекта в хранилище кооператива' })
  storage_key!: string;

  @Field(() => String, { description: 'MIME-тип снимка' })
  mime_type!: string;

  @Field(() => Int, { description: 'Размер файла в байтах' })
  size_bytes!: number;

  @Field(() => String, { description: 'Короткоживущая ссылка на снимок' })
  read_url!: string;
}

@ObjectType('VerificationReview', { description: 'Запись журнала верификаций: одна сверка личности и её судьба' })
export class VerificationReviewDTO {
  @Field(() => String, { description: 'Идентификатор записи' })
  id!: string;

  @Field(() => String, { description: 'Пайщик, чью личность сверяли' })
  username!: string;

  @Field(() => String, { description: 'Процедура сверки' })
  procedure!: string;

  @Field(() => String, { description: 'Участок, где сверяли; пусто — сверял совет кооператива' })
  braname!: string;

  @Field(() => String, { description: 'Кто сверил личность' })
  verificator!: string;

  @Field(() => VerificationReviewStatus, { description: 'Состояние проверки' })
  status!: VerificationReviewStatus;

  @Field(() => Int, { description: 'Сколько снимков приложено; после решения совета — ноль' })
  photos_count!: number;

  @Field(() => String, { description: 'Момент сверки' })
  created_at!: string;

  @Field(() => String, { nullable: true, description: 'Кто вынес решение' })
  decided_by?: string | null;

  @Field(() => String, { nullable: true, description: 'Момент решения' })
  decided_at?: string | null;

  @Field(() => String, { nullable: true, description: 'Причина отклонения или отзыва' })
  decision_reason?: string | null;
}

@InputType('VerificationReviewsInput', { description: 'Отбор записей журнала верификаций' })
export class VerificationReviewsInputDTO {
  @Field(() => VerificationReviewStatus, { nullable: true, description: 'Только записи в этом состоянии' })
  @IsOptional()
  status?: VerificationReviewStatus;

  @Field(() => String, { nullable: true, description: 'Только по этому пайщику' })
  @IsString()
  @IsOptional()
  username?: string;

  @Field(() => String, { nullable: true, description: 'Только по этому кооперативному участку' })
  @IsString()
  @IsOptional()
  braname?: string;

  @Field(() => Int, { nullable: true, description: 'Сколько записей вернуть (не больше 200)' })
  @IsInt()
  @IsOptional()
  limit?: number;
}

@InputType('ApproveVerificationInput', { description: 'Утверждение сверки личности советом' })
export class ApproveVerificationInputDTO {
  @Field(() => String, { description: 'Идентификатор записи журнала' })
  @IsString()
  @IsNotEmpty()
  review_id!: string;
}

@InputType('RejectVerificationInput', { description: 'Отклонение сверки личности советом' })
export class RejectVerificationInputDTO {
  @Field(() => String, { description: 'Идентификатор записи журнала' })
  @IsString()
  @IsNotEmpty()
  review_id!: string;

  @Field(() => String, { description: 'Причина отклонения — её увидит участок' })
  @IsString()
  @IsNotEmpty()
  reason!: string;
}

@InputType('VerificationReviewPhotosInput', { description: 'Запрос снимков сверки для проверки советом' })
export class VerificationReviewPhotosInputDTO {
  @Field(() => String, { description: 'Идентификатор записи журнала' })
  @IsString()
  @IsNotEmpty()
  review_id!: string;
}
