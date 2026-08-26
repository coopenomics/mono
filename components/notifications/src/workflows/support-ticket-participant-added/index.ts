import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { z } from 'zod';
import { BaseWorkflowPayload } from '../../types';
import { createEmailStep, createInAppStep } from '../../base/defaults';
import { slugify } from '../../utils';

/**
 * Данные шаблона.
 *
 * **Это первое уведомление стола, которое идёт не автору обращения.** Адресат
 * здесь — подключённый член совета, а не пайщик, поэтому и тон другой: письмо
 * обращается к коллеге по совету, а не к заявителю.
 *
 * `participationId` в тексте письма не показывается — он нужен ключу
 * подавления повторов. Ключ считается как
 * `sha256(кооператив | тип | подписчик | канал | данные шаблона)`, а вставка в
 * очередь идёт с «пропустить при конфликте».
 *
 * **Почему именно идентификатор записи подключения, а не пара «обращение и
 * человек».** У повторного подключения того же человека к тому же обращению
 * номер, тема и ссылка совпадают полностью — и пара «обращение и человек» тоже
 * совпадает. Ключ получился бы прежним, и письмо о втором подключении молча не
 * ушло бы вовсе. А подключили → отключили → подключили снова — это два разных
 * события, и о втором человек обязан узнать: между ними он из обращения
 * выпадал и происходившее там не видел.
 *
 * Запись подключения при отключении удаляется физически, поэтому повторное
 * подключение заводит новую запись с новым идентификатором — ключ выходит
 * другой, и письмо доходит.
 *
 * Отметка времени в этой роли не годится: она нарушает обратное требование —
 * повтор того же события после сбоя доставки обязан давать тот же ключ, иначе
 * на одно событие уйдут два письма. Идентификатор записи удовлетворяет обоим
 * требованиям сразу: у разных событий он разный, у одного и того же — тот же.
 */
export const supportTicketParticipantAddedPayloadSchema = z.object({
  ticketNumber: z.string(),
  subject: z.string(),
  ticketUrl: z.string(),
  participationId: z.string(),
});

export type IPayload = z.infer<typeof supportTicketParticipantAddedPayloadSchema>;

export interface IWorkflow extends BaseWorkflowPayload, IPayload {}

export const name = 'Подключение к обращению в поддержку';
export const id = slugify(name);

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder.create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .description('Члена совета подключили к обращению пайщика в поддержку')
  .payloadSchema(supportTicketParticipantAddedPayloadSchema)
  .tags(['user'])
  .addSteps([
    createEmailStep(
      'support-ticket-participant-added-email',
      'Вас подключили к обращению № {{payload.ticketNumber}}',
      'Здравствуйте!<br><br>Вас подключили к обращению <strong>№ {{payload.ticketNumber}}</strong> в поддержку.<br><br>Тема обращения: {{payload.subject}}<br><br>Вы будете видеть это обращение в очереди и можете отвечать в нём наравне с ответственным.<br><br>Открыть обращение:<br><a href="{{payload.ticketUrl}}">{{payload.ticketUrl}}</a><br><br>С уважением, Совет кооператива.'
    ),
    createInAppStep(
      'support-ticket-participant-added-inapp',
      'Вас подключили к обращению № {{payload.ticketNumber}}',
      '{{payload.subject}}'
    ),
  ])
  .build();
