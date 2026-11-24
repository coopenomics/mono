import MarkdownIt from 'markdown-it';
import { t } from '../i18n';
import { GreetingVariable } from './greetings.enums';

/**
 * Построение письма из шаблона председателя.
 *
 * Одна функция на предпросмотр и рассылку: председатель видит ровно то
 * письмо, которое получит пайщик.
 *
 * Текст шаблона — Markdown. `markdown-it` с `html: false` экранирует любой
 * HTML в тексте, поэтому отдельная очистка разметки председателя не требуется.
 * Переменные подставляются после Markdown и экранируются: фамилия со
 * звёздочкой или угловой скобкой не превратится в разметку.
 */

const markdown = new MarkdownIt({ html: false, linkify: true, breaks: true });

/** Значения переменных для одного пайщика. */
export type GreetingValues = Record<GreetingVariable, string>;

/** Данные пайщика и кооператива: из них функция строит значения переменных. */
export interface GreetingSubject {
  lastName: string;
  firstName: string;
  middleName: string;
  /** Сколько лет исполняется; `null`, если год рождения неизвестен. */
  age: number | null;
  cooperative: string;
  chairman: string;
}

/** Переменная в тексте: `{{ Имя }}` — пробелы внутри скобок допустимы. */
const TOKEN = /\{\{\s*([^{}]+?)\s*\}\}/g;

/** Русское слово переменной из словаря: его председатель пишет в тексте. */
export function variableToken(variable: GreetingVariable): string {
  return t(`greetings.variables.${variable}.token`);
}

export function variableDescription(variable: GreetingVariable): string {
  return t(`greetings.variables.${variable}.description`);
}

/** Слово переменной → переменная; регистр не важен. */
function tokenIndex(): Map<string, GreetingVariable> {
  return new Map(Object.values(GreetingVariable).map((variable) => [variableToken(variable).toLowerCase(), variable]));
}

/** Неизвестные переменные текста — без повторов, в порядке появления. */
export function findUnknownVariables(text: string): string[] {
  const known = tokenIndex();
  const unknown: string[] = [];
  for (const match of text.matchAll(TOKEN)) {
    const word = match[1];
    if (!known.has(word.toLowerCase()) && !unknown.includes(word)) unknown.push(word);
  }
  return unknown;
}

export function greetingValues(subject: GreetingSubject): GreetingValues {
  const age = subject.age;
  return {
    [GreetingVariable.LAST_NAME]: subject.lastName,
    [GreetingVariable.FIRST_NAME]: subject.firstName,
    [GreetingVariable.MIDDLE_NAME]: subject.middleName,
    [GreetingVariable.ADDRESS]: [subject.firstName, subject.middleName].filter(Boolean).join(' '),
    [GreetingVariable.AGE]: age === null ? '' : t('greetings.letter.age', age),
    [GreetingVariable.ANNIVERSARY]: age === null ? '' : t('greetings.letter.anniversary', { n: age }),
    [GreetingVariable.COOPERATIVE]: subject.cooperative,
    [GreetingVariable.CHAIRMAN]: subject.chairman,
  };
}

const escapeHtml = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Подстановка значений; неизвестная переменная остаётся в тексте как есть. */
function substitute(text: string, values: GreetingValues, escape: (value: string) => string): string {
  const known = tokenIndex();
  return text.replace(TOKEN, (whole, word: string) => {
    const variable = known.get(word.toLowerCase());
    return variable ? escape(values[variable]) : whole;
  });
}

export interface GreetingLetter {
  subject: string;
  bodyHtml: string;
}

/** Письмо пайщику: тема — простой текст, тело — HTML из Markdown. */
export function buildGreetingLetter(template: { subject: string; body: string }, values: GreetingValues): GreetingLetter {
  return {
    subject: substitute(template.subject, values, (value) => value).trim(),
    // markdown-it экранирует фигурные скобки как обычный текст, поэтому
    // переменные переживают разбор и подставляются уже в готовый HTML.
    bodyHtml: substitute(markdown.render(template.body), values, escapeHtml),
  };
}
