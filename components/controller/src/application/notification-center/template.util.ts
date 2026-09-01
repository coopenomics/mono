import { Logger } from '@nestjs/common';
import { Workflows } from '@coopenomics/notifications';
import { Liquid } from 'liquidjs';
import type { ChannelMessage } from '~/domain/notification/interfaces/channel.ports';
import { NotificationChannel } from '~/domain/notification/interfaces/notify-input.domain.interface';

const logger = new Logger('NotificationTemplate');

/** Тексты шаблона канала из каталога. */
export interface ResolvedTemplate {
  subject?: string;
  body?: string;
}

/**
 * Шаблоны типа уведомления берём из каталога `@coopenomics/notifications`:
 * у workflow есть `steps[]`, у шага канала — `controlValues.{subject,body}`.
 * i18n отложен — тексты используются как есть (русские).
 */
export function resolveTemplate(workflowId: string, channel: NotificationChannel): ResolvedTemplate | null {
  const definition = Workflows.workflowsById[workflowId];
  if (!definition) return null;
  const step = definition.steps.find((s) => s.type === channel);
  if (!step) return null;
  return { subject: step.controlValues.subject, body: step.controlValues.body };
}

/**
 * Движок шаблонов каталога — Liquid: помимо подстановок `{{ path }}` шаблоны
 * используют условия и циклы (`{% if %}`, `{% for %}`), см. CLAUDE.md пакета
 * `@coopenomics/notifications`.
 *
 * `outputEscape` не включаем: тела писем — готовый HTML, экранирование сломало бы
 * вёрстку. `strictVariables`/`strictFilters` выключены, поэтому нерезолвленный путь
 * даёт пустую строку — как и раньше.
 */
const liquid = new Liquid({ strictVariables: false, strictFilters: false });

/**
 * Подстановка значений в шаблон канала из контекста сообщения. Пути точечные
 * (`payload.userName`, `coopname`), нерезолвленные → пустая строка.
 *
 * Раньше здесь была regex-подстановка только `{{ path }}`, и теги `{% if %}` уезжали
 * в письмо буквально («Примите участие в голосовании{% if payload.details %}…»).
 * Заметно это было не на всех типах: страдали только шаблоны с условиями
 * (инцидент 2026-08-27).
 */
export function renderTemplate(template: string | undefined, message: ChannelMessage): string {
  if (!template) return '';
  const context: Record<string, unknown> = {
    payload: message.payload ?? {},
    coopname: message.coopname,
    recipient: message.recipient,
  };
  try {
    return liquid.parseAndRenderSync(template, context);
  } catch (error: unknown) {
    // Уведомление важнее вёрстки: при сломанном шаблоне отдаём хотя бы подстановки,
    // иначе получатель не узнает о собрании вовсе.
    logger.error(
      `Ошибка разбора шаблона уведомления: ${error instanceof Error ? error.message : String(error)}`
    );
    return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, path: string) => {
      const value = resolvePath(context, path);
      return value == null ? '' : String(value);
    });
  }
}

function resolvePath(root: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc != null && typeof acc === 'object') return (acc as Record<string, unknown>)[key];
    return undefined;
  }, root);
}
