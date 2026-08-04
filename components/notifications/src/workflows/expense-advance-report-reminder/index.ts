import { z } from 'zod';
import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { createEmailStep, createInAppStep } from '../../base/defaults';
import { BaseWorkflowPayload } from '../../types';
import { slugify } from '../../utils';

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

export const name = 'Напоминание об отчёте по авансу';
export const id = slugify(name);

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .description('Еженедельное напоминание пайщику предоставить отчёт по выданному авансу под отчёт')
  .payloadSchema(expenseAdvanceReportReminderPayloadSchema)
  .tags(['expense', 'financial'])
  .addSteps([
    createEmailStep(
      'expense-advance-report-reminder-email',
      'Ожидается отчёт по авансу под отчёт — {{payload.coopName}}',
      'Уважаемый пайщик!<br><br>' +
        'По {% if payload.count > 1 %}следующим авансам под отчёт{% else %}авансу под отчёт{% endif %}, ' +
        'полученным в кооперативе «{{payload.coopName}}», ещё не предоставлен отчёт:<br><br>' +
        '{% for advance in payload.advances %}• {{advance.description}} — {{advance.amount}} — ' +
        '<a href="{{advance.url}}">открыть расход</a><br>{% endfor %}' +
        '<br>Пожалуйста, приложите подтверждающие документы (чек, акт) на странице расхода в личном ' +
        'кабинете — после этого отчёт будет подан автоматически.<br><br>' +
        '<a href="{{payload.link}}">Перейти к моим авансам</a>'
    ),
    createInAppStep(
      'expense-advance-report-reminder-inapp',
      'Ожидается отчёт по авансу под отчёт',
      'По вашим авансам под отчёт ещё не предоставлен отчёт. Приложите подтверждающие документы в личном кабинете.'
    ),
  ])
  .build();
