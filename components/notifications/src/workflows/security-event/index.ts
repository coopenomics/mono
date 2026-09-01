import { WorkflowDefinition, type BaseWorkflowPayload } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { createEmailStep, createInAppStep } from '../../base/defaults';
import { z } from 'zod';
import { slugify } from '../../utils';

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

export const name = 'Событие безопасности аккаунта';
export const id = slugify(name);

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .description('Уведомление о критичном изменении в безопасности аккаунта (2FA, способ восстановления, пароль, ключ)')
  .payloadSchema(securityEventPayloadSchema)
  .tags(['auth'])
  .addSteps([
    createEmailStep(
      'security-event-email',
      'Изменение в безопасности вашего аккаунта',
      'В вашем аккаунте зафиксировано изменение в настройках безопасности:<br><br>' +
      '<strong>{{payload.event}}</strong><br>' +
      '<strong>IP-адрес:</strong> {{payload.ip}}<br>' +
      '<strong>Время:</strong> {{payload.time}}<br><br>' +
      'Если это сделали вы — ничего делать не нужно.<br>' +
      'Если нет — немедленно защитите аккаунт: ' +
      '<a href="{{payload.securityUrl}}">{{payload.securityUrl}}</a> ' +
      '(отзыв активных сессий и смена пароля).'
    ),
    createInAppStep(
      'security-event-notification',
      'Событие безопасности',
      // Без сырого IP (в docker-сети он бессмыслен) и с понятным действием:
      // нажатие на уведомление ведёт в настройки безопасности (deep-link по
      // payload.securityUrl собирает фронт) — там сессии и смена пароля.
      '{{payload.event}}. Если это сделали не вы — откройте настройки безопасности, завершите сессии и смените пароль.'
    ),
  ])
  .build();
