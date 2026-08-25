import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { z } from 'zod';
import { BaseWorkflowPayload } from '../../types';
import { createEmailStep, createInAppStep } from '../../base/defaults';
import { slugify } from '../../utils';

/**
 * Данные шаблона.
 *
 * `status` и `statusLabel` — одно и то же значение в двух видах: первое для
 * ветвления в шаблоне, второе для показа. Текст письма обязан различаться:
 * «решено» — это приглашение возразить, «закрыто» — сообщение о том, что
 * разговор завершён, и одной общей фразой они не покрываются.
 *
 * `messageId` в тексте письма не показывается и показываться не должен —
 * он нужен ключу подавления повторов. Ключ считается как
 * `sha256(кооператив | тип | подписчик | канал | данные шаблона)`, а вставка в
 * очередь идёт с «пропустить при конфликте». Без различителя обращение,
 * решённое, затем возвращённое в работу и решённое снова, дало бы во второй раз
 * те же данные шаблона — и письмо о повторном решении молча не ушло бы.
 *
 * Отметка времени в этой роли не годится: повтор того же события после сбоя
 * доставки обязан давать тот же ключ, иначе на одно событие уйдут два письма.
 * Идентификатор записи ленты удовлетворяет обоим требованиям сразу: у разных
 * событий он разный, у одного и того же — неизменный.
 *
 * Поэтому поле не лишнее. Убрать его — вернуть потерю уведомлений.
 */
export const supportTicketStatusChangedPayloadSchema = z.object({
  ticketNumber: z.string(),
  subject: z.string(),
  status: z.string(),
  statusLabel: z.string(),
  ticketUrl: z.string(),
  messageId: z.string(),
});

export type IPayload = z.infer<typeof supportTicketStatusChangedPayloadSchema>;

export interface IWorkflow extends BaseWorkflowPayload, IPayload {}

export const name = 'Изменение статуса обращения в поддержку';
export const id = slugify(name);

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder.create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .description('Статус обращения пайщика в поддержку изменился')
  .payloadSchema(supportTicketStatusChangedPayloadSchema)
  .tags(['user'])
  .addSteps([
    createEmailStep(
      'support-ticket-status-changed-email',
      'Обращение № {{payload.ticketNumber}}: {{payload.statusLabel}}',
      'Уважаемый пайщик!<br><br>Статус вашего обращения <strong>№ {{payload.ticketNumber}}</strong> изменился: {{payload.statusLabel}}.<br><br>Тема обращения: {{payload.subject}}{% if payload.status == "RESOLVED" %}<br><br>Совет считает вопрос решённым. Если это не так — просто ответьте в обращении, и оно вернётся в работу. Иначе обращение закроется автоматически.{% endif %}{% if payload.status == "CLOSED" %}<br><br>Обращение закрыто автоматически, потому что возражений не поступило. Если вопрос возник снова — напишите в этом же обращении, и оно откроется заново.{% endif %}<br><br>Открыть обращение:<br><a href="{{payload.ticketUrl}}">{{payload.ticketUrl}}</a><br><br>С уважением, Совет кооператива.'
    ),
    createInAppStep(
      'support-ticket-status-changed-inapp',
      'Обращение № {{payload.ticketNumber}}: {{payload.statusLabel}}',
      '{{payload.subject}}'
    ),
  ])
  .build();
