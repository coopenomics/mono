import { WorkflowDefinition, type BaseWorkflowPayload } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { createEmailStep, createInAppStep } from '../../base/defaults';
import { nt } from '../../i18n';
import { z } from 'zod';

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

export const name = nt('newDeviceLogin.name');
// Идентификатор закреплён: раньше он вычислялся из названия, и правка
// или перевод названия меняли бы его. Не менять — на него ссылаются подписки.
export const id = 'vkhods-novogo-ustroystva';

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .i18nKey('newDeviceLogin')
  .description(nt('newDeviceLogin.description'))
  .payloadSchema(newDeviceLoginPayloadSchema)
  .tags(['auth'])
  .addSteps([
    createEmailStep(
      'new-device-login-email',
      nt('newDeviceLogin.email.subject'),
      nt('newDeviceLogin.email.body')
    ),
    createInAppStep(
      'new-device-login-notification',
      nt('newDeviceLogin.inApp.subject'),
      // Коротко и по-человечески: «Chrome на macOS · Москва». Нажатие на
      // уведомление ведёт к активным сессиям (deep-link собирает фронт по payload).
      nt('newDeviceLogin.inApp.body')
    ),
  ])
  .build();
