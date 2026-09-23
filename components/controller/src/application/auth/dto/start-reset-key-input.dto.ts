import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty } from 'class-validator';
import { t } from '~/i18n';

@InputType('StartResetKeyInput')
export class StartResetKeyInputDTO {
  @Field({ description: 'Электронная почта' })
  @IsNotEmpty({ message: t('auth.startResetKeyInputDto.fieldEmailRequired') })
  email!: string;
}
