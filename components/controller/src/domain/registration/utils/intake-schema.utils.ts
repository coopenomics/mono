import { BadRequestException } from '@nestjs/common';
import type { InnerIntakeJsonSchema, InnerIntakeJsonSchemaProperty } from '@coopenomics/innercoop';

/**
 * Схема анкеты вступления в ядре.
 *
 * Расширение присылает JSON Schema, полученную из своей Zod-схемы; ядро по ней
 * же строит форму для заявителя и проверяет ответы. Поэтому на входе в реестр
 * схема приводится к одному виду (описание поля — разобранный объект, как у
 * схемы настроек расширения на десктопе) и сверяется с тем, что ядро умеет
 * проверить. Анкета, которую проверить нечем, в реестр не попадает.
 */
export type IntakeJsonSchema = InnerIntakeJsonSchema;
export type IntakeJsonSchemaProperty = InnerIntakeJsonSchemaProperty;

export interface IntakeIssue {
  path: string[];
  message: string;
}

const SCALAR_TYPES = ['string', 'number', 'integer', 'boolean'];

const labelOf = (property: IntakeJsonSchemaProperty | undefined): string | undefined => {
  const label = (property?.description as { label?: unknown } | undefined)?.label;
  return typeof label === 'string' && label.trim() !== '' ? label : undefined;
};

/** Описание поля приходит из `describeField` строкой JSON — разбираем её. */
function parseDescription(description: unknown): unknown {
  if (typeof description !== 'string') return description;
  try {
    return JSON.parse(description);
  } catch {
    return { label: description };
  }
}

function normalizeProperty(formId: string, name: string, source: IntakeJsonSchemaProperty): IntakeJsonSchemaProperty {
  const property: IntakeJsonSchemaProperty = { ...source, description: parseDescription(source.description) };

  if (!labelOf(property)) {
    throw new BadRequestException(`Анкета "${formId}": у поля "${name}" нет подписи (describeField.label)`);
  }

  if (property.type === 'object') {
    property.properties = normalizeProperties(formId, property.properties, name);
    return property;
  }

  const supported = SCALAR_TYPES.includes(property.type ?? '') || Array.isArray(property.enum);
  if (!supported) {
    throw new BadRequestException(
      `Анкета "${formId}": поле "${name}" — тип "${String(property.type)}" не поддерживается ` +
        `(строка, число, флажок, перечисление, вложенный объект)`
    );
  }
  return property;
}

function normalizeProperties(
  formId: string,
  properties: Record<string, IntakeJsonSchemaProperty> | undefined,
  owner: string
): Record<string, IntakeJsonSchemaProperty> {
  const entries = Object.entries(properties ?? {});
  if (entries.length === 0) {
    throw new BadRequestException(`Анкета "${formId}": ${owner} — объект обязан иметь хотя бы одно поле`);
  }
  return Object.fromEntries(entries.map(([name, property]) => [name, normalizeProperty(formId, name, property)]));
}

/**
 * Приводит схему анкеты к виду, в котором она хранится, показывается и
 * проверяется. Кривая анкета должна упасть на старте расширения, а не у
 * человека, который вступает в кооператив.
 */
export function normalizeIntakeSchema(formId: string, schema: IntakeJsonSchema): IntakeJsonSchema {
  if (schema?.type !== 'object') {
    throw new BadRequestException(`Анкета "${formId}": схема обязана быть объектом с полями`);
  }
  return {
    type: 'object',
    properties: normalizeProperties(formId, schema.properties, 'схема'),
    required: Array.isArray(schema.required) ? [...schema.required] : [],
  };
}

const isEmpty = (value: unknown): boolean => value === null || value === undefined || value === '';

/** Ссылка годится, только если это адрес сайта: http или https. */
function isWebLink(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === 'http:' || url.protocol === 'https:') && Boolean(url.hostname);
  } catch {
    return false;
  }
}

function checkString(property: IntakeJsonSchemaProperty, value: string): string | undefined {
  if (property.format === 'uri' && !isWebLink(value)) {
    return 'нужна ссылка вида https://…';
  }
  if (typeof property.minLength === 'number' && value.length < property.minLength) {
    return `не короче ${property.minLength} символов`;
  }
  if (typeof property.maxLength === 'number' && value.length > property.maxLength) {
    return `не длиннее ${property.maxLength} символов`;
  }
  return undefined;
}

function checkNumber(property: IntakeJsonSchemaProperty, value: number): string | undefined {
  if (property.type === 'integer' && !Number.isInteger(value)) return 'нужно целое число';
  if (typeof property.minimum === 'number' && value < property.minimum) return `не меньше ${property.minimum}`;
  if (typeof property.maximum === 'number' && value > property.maximum) return `не больше ${property.maximum}`;
  return undefined;
}

/** Замечание к значению скалярного поля; undefined — значение годится. */
function checkScalar(property: IntakeJsonSchemaProperty, value: unknown): string | undefined {
  if (Array.isArray(property.enum)) {
    return property.enum.includes(value) ? undefined : 'выберите значение из списка';
  }
  if (property.type === 'string') {
    return typeof value === 'string' ? checkString(property, value) : 'нужен текст';
  }
  if (property.type === 'boolean') {
    return typeof value === 'boolean' ? undefined : 'нужно «да» или «нет»';
  }
  return typeof value === 'number' && Number.isFinite(value) ? checkNumber(property, value) : 'нужно число';
}

interface IntakeValuesCheck {
  data: Record<string, unknown>;
  issues: IntakeIssue[];
}

/** Проверка одного заполненного поля: кладёт значение в data либо замечание в issues. */
function checkField(
  property: IntakeJsonSchemaProperty,
  value: unknown,
  fieldPath: string[],
  into: IntakeValuesCheck
): void {
  const name = fieldPath[fieldPath.length - 1];

  if (property.type === 'object') {
    const nested = validateIntakeValues(property, value, fieldPath);
    into.issues.push(...nested.issues);
    if (Object.keys(nested.data).length > 0) into.data[name] = nested.data;
    return;
  }

  const problem = checkScalar(property, value);
  if (problem) into.issues.push({ path: fieldPath, message: problem });
  else into.data[name] = value;
}

const asRecord = (values: unknown): Record<string, unknown> =>
  values && typeof values === 'object' && !Array.isArray(values) ? (values as Record<string, unknown>) : {};

/**
 * Проверяет значения по схеме анкеты. Возвращает очищенные данные (строки
 * обрезаны, незаполненное и неизвестное отброшено) и замечания с путём к полю.
 */
export function validateIntakeValues(
  schema: IntakeJsonSchemaProperty,
  values: unknown,
  path: string[] = []
): IntakeValuesCheck {
  const source = asRecord(values);
  const result: IntakeValuesCheck = { data: {}, issues: [] };

  for (const [name, property] of Object.entries(schema.properties ?? {})) {
    const fieldPath = [...path, name];
    const raw = source[name];
    const value = typeof raw === 'string' ? raw.trim() : raw;

    if (!isEmpty(value)) {
      checkField(property, value, fieldPath, result);
    } else if (schema.required?.includes(name)) {
      result.issues.push({ path: fieldPath, message: 'заполните поле' });
    }
  }

  return result;
}

/** Подпись поля по пути из замечания; если подписи нет — само имя поля. */
export function intakeFieldLabel(schema: IntakeJsonSchema, path: string[]): string {
  let node: IntakeJsonSchemaProperty | undefined = schema;
  let label = '';
  for (const segment of path) {
    node = node?.properties?.[segment];
    label = labelOf(node) ?? label;
  }
  return label || path.join('.');
}
