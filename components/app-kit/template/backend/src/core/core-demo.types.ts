import { Field, Int, ObjectType } from '@nestjs/graphql';

/** Реквизиты кооператива узла — прочитаны у ядра портом `cooperativeVars`. */
@ObjectType('ExampleAppCooperative')
export class ExampleAppCooperative {
  @Field(() => String, { description: 'Учётное имя кооператива в цепи' })
  coopname!: string;

  @Field(() => String, { description: 'Полное название кооператива' })
  name!: string;

  @Field(() => String, { description: 'Краткое название для заголовков' })
  shortAbbr!: string;
}

/** Документ, сформированный ядром для пайщика, — до подписи. */
@ObjectType('ExampleAppDraftDocument')
export class ExampleAppDraftDocument {
  @Field(() => String, { description: 'Заголовок документа' })
  fullTitle!: string;

  @Field(() => String, { description: 'Хэш документа: его подписывает пайщик' })
  hash!: string;

  @Field(() => String, {
    description: 'Текст документа для показа перед подписью, HTML',
  })
  html!: string;

  @Field(() => Int, { description: 'Размер PDF документа, байт' })
  pdfBytes!: number;
}

/** Итог пробы подписи действия цепи ядром. */
@ObjectType('ExampleAppSignProbe')
export class ExampleAppSignProbe {
  @Field(() => String, { description: 'Действие цепи, которое подписало ядро' })
  action!: string;

  @Field(() => Int, { description: 'Сколько подписей поставило ядро' })
  signatures!: number;

  @Field(() => Boolean, { description: 'Отправлена ли транзакция в цепь' })
  broadcast!: boolean;
}
