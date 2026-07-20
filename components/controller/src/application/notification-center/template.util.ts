import { Workflows } from '@coopenomics/notifications';
import type { NotificationChannel } from '~/domain/notification/interfaces/notify-input.domain.interface';
import type { ChannelMessage } from '~/domain/notification/interfaces/channel.ports';

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
 * Подстановка `{{ path }}` из контекста сообщения. Путь — точечный
 * (`payload.userName`, `coopname`). Нерезолвленные плейсхолдеры → пустая строка.
 * Намеренно не Liquid: каталог использует mustache-стиль, отдельная зависимость
 * избыточна для MVP.
 */
export function renderTemplate(template: string | undefined, message: ChannelMessage): string {
  if (!template) return '';
  const context: Record<string, unknown> = {
    payload: message.payload ?? {},
    coopname: message.coopname,
    recipient: message.recipient,
  };
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, path: string) => {
    const value = resolvePath(context, path);
    return value == null ? '' : String(value);
  });
}

function resolvePath(root: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc != null && typeof acc === 'object') return (acc as Record<string, unknown>)[key];
    return undefined;
  }, root);
}
