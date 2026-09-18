import { z } from 'zod';
import zodToJsonSchema from 'zod-to-json-schema';
import type { InnerIntakeJsonSchema } from '@coopenomics/innercoop';
import type { DeserializedDescriptionOfExtension } from '@coopenomics/extension-kit';

/**
 * Анкета вступления в программу «Генератор».
 *
 * Сейчас в ней одно поле — сопроводительное письмо: совету нужно понимать, кто
 * приходит в программу и что готов в неё принести. Анкета — обычная Zod-схема
 * с описанием полей, как у настроек расширения: когда понадобятся навыки,
 * ссылки на работы или занятость, сюда добавляются поля, а ядро и экран
 * вступления не меняются.
 *
 * В ядро схема уходит данными (JSON Schema): по ним оно строит форму и
 * проверяет ответ — длина, обязательность. Поэтому ограничения задаются тем,
 * что JSON Schema выражает (`min`/`max`, обязательность, перечисления), а не
 * произвольными `refine`.
 */

function describeField(description: DeserializedDescriptionOfExtension): string {
  return JSON.stringify(description);
}

// Заголовок анкеты виден, только когда анкет у заявителя несколько, — он
// различает их между собой и не должен повторять подпись поля.
export const GENERATOR_INTAKE_TITLE = 'Анкета программы «Генератор»';

export const GENERATOR_INTAKE_DESCRIPTION =
  'Совету кооператива важно понимать, кто вступает в программу «Генератор». Ответьте своими словами.';

export const COVER_LETTER_LABEL = 'Сопроводительное письмо';

export const COVER_LETTER_NOTE =
  'Расскажите о себе: чем занимаетесь, какие навыки и опыт готовы приложить в программе «Генератор» и почему хотите участвовать. Письмо прочитает совет кооператива при рассмотрении вашего заявления.';

export const COVER_LETTER_MIN_LENGTH = 200;
export const COVER_LETTER_MAX_LENGTH = 4000;
/** Высота поля письма до ввода: сразу видно, что ждут развёрнутый ответ. */
export const COVER_LETTER_MIN_ROWS = 6;

export const COVER_LETTER_PLACEHOLDER =
  'Начните писать: чем вы занимаетесь, что умеете и над чем хотите работать в программе…';

export const RESUME_URL_LABEL = 'Ссылка на резюме';

export const RESUME_URL_PLACEHOLDER = 'https://';

export const RESUME_URL_NOTE =
  'Необязательно, но желательно. Если резюме или портфолио опубликованы (hh.ru, LinkedIn, GitHub, личный сайт, облачный диск), вставьте ссылку.';

export const RESUME_URL_MAX_LENGTH = 500;

export const GeneratorIntakeSchema = z.object({
  cover_letter: z
    .string()
    .min(COVER_LETTER_MIN_LENGTH)
    .max(COVER_LETTER_MAX_LENGTH)
    .describe(
      describeField({
        label: COVER_LETTER_LABEL,
        note: COVER_LETTER_NOTE,
        minLength: COVER_LETTER_MIN_LENGTH,
        maxLength: COVER_LETTER_MAX_LENGTH,
        minRows: COVER_LETTER_MIN_ROWS,
        placeholder: COVER_LETTER_PLACEHOLDER,
      })
    ),
  // Файл резюме сейчас не принимаем: загрузка при вступлении — отдельная
  // механика (она же понадобится для уставных документов организаций).
  resume_url: z
    .string()
    .url()
    .max(RESUME_URL_MAX_LENGTH)
    .optional()
    .describe(
      describeField({
        label: RESUME_URL_LABEL,
        note: RESUME_URL_NOTE,
        maxLength: RESUME_URL_MAX_LENGTH,
        placeholder: RESUME_URL_PLACEHOLDER,
      })
    ),
});

export type GeneratorIntakeAnswer = z.infer<typeof GeneratorIntakeSchema>;

// Типы zod у `zod-to-json-schema` и у контроллера расходятся по версиям, и
// компилятор на живой схеме уходит в бесконечную развёртку (TS2589). Сама
// функция работает с любой Zod-схемой — сужаем только её типовую сигнатуру.
const toJsonSchema = zodToJsonSchema as unknown as (
  schema: unknown,
  options: { $refStrategy: 'none' }
) => InnerIntakeJsonSchema;

/** Анкета в том виде, в каком она уходит в ядро через порт, — данными. */
export function generatorIntakeJsonSchema(): InnerIntakeJsonSchema {
  return toJsonSchema(GeneratorIntakeSchema, { $refStrategy: 'none' });
}
