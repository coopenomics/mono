import { registerDecorator, type ValidationOptions } from 'class-validator';
import { _Common } from 'cooptypes';
import { validationMessage } from '../errors/domain-error';

/**
 * Текст, который уходит в подписываемый документ (повестка собрания, проект
 * решения совета), без исполняемой разметки.
 *
 * Вёрстка допускается: проекты решений на утверждение совета несут абзацы,
 * таблицы и стили документа. Отклоняются только скрипты, встраиваемые рамки и
 * объекты, формы, обработчики событий и опасные ссылки — правило одно с
 * очисткой редактора (`_Common.Text.hasExecutableMarkup` в cooptypes).
 *
 * Отказ, а не очистка: документ подписывается по хэшу, и переписанный текст
 * был бы не тем, что ввёл человек (решение владельца 25.09.2026, C28-80).
 */
export function SafeMarkup(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'safeMarkup',
      target: object.constructor,
      propertyName,
      options: { message: validationMessage('kit.markup.executable'), ...validationOptions },
      validator: {
        validate(value: unknown): boolean {
          return typeof value !== 'string' || !_Common.Text.hasExecutableMarkup(value);
        },
      },
    });
  };
}
