import { WorkflowDefinition, type BaseWorkflowPayload } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { createEmailStep, createInAppStep } from '../../base/defaults';
import { nt } from '../../i18n';
import { z } from 'zod';

/**
 * Поздравление пайщика с днём рождения от приложения «Поздравления».
 *
 * Текст письма пишет председатель кооператива в шаблоне приложения, поэтому
 * приложение передаёт в данных готовые тему и тело: оно подставило
 * переменные и превратило Markdown в очищенный HTML. Шаг письма только
 * выводит их — Liquid к тексту председателя не применяется.
 */
export const birthdayGreetingPayloadSchema = z.object({
  /** Тема письма с подставленными переменными. */
  subject: z.string(),
  /** Тело письма: очищенный HTML. */
  bodyHtml: z.string(),
  /** Краткое название кооператива — для уведомления в интерфейсе. */
  coopShortName: z.string(),
  /**
   * Повод письма: `birthday:2026`, `test:<момент>`. В текст не выводится.
   * Центр уведомлений отбрасывает повтор с теми же данными, и без повода
   * письмо следующего года с тем же текстом не дошло бы до пайщика.
   */
  occasion: z.string(),
});

export type IPayload = z.infer<typeof birthdayGreetingPayloadSchema>;

export interface IWorkflow extends BaseWorkflowPayload, IPayload {}

export const name = nt('birthdayGreeting.name');
// Идентификатор закреплён: на него ссылаются подписки и журнал уведомлений. Не менять.
export const id = 'pozdravlenie-s-dnem-rozhdeniya';

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder.create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .i18nKey('birthdayGreeting')
  .description(nt('birthdayGreeting.description'))
  .payloadSchema(birthdayGreetingPayloadSchema)
  .tags(['user'])
  .addSteps([
    createEmailStep('birthday-greeting-email', nt('birthdayGreeting.email.subject'), nt('birthdayGreeting.email.body')),
    createInAppStep('birthday-greeting-inapp', nt('birthdayGreeting.inApp.subject'), nt('birthdayGreeting.inApp.body')),
  ])
  .build();
