import { Field, ID, InputType, ObjectType } from '@nestjs/graphql';
import { IsBoolean, IsEnum, IsOptional, IsString, IsUUID, Length } from 'class-validator';
import { EduRecipientType } from '../../domain/enums';
import type { EdubridgeLearnerEntity } from '../../infrastructure/entities';
import './edu-enums.registration';

/** Обучающийся глазами пайщика-родителя. Контакт виден владельцу записи — это его данные. */
@ObjectType('EduLearner')
export class EduLearnerDTO {
  @Field(() => ID, { description: 'Идентификатор обучающегося' })
  id!: string;

  @Field(() => String, { description: 'Имя обучающегося' })
  display_name!: string;

  @Field(() => EduRecipientType, { description: 'Как доставляется пропуск' })
  recipient_type!: EduRecipientType;

  @Field(() => String, { nullable: true, description: 'Почта / Telegram / код пропуска' })
  recipient_value!: string | null;

  @Field(() => Boolean, { description: 'Обучается сам пайщик' })
  is_self!: boolean;

  @Field(() => Date, { description: 'Добавлен' })
  created_at!: Date;

  constructor(e: EdubridgeLearnerEntity, opts: { showContact: boolean }) {
    this.id = e.id;
    this.display_name = e.display_name;
    this.recipient_type = e.recipient_type;
    this.recipient_value = opts.showContact ? e.recipient_value : null;
    this.is_self = e.is_self;
    this.created_at = e.created_at;
  }
}

@InputType('EduLearnerInput')
export class EduLearnerInputDTO {
  @Field(() => String, { description: 'Имя обучающегося' })
  @IsString()
  @Length(1, 255)
  display_name!: string;

  @Field(() => EduRecipientType, { description: 'Как доставляется пропуск' })
  @IsEnum(EduRecipientType)
  recipient_type!: EduRecipientType;

  @Field(() => String, { description: 'Почта / Telegram / код пропуска' })
  @IsString()
  @Length(1, 255)
  recipient_value!: string;

  @Field(() => Boolean, { nullable: true, description: 'Обучается сам пайщик' })
  @IsOptional()
  @IsBoolean()
  is_self?: boolean;
}

@InputType('EduUpdateLearnerInput')
export class EduUpdateLearnerInputDTO extends EduLearnerInputDTO {
  @Field(() => ID, { description: 'Идентификатор обучающегося' })
  @IsUUID()
  id!: string;
}
