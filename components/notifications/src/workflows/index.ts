import { WorkflowDefinition } from '../types';
// Импорты воркфлоу для регистрации
import { workflow as welcomeWorkflow } from './welcome';
import { workflow as newAgendaItemWorkflow } from './new-agenda-item';
import { workflow as incomingTransferWorkflow } from './incoming-transfer';
import { workflow as approvalRequestWorkflow } from './approval-request';
import { workflow as decisionApprovedWorkflow } from './decision-approved';
import { workflow as paymentPaidWorkflow } from './payment-paid';
import { workflow as paymentCancelledWorkflow } from './payment-cancelled';
import { workflow as paymentRefundedWorkflow } from './payment-refunded';
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
import { workflow as membershipExitConfirmationWorkflow } from './membership-exit-confirmation';
import { workflow as serverProvisionedWorkflow } from './server-provisioned';
import { workflow as decisionExpiredWorkflow } from './decision-expired';
import { workflow as chatcoopCalendarEventCreatedWorkflow } from './chatcoop-calendar-event-created';
import { workflow as chatcoopCalendarEventUpdatedWorkflow } from './chatcoop-calendar-event-updated';
import { workflow as expenseAdvanceReportReminderWorkflow } from './expense-advance-report-reminder';

// Импортируем все воркфлоу
export * as Welcome from './welcome';
export * as NewAgenda from './new-agenda-item';
export * as NewTransfer from './incoming-transfer';
export * as ApprovalRequest from './approval-request';
export * as DecisionApproved from './decision-approved';
export * as PaymentPaid from './payment-paid';
export * as PaymentCancelled from './payment-cancelled';
export * as PaymentRefunded from './payment-refunded';
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
export * as MembershipExitConfirmation from './membership-exit-confirmation';
export * as ServerProvisioned from './server-provisioned';
export * as DecisionExpired from './decision-expired';
export * as ChatCoopCalendarEventCreated from './chatcoop-calendar-event-created';
export * as ChatCoopCalendarEventUpdated from './chatcoop-calendar-event-updated';
export * as ExpenseAdvanceReportReminder from './expense-advance-report-reminder';

// Массив всех воркфлоу для автоматической регистрации
export const allWorkflows: WorkflowDefinition[] = [
  welcomeWorkflow,
  newAgendaItemWorkflow,
  incomingTransferWorkflow,
  approvalRequestWorkflow,
  decisionApprovedWorkflow,
  paymentPaidWorkflow,
  paymentCancelledWorkflow,
  paymentRefundedWorkflow,
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
  membershipExitConfirmationWorkflow,
  serverProvisionedWorkflow,
  decisionExpiredWorkflow,
  chatcoopCalendarEventCreatedWorkflow,
  chatcoopCalendarEventUpdatedWorkflow,
  expenseAdvanceReportReminderWorkflow,
];

// Экспортируем воркфлоу по ID для удобного доступа
export const workflowsById = allWorkflows.reduce((acc, workflow) => {
  acc[workflow.workflowId] = workflow;
  return acc;
}, {} as Record<string, WorkflowDefinition>);
