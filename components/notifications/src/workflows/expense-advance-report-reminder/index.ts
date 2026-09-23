import { z } from 'zod';
import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { createEmailStep, createInAppStep } from '../../base/defaults';
import { nt } from '../../i18n';
import { BaseWorkflowPayload } from '../../types';

// Одна строка-аванс в дайджесте напоминания.
const advanceItemSchema = z.object({
  description: z.string(), // Назначение расхода (item.description)
  amount: z.string(), // Сумма выданного аванса (asset-строка)
  url: z.string(), // Прямая ссылка на страницу этого расхода
});

// Напоминание пайщику отчитаться по выданным авансам под отчёт.
// `period` — техническое поле (ISO-неделя): входит в payload, чтобы
// идемпотентность Центра уведомлений гасила повторы в пределах недели и
// пропускала ровно одно письмо на следующей неделе. В шаблоне не рендерится.
export const expenseAdvanceReportReminderPayloadSchema = z.object({
  coopName: z.string(),
  period: z.string(),
  count: z.number(),
  link: z.string(), // Основная CTA-ссылка (на сам расход, если он один, иначе на личную страницу «Платежи»)
  advances: z.array(advanceItemSchema),
});
export type IPayload = z.infer<typeof expenseAdvanceReportReminderPayloadSchema>;
export interface IWorkflow extends BaseWorkflowPayload, IPayload {}

export const name = nt('expenseAdvanceReportReminder.name');
// Идентификатор закреплён: раньше он вычислялся из названия, и правка
// или перевод названия меняли бы его. Не менять — на него ссылаются подписки.
export const id = 'napominanie-ob-otchyote-po-avansu';

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .i18nKey('expenseAdvanceReportReminder')
  .description(nt('expenseAdvanceReportReminder.description'))
  .payloadSchema(expenseAdvanceReportReminderPayloadSchema)
  .tags(['expense', 'financial'])
  .addSteps([
    createEmailStep(
      'expense-advance-report-reminder-email',
      nt('expenseAdvanceReportReminder.email.subject'),
      nt('expenseAdvanceReportReminder.email.body')
    ),
    createInAppStep(
      'expense-advance-report-reminder-inapp',
      nt('expenseAdvanceReportReminder.inApp.subject'),
      nt('expenseAdvanceReportReminder.inApp.body')
    ),
  ])
  .build();
