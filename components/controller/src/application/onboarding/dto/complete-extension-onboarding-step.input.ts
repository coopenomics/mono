import { Field, InputType } from '@nestjs/graphql';

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
  title?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Вопрос предлагаемого совету решения (для generator=free_decision)',
  })
  question?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Текст принимаемого решения (для generator=free_decision)',
  })
  decision?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Hash повестки общего собрания (для generator=meet)',
  })
  proposal_hash?: string;
}
