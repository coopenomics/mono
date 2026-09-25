import { Field, InputType } from '@nestjs/graphql';
import { IsOptional, IsString } from 'class-validator';
import { SafeMarkup } from '@coopenomics/extension-kit';

/**
 * Шаг онбординга расширения. Вопрос и проект решения уходят в документ на
 * утверждение совета вместе с вёрсткой — она допускается, исполняемая разметка
 * отклоняется (решение владельца 25.09.2026, C28-80).
 */
@InputType('CompleteExtensionOnboardingStepInput')
export class CompleteExtensionOnboardingStepInputDTO {
  @Field(() => String, { description: 'Имя расширения' })
  extension_name!: string;

  @Field(() => String, { description: 'Ключ шага из реестра онбординга' })
  step_key!: string;

  @Field(() => String, {
    nullable: true,
    description: 'Заголовок предлагаемого совету решения (опционально, если не задано — берётся default_title шага)',
  })
  @IsOptional()
  @IsString()
  @SafeMarkup()
  title?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Вопрос предлагаемого совету решения (для generator=free_decision)',
  })
  @IsOptional()
  @IsString()
  @SafeMarkup()
  question?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Текст принимаемого решения (для generator=free_decision)',
  })
  @IsOptional()
  @IsString()
  @SafeMarkup()
  decision?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Hash повестки общего собрания (для generator=meet)',
  })
  proposal_hash?: string;
}
