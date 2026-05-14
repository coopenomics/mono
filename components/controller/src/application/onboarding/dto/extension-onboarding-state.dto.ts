import { Field, ObjectType, Int } from '@nestjs/graphql';

@ObjectType('ExtensionOnboardingStepState')
export class ExtensionOnboardingStepStateDTO {
  @Field(() => String, { description: 'Идентификатор шага (соответствует config-полю onboarding_<step_key>_done)' })
  step_key!: string;

  @Field(() => Boolean, { description: 'Завершён ли шаг (ратифицирован)' })
  done!: boolean;

  @Field(() => String, { nullable: true, description: 'Hash опубликованного документа шага' })
  hash!: string | null;

  @Field(() => Int, { description: 'Порядок отображения' })
  order!: number;

  @Field(() => String, {
    nullable: true,
    description: 'Заголовок шага по умолчанию (если payload не передал свой)',
  })
  default_title!: string | null;
}

@ObjectType('ExtensionOnboardingState')
export class ExtensionOnboardingStateDTO {
  @Field(() => String, { description: 'Имя расширения' })
  extension_name!: string;

  @Field(() => [ExtensionOnboardingStepStateDTO], { description: 'Список шагов онбординга в порядке отображения' })
  steps!: ExtensionOnboardingStepStateDTO[];

  @Field(() => String, { description: 'Момент старта онбординга (ISO)' })
  onboarding_init_at!: string;

  @Field(() => String, { description: 'Момент истечения TTL онбординга (ISO)' })
  onboarding_expire_at!: string;

  @Field(() => Boolean, { description: 'Все шаги завершены' })
  all_done!: boolean;
}
