import { WorkflowDefinition, type BaseWorkflowPayload } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { createEmailStep, createInAppStep } from '../../base/defaults';
import { z } from 'zod';
import { slugify } from '../../utils';

// Схема для new-device-login воркфлоу (CoopID Story 3.9)
export const newDeviceLoginPayloadSchema = z.object({
  /** Устройство входа человеческим языком («Chrome на macOS»), не сырой User-Agent. */
  device: z.string(),
  /** Гео входа («Москва, Россия» / «локальная сеть») либо пустая строка, если не определено. */
  location: z.string(),
  /** Готовая сводка для короткого текста: «Chrome на macOS · Москва, Россия». */
  summary: z.string(),
  /** IP-адрес входа. */
  ip: z.string(),
  /** Время входа (ISO-8601). */
  time: z.string(),
  /** Ссылка на защиту аккаунта (отзыв сессий + смена пароля). */
  securityUrl: z.string(),
  /** One-click ссылка «Это не я» — мгновенный отзыв всех сессий без входа (Story 3.10). */
  notMeUrl: z.string(),
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
      '<strong>Устройство:</strong> {{payload.summary}}<br>' +
      '<strong>IP-адрес:</strong> {{payload.ip}}<br>' +
      '<strong>Время:</strong> {{payload.time}}<br><br>' +
      'Если это были вы — ничего делать не нужно.<br>' +
      'Если нет — нажмите «Это не я», чтобы немедленно завершить все сессии: ' +
      '<a href="{{payload.notMeUrl}}">Это не я</a>.<br>' +
      'Управлять безопасностью аккаунта: ' +
      '<a href="{{payload.securityUrl}}">{{payload.securityUrl}}</a>.'
    ),
    createInAppStep(
      'new-device-login-notification',
      'Новый вход в ваш аккаунт',
      // Коротко и по-человечески: «Chrome на macOS · Москва». Нажатие на
      // уведомление ведёт к активным сессиям (deep-link собирает фронт по payload).
      'Вход с нового устройства: {{payload.summary}}. Если это не вы — завершите сессии в настройках безопасности.'
    ),
  ])
  .build();
