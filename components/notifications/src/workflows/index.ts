import { WorkflowDefinition } from '../types';
// Импорты воркфлоу для регистрации
import { workflow as welcomeWorkflow } from './welcome';
import { workflow as newAgendaItemWorkflow } from './new-agenda-item';
import { workflow as incomingTransferWorkflow } from './incoming-transfer';
import { workflow as approvalRequestWorkflow } from './approval-request';
import { workflow as decisionApprovedWorkflow } from './decision-approved';
import { workflow as paymentPaidWorkflow } from './payment-paid';
import { workflow as paymentCancelledWorkflow } from './payment-cancelled';
import { workflow as meetInitialWorkflow } from './meet-initial';
import { workflow as meetReminderStartWorkflow } from './meet-reminder-start';
import { workflow as meetStartedWorkflow } from './meet-started';
import { workflow as meetReminderEndWorkflow } from './meet-reminder-end';
import { workflow as meetRestartWorkflow } from './meet-restart';
import { workflow as meetEndedWorkflow } from './meet-ended';
import { workflow as approvalResponseWorkflow } from './approval-response';
import { workflow as newInitialPaymentRequestWorkflow } from './new-initial-payment-request';
import { workflow as newDepositPaymentRequestWorkflow } from './new-deposit-payment-request';
import { workflow as resetKeyWorkflow } from './reset-key';
import { workflow as inviteWorkflow } from './invite';
import { workflow as emailVerificationWorkflow } from './email-verification';
import { workflow as serverProvisionedWorkflow } from './server-provisioned';
import { workflow as decisionExpiredWorkflow } from './decision-expired';
import { workflow as chatcoopCalendarEventCreatedWorkflow } from './chatcoop-calendar-event-created';
import { workflow as chatcoopCalendarEventUpdatedWorkflow } from './chatcoop-calendar-event-updated';

// Capital (Благорост)
import { workflow as capitalProgramExpenseApprovalRequestWorkflow } from './capital-program-expense-approval-request';
import { workflow as capitalProgramExpenseApprovedWorkflow } from './capital-program-expense-approved';
import { workflow as capitalProgramExpenseAuthorizedWorkflow } from './capital-program-expense-authorized';
import { workflow as capitalProgramExpensePaidWorkflow } from './capital-program-expense-paid';
import { workflow as capitalProgramExpenseDeclinedWorkflow } from './capital-program-expense-declined';
import { workflow as capitalDebtDueSoonWorkflow } from './capital-debt-due-soon';
import { workflow as capitalDebtOverdueWorkflow } from './capital-debt-overdue';
import { workflow as capitalRoleRequestedWorkflow } from './capital-role-requested';
import { workflow as capitalRoleApprovedWorkflow } from './capital-role-approved';

// Импортируем все воркфлоу
export * as Welcome from './welcome';
export * as NewAgenda from './new-agenda-item';
export * as NewTransfer from './incoming-transfer';
export * as ApprovalRequest from './approval-request';
export * as DecisionApproved from './decision-approved';
export * as PaymentPaid from './payment-paid';
export * as PaymentCancelled from './payment-cancelled';
export * as MeetInitial from './meet-initial';
export * as MeetReminderStart from './meet-reminder-start';
export * as MeetStarted from './meet-started';
export * as MeetReminderEnd from './meet-reminder-end';
export * as MeetRestart from './meet-restart';
export * as MeetEnded from './meet-ended';
export * as ApprovalResponse from './approval-response';
export * as NewInitialPaymentRequest from './new-initial-payment-request';
export * as NewDepositPaymentRequest from './new-deposit-payment-request';
export * as ResetKey from './reset-key';
export * as Invite from './invite';
export * as EmailVerification from './email-verification';
export * as ServerProvisioned from './server-provisioned';
export * as DecisionExpired from './decision-expired';
export * as ChatCoopCalendarEventCreated from './chatcoop-calendar-event-created';
export * as ChatCoopCalendarEventUpdated from './chatcoop-calendar-event-updated';

export * as CapitalProgramExpenseApprovalRequest from './capital-program-expense-approval-request';
export * as CapitalProgramExpenseApproved from './capital-program-expense-approved';
export * as CapitalProgramExpenseAuthorized from './capital-program-expense-authorized';
export * as CapitalProgramExpensePaid from './capital-program-expense-paid';
export * as CapitalProgramExpenseDeclined from './capital-program-expense-declined';
export * as CapitalDebtDueSoon from './capital-debt-due-soon';
export * as CapitalDebtOverdue from './capital-debt-overdue';
export * as CapitalRoleRequested from './capital-role-requested';
export * as CapitalRoleApproved from './capital-role-approved';

// Массив всех воркфлоу для автоматической регистрации
export const allWorkflows: WorkflowDefinition[] = [
  welcomeWorkflow,
  newAgendaItemWorkflow,
  incomingTransferWorkflow,
  approvalRequestWorkflow,
  decisionApprovedWorkflow,
  paymentPaidWorkflow,
  paymentCancelledWorkflow,
  meetInitialWorkflow,
  meetReminderStartWorkflow,
  meetStartedWorkflow,
  meetReminderEndWorkflow,
  meetRestartWorkflow,
  meetEndedWorkflow,
  approvalResponseWorkflow,
  newInitialPaymentRequestWorkflow,
  newDepositPaymentRequestWorkflow,
  resetKeyWorkflow,
  inviteWorkflow,
  emailVerificationWorkflow,
  serverProvisionedWorkflow,
  decisionExpiredWorkflow,
  chatcoopCalendarEventCreatedWorkflow,
  chatcoopCalendarEventUpdatedWorkflow,
  capitalProgramExpenseApprovalRequestWorkflow,
  capitalProgramExpenseApprovedWorkflow,
  capitalProgramExpenseAuthorizedWorkflow,
  capitalProgramExpensePaidWorkflow,
  capitalProgramExpenseDeclinedWorkflow,
  capitalDebtDueSoonWorkflow,
  capitalDebtOverdueWorkflow,
  capitalRoleRequestedWorkflow,
  capitalRoleApprovedWorkflow,
];

// Экспортируем воркфлоу по ID для удобного доступа
export const workflowsById = allWorkflows.reduce((acc, workflow) => {
  acc[workflow.workflowId] = workflow;
  return acc;
}, {} as Record<string, WorkflowDefinition>);
