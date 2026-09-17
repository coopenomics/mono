/**
 * Анкета вступления в программу «Генератор» (C28-73): письмо на границах длины.
 *
 * Проверяется тот путь, которым анкета работает на деле: Zod-схема расширения →
 * JSON Schema через порт → приведение и проверка ответа в ядре.
 */
import {
  COVER_LETTER_LABEL,
  COVER_LETTER_MAX_LENGTH,
  COVER_LETTER_MIN_LENGTH,
  generatorIntakeJsonSchema,
} from '~/extensions/capital/application/registration/generator-intake.schema';
import { normalizeIntakeSchema, validateIntakeValues } from '~/domain/registration/utils/intake-schema.utils';

const text = (length: number) => 'я'.repeat(length);

const schema = normalizeIntakeSchema('generator_cover_letter', generatorIntakeJsonSchema());

const check = (cover_letter?: string) => validateIntakeValues(schema, { cover_letter });

describe('анкета «Генератора»: сопроводительное письмо', () => {
  it('схема доезжает до ядра с подписью, границами и обязательностью', () => {
    const field = (schema.properties as any).cover_letter;
    expect(field.description.label).toBe(COVER_LETTER_LABEL);
    expect(field.description.maxRows).toBeGreaterThan(1);
    expect(field.minLength).toBe(COVER_LETTER_MIN_LENGTH);
    expect(field.maxLength).toBe(COVER_LETTER_MAX_LENGTH);
    expect(schema.required).toEqual(['cover_letter']);
  });

  it('без письма и с письмом из одних пробелов — «заполните поле»', () => {
    expect(check().issues).toEqual([{ path: ['cover_letter'], message: 'заполните поле' }]);
    expect(check('     ').issues).toEqual([{ path: ['cover_letter'], message: 'заполните поле' }]);
  });

  it('на символ короче минимума не проходит, пробелы по краям в длину не идут', () => {
    const message = `не короче ${COVER_LETTER_MIN_LENGTH} символов`;
    expect(check(text(COVER_LETTER_MIN_LENGTH - 1)).issues).toEqual([{ path: ['cover_letter'], message }]);
    expect(check(`${' '.repeat(50)}${text(COVER_LETTER_MIN_LENGTH - 1)}${' '.repeat(50)}`).issues).toEqual([
      { path: ['cover_letter'], message },
    ]);
  });

  it('ровно минимум и ровно максимум проходят, текст обрезается', () => {
    const min = check(` ${text(COVER_LETTER_MIN_LENGTH)} `);
    expect(min.issues).toEqual([]);
    expect(min.data.cover_letter).toBe(text(COVER_LETTER_MIN_LENGTH));
    expect(check(text(COVER_LETTER_MAX_LENGTH)).issues).toEqual([]);
  });

  it('на символ длиннее максимума не проходит', () => {
    expect(check(text(COVER_LETTER_MAX_LENGTH + 1)).issues).toEqual([
      { path: ['cover_letter'], message: `не длиннее ${COVER_LETTER_MAX_LENGTH} символов` },
    ]);
  });
});
