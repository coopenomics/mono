import { Field, InputType, Int, ObjectType, registerEnumType } from '@nestjs/graphql';
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import {
  GreetingAccountType,
  GreetingSendStatus,
  GreetingSkipReason,
  GreetingTemplateStatus,
  GreetingVariable,
} from '../../domain/greetings.enums';

registerEnumType(GreetingTemplateStatus, {
  name: 'GreetingTemplateStatus',
  description: 'Состояние шаблона поздравления: черновик или действует',
});
registerEnumType(GreetingSendStatus, {
  name: 'GreetingSendStatus',
  description: 'Итог поздравления: письмо принято к доставке, не отправлено или отправка не удалась',
});
registerEnumType(GreetingSkipReason, {
  name: 'GreetingSkipReason',
  description: 'Почему поздравление не отправлено',
});
registerEnumType(GreetingAccountType, {
  name: 'GreetingAccountType',
  description: 'Пайщик — физическое лицо или индивидуальный предприниматель',
});
registerEnumType(GreetingVariable, {
  name: 'GreetingVariable',
  description: 'Переменная шаблона поздравления',
});

const DATE = /^\d{4}-\d{2}-\d{2}$/;

@ObjectType('GreetingTemplate', { description: 'Шаблон поздравления с днём рождения' })
export class GreetingTemplateDTO {
  @Field(() => String, { description: 'Идентификатор шаблона' })
  id!: string;

  @Field(() => String, { description: 'Название шаблона, например «Поздравление на 2026 год»' })
  title!: string;

  @Field(() => String, { description: 'Первый день периода действия, ГГГГ-ММ-ДД' })
  period_start!: string;

  @Field(() => String, { description: 'Последний день периода действия включительно, ГГГГ-ММ-ДД' })
  period_end!: string;

  @Field(() => String, { description: 'Тема письма с переменными' })
  subject!: string;

  @Field(() => String, { description: 'Текст письма в Markdown с переменными' })
  body!: string;

  @Field(() => GreetingTemplateStatus, { description: 'Состояние шаблона' })
  status!: GreetingTemplateStatus;

  @Field(() => String, { description: 'Кто создал шаблон' })
  created_by!: string;

  @Field(() => Date, { description: 'Когда создан' })
  created_at!: Date;

  @Field(() => Date, { description: 'Когда изменён' })
  updated_at!: Date;
}

@InputType('GreetingTemplateInput', { description: 'Шаблон поздравления: новый или правка существующего' })
export class GreetingTemplateInputDTO {
  @Field(() => String, { nullable: true, description: 'Идентификатор шаблона при правке; без него создаётся новый черновик' })
  @IsOptional()
  @IsString()
  id?: string | null;

  @Field(() => String, { description: 'Название шаблона' })
  @IsString()
  @MaxLength(200)
  title!: string;

  @Field(() => String, { description: 'Первый день периода действия, ГГГГ-ММ-ДД' })
  @Matches(DATE)
  period_start!: string;

  @Field(() => String, { description: 'Последний день периода действия включительно, ГГГГ-ММ-ДД' })
  @Matches(DATE)
  period_end!: string;

  @Field(() => String, { description: 'Тема письма с переменными' })
  @IsString()
  @MaxLength(300)
  subject!: string;

  @Field(() => String, { description: 'Текст письма в Markdown с переменными' })
  @IsString()
  @MaxLength(20000)
  body!: string;
}

@InputType('GreetingPreviewInput', { description: 'Текст для предпросмотра письма на пайщике' })
export class GreetingPreviewInputDTO {
  @Field(() => String, { description: 'Тема письма с переменными' })
  @IsString()
  @MaxLength(300)
  subject!: string;

  @Field(() => String, { description: 'Текст письма в Markdown с переменными' })
  @IsString()
  @MaxLength(20000)
  body!: string;

  @Field(() => String, { nullable: true, description: 'Пайщик для предпросмотра; без него — ближайший именинник' })
  @IsOptional()
  @IsString()
  username?: string | null;
}

@ObjectType('GreetingPreview', { description: 'Письмо, которое получит пайщик' })
export class GreetingPreviewDTO {
  @Field(() => String, { description: 'Имя аккаунта пайщика' })
  username!: string;

  @Field(() => String, { description: 'ФИО пайщика' })
  displayName!: string;

  @Field(() => Int, { nullable: true, description: 'Сколько лет исполняется в ближайший день рождения' })
  age!: number | null;

  @Field(() => String, { description: 'Тема письма' })
  subject!: string;

  @Field(() => String, { description: 'Тело письма в HTML' })
  bodyHtml!: string;

  @Field(() => [String], { description: 'Неизвестные переменные текста: такой шаблон нельзя включить' })
  unknownVariables!: string[];
}

@ObjectType('GreetingVariableInfo', { description: 'Переменная, которую можно вставить в шаблон' })
export class GreetingVariableDTO {
  @Field(() => GreetingVariable, { description: 'Переменная' })
  variable!: GreetingVariable;

  @Field(() => String, { description: 'Слово переменной в тексте шаблона, например «Имя»' })
  token!: string;

  @Field(() => String, { description: 'Что подставляется' })
  description!: string;
}

@ObjectType('GreetingCalendarEntry', { description: 'День рождения пайщика в календаре' })
export class GreetingCalendarEntryDTO {
  @Field(() => String, { description: 'Имя аккаунта пайщика' })
  username!: string;

  @Field(() => String, { description: 'ФИО пайщика' })
  displayName!: string;

  @Field(() => GreetingAccountType, { description: 'Физическое лицо или индивидуальный предприниматель' })
  account_type!: GreetingAccountType;

  @Field(() => Int, { description: 'Месяц рождения, 1–12' })
  month!: number;

  @Field(() => Int, { description: 'День рождения' })
  day!: number;

  @Field(() => String, { description: 'Дата поздравления в году календаря, ГГГГ-ММ-ДД' })
  date!: string;

  @Field(() => Int, { description: 'Сколько лет исполняется в году календаря' })
  age!: number;

  @Field(() => GreetingSendStatus, { nullable: true, description: 'Итог поздравления в году календаря; пусто — ещё не поздравляли' })
  send_status!: GreetingSendStatus | null;

  @Field(() => String, { nullable: true, description: 'Шаблон, который рассылка возьмёт на дату поздравления' })
  template_title!: string | null;
}

@ObjectType('GreetingSend', { description: 'Запись журнала поздравлений' })
export class GreetingSendDTO {
  @Field(() => String, { description: 'Идентификатор записи' })
  id!: string;

  @Field(() => String, { description: 'Имя аккаунта пайщика' })
  username!: string;

  @Field(() => String, { description: 'ФИО пайщика' })
  displayName!: string;

  @Field(() => Int, { description: 'Год поздравления' })
  year!: number;

  @Field(() => GreetingSendStatus, { description: 'Итог поздравления' })
  status!: GreetingSendStatus;

  @Field(() => GreetingSkipReason, { nullable: true, description: 'Почему поздравление не отправлено' })
  reason!: GreetingSkipReason | null;

  @Field(() => String, { nullable: true, description: 'Текст ошибки отправки' })
  error!: string | null;

  @Field(() => String, { nullable: true, description: 'Название шаблона на момент отправки' })
  template_title!: string | null;

  @Field(() => String, { nullable: true, description: 'Тема отправленного письма' })
  subject!: string | null;

  @Field(() => Int, { description: 'Число попыток' })
  attempts!: number;

  @Field(() => Date, { description: 'Когда поздравление записано в журнал впервые' })
  created_at!: Date;

  @Field(() => Date, { description: 'Когда запись журнала изменена' })
  updated_at!: Date;
}
