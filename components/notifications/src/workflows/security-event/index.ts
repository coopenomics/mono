import { WorkflowDefinition, type BaseWorkflowPayload } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { createEmailStep, createInAppStep } from '../../base/defaults';
import { nt } from '../../i18n';
import { z } from 'zod';

// Схема для security-event воркфлоу (CoopID Story 3.11)
export const securityEventPayloadSchema = z.object({
  /** Что произошло (человекочитаемый заголовок события). */
  event: z.string(),
  /** IP-адрес, с которого выполнено действие. */
  ip: z.string(),
  /** Время события (ISO-8601). */
  time: z.string(),
  /** Ссылка на защиту аккаунта (отзыв сессий + смена пароля). */
  securityUrl: z.string(),
});

export type IPayload = z.infer<typeof securityEventPayloadSchema>;

export interface IWorkflow extends BaseWorkflowPayload, IPayload {}

export const name = nt('securityEvent.name');
// Идентификатор закреплён: раньше он вычислялся из названия, и правка
// или перевод названия меняли бы его. Не менять — на него ссылаются подписки.
export const id = 'sobytie-bezopasnosti-akkaunta';

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .i18nKey('securityEvent')
  .description(nt('securityEvent.description'))
  .payloadSchema(securityEventPayloadSchema)
  .tags(['auth'])
  .addSteps([
    createEmailStep(
      'security-event-email',
      nt('securityEvent.email.subject'),
      nt('securityEvent.email.body')
    ),
    createInAppStep(
      'security-event-notification',
      nt('securityEvent.inApp.subject'),
      // Без сырого IP (в docker-сети он бессмыслен) и с понятным действием:
      // нажатие на уведомление ведёт в настройки безопасности (deep-link по
      // payload.securityUrl собирает фронт) — там сессии и смена пароля.
      nt('securityEvent.inApp.body')
    ),
  ])
  .build();
