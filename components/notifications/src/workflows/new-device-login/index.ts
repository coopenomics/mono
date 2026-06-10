import { WorkflowDefinition, type BaseWorkflowPayload } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { createEmailStep, createInAppStep } from '../../base/defaults';
import { z } from 'zod';
import { slugify } from '../../utils';

// Схема для new-device-login воркфлоу (CoopID Story 3.9)
export const newDeviceLoginPayloadSchema = z.object({
  /** Устройство входа (User-Agent либо «неизвестное устройство»). */
  device: z.string(),
  /** IP-адрес входа. */
  ip: z.string(),
  /** Время входа (ISO-8601). */
  time: z.string(),
  /** Ссылка на защиту аккаунта (отзыв сессий + смена пароля). */
  securityUrl: z.string(),
});

export type IPayload = z.infer<typeof newDeviceLoginPayloadSchema>;

export interface IWorkflow extends BaseWorkflowPayload, IPayload {}

export const name = 'Вход с нового устройства';
export const id = slugify(name);

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .description('Уведомление о входе в аккаунт с устройства, которое ранее не использовалось')
  .payloadSchema(newDeviceLoginPayloadSchema)
  .tags(['auth'])
  .addSteps([
    createEmailStep(
      'new-device-login-email',
      'Новый вход в ваш аккаунт',
      'Зафиксирован вход в ваш аккаунт с устройства, которое ранее не использовалось:<br><br>' +
      '<strong>Устройство:</strong> {{payload.device}}<br>' +
      '<strong>IP-адрес:</strong> {{payload.ip}}<br>' +
      '<strong>Время:</strong> {{payload.time}}<br><br>' +
      'Если это были вы — ничего делать не нужно.<br>' +
      'Если нет — немедленно защитите аккаунт: ' +
      '<a href="{{payload.securityUrl}}">{{payload.securityUrl}}</a> ' +
      '(отзыв активных сессий и смена пароля).'
    ),
    createInAppStep(
      'new-device-login-notification',
      'Новый вход в ваш аккаунт',
      'Вход с нового устройства ({{payload.device}}, {{payload.ip}}). Это вы?'
    ),
  ])
  .build();
