import { registerDecorator, type ValidationArguments, type ValidationOptions } from 'class-validator';
import { t } from '~/i18n';

/** Угловые скобки: с них начинается любая разметка. */
const MARKUP_CHARS = /[<>]/;

/**
 * Анкетное поле без разметки.
 *
 * Данные пайщика подставляются в документ, а шаблоны собираются с выключенным
 * автоэкранированием — это осознанно, часть данных кооператива приходит с
 * разметкой. Оборотная сторона: фамилия или адрес с угловыми скобками сами
 * становятся разметкой и уезжают в подписываемый документ, в реестр и на стол
 * совета. Поэтому там, где человек вводит своё имя, адрес или реквизиты,
 * угловых скобок быть не должно вовсе.
 *
 * Проверка живёт на сервере, а не только в форме: браузерное правило
 * покрывало одни ФИО, а мутация принимала что угодно — и от кабинета, и от
 * любого клиента API.
 */
export function NoMarkup(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'noMarkup',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown): boolean {
          return typeof value !== 'string' || !MARKUP_CHARS.test(value);
        },
        defaultMessage(args: ValidationArguments): string {
          return t('app.noMarkupDecorator.noAngleBrackets', { property: args.property });
        },
      },
    });
  };
}
