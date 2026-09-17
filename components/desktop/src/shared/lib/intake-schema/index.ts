/**
 * Анкеты вступления на стороне заявителя.
 *
 * Поля анкеты приходят JSON Schema — тем же видом, что схема настроек
 * расширения: описание поля (`label`, `note`, `minLength`, `maxLength`,
 * `maxRows`) лежит в `description`. Здесь — предварительная проверка, чтобы не
 * пускать человека дальше с заведомо непринимаемым ответом. Окончательно ответы
 * проверяет сервер схемой расширения.
 */

export interface IIntakeFieldDescription {
  label?: string;
  note?: string;
  minLength?: number;
  maxLength?: number;
  maxRows?: number;
  visible?: boolean;
}

export interface IIntakeSchemaProperty {
  type?: string;
  description?: IIntakeFieldDescription;
  enum?: unknown[];
  minLength?: number;
  maxLength?: number;
  properties?: Record<string, IIntakeSchemaProperty>;
  required?: string[];
}

export interface IIntakeSchema {
  type?: string;
  properties?: Record<string, IIntakeSchemaProperty>;
  required?: string[];
}

const isFilled = (value: unknown): boolean =>
  typeof value === 'string' ? value.trim() !== '' : value !== null && value !== undefined;

/** Замечания к длине текста; границы берутся из схемы, а если их там нет — из описания поля. */
function lengthProblems(label: string, property: IIntakeSchemaProperty, value: string): string[] {
  const length = value.trim().length;
  const minLength = property.minLength ?? property.description?.minLength;
  const maxLength = property.maxLength ?? property.description?.maxLength;
  const problems: string[] = [];
  if (typeof minLength === 'number' && length < minLength) problems.push(`${label}: не короче ${minLength} символов`);
  if (typeof maxLength === 'number' && length > maxLength) problems.push(`${label}: не длиннее ${maxLength} символов`);
  return problems;
}

function fieldProblems(name: string, property: IIntakeSchemaProperty, value: unknown, required: boolean): string[] {
  const label = property.description?.label ?? name;
  if (!isFilled(value)) return required ? [`${label}: заполните поле`] : [];
  if (property.type === 'object') return intakeFormProblems(property, value as Record<string, unknown>);
  return typeof value === 'string' ? lengthProblems(label, property, value) : [];
}

/** Замечания к ответам на анкету; пусто — можно идти дальше. */
export function intakeFormProblems(schema: unknown, values: Record<string, unknown> | undefined): string[] {
  const { properties = {}, required = [] } = (schema ?? {}) as IIntakeSchema;
  return Object.entries(properties).flatMap(([name, property]) =>
    fieldProblems(name, property, values?.[name], required.includes(name)),
  );
}
