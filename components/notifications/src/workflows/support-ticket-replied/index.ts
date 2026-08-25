import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { z } from 'zod';
import { BaseWorkflowPayload } from '../../types';
import { createEmailStep, createInAppStep } from '../../base/defaults';
import { slugify } from '../../utils';

/**
 * Данные шаблона.
 *
 * Имени ответившего здесь нет намеренно: автору обращения ответная сторона не
 * раскрывается, ответ идёт от лица совета (решение председателя от 18.08.2026).
 * Событие имя несёт, но нужно оно только слушателю — чтобы не отправить пайщику
 * письмо о его же собственной реплике.
 *
 * `messageId` в тексте письма не показывается и показываться не должен —
 * он нужен ключу подавления повторов. Ключ считается как
 * `sha256(кооператив | тип | подписчик | канал | данные шаблона)`, а вставка в
 * очередь идёт с «пропустить при конфликте». Без различителя данные двух разных
 * ответов на одно обращение совпали бы (номер, тема и ссылка у них одни и те
 * же), ключ получился бы тот же, и второе письмо молча не ушло бы вовсе.
 *
 * Отметка времени в этой роли не годится: она нарушает второе требование —
 * повтор того же события после сбоя доставки обязан давать тот же ключ, иначе
 * на одно событие уйдут два письма. Идентификатор записи ленты удовлетворяет
 * обоим требованиям сразу: у разных событий он разный, у одного и того же —
 * неизменный.
 *
 * Поэтому поле не лишнее. Убрать его — вернуть потерю уведомлений.
 */
export const supportTicketRepliedPayloadSchema = z.object({
  ticketNumber: z.string(),
  subject: z.string(),
  ticketUrl: z.string(),
  messageId: z.string(),
});

export type IPayload = z.infer<typeof supportTicketRepliedPayloadSchema>;

export interface IWorkflow extends BaseWorkflowPayload, IPayload {}

export const name = 'Ответ на обращение в поддержку';
export const id = slugify(name);

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder.create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .description('Совет кооператива ответил на обращение пайщика в поддержку')
  .payloadSchema(supportTicketRepliedPayloadSchema)
  .tags(['user'])
  .addSteps([
    createEmailStep(
      'support-ticket-replied-email',
      'Ответ на обращение № {{payload.ticketNumber}}: {{payload.subject}}',
      'Уважаемый пайщик!<br><br>В вашем обращении <strong>№ {{payload.ticketNumber}}</strong> появился ответ.<br><br>Тема обращения: {{payload.subject}}<br><br>Прочитать ответ и продолжить переписку:<br><a href="{{payload.ticketUrl}}">{{payload.ticketUrl}}</a><br><br>С уважением, Совет кооператива.'
    ),
    createInAppStep(
      'support-ticket-replied-inapp',
      'Ответ на обращение № {{payload.ticketNumber}}',
      '{{payload.subject}}'
    ),
  ])
  .build();
