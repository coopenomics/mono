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
import { workflow as newDeviceLoginWorkflow } from './new-device-login';
import { workflow as loginEmailCodeWorkflow } from './login-email-code';
import { workflow as securityEventWorkflow } from './security-event';
import { workflow as inviteWorkflow } from './invite';
import { workflow as emailVerificationWorkflow } from './email-verification';
import { workflow as membershipExitConfirmationWorkflow } from './membership-exit-confirmation';
import { workflow as serverProvisionedWorkflow } from './server-provisioned';
import { workflow as decisionExpiredWorkflow } from './decision-expired';
import { workflow as endorsementExpiringWorkflow } from './endorsement-expiring';
import { workflow as chatcoopCalendarEventCreatedWorkflow } from './chatcoop-calendar-event-created';
import { workflow as chatcoopCalendarEventUpdatedWorkflow } from './chatcoop-calendar-event-updated';
import { workflow as marketplaceAplSupplierSignRequestWorkflow } from './marketplace-apl-supplier-sign-request';
import { workflow as marketplaceAplReceptionCancelledBySupplierWorkflow } from './marketplace-apl-reception-cancelled-by-supplier';
import { workflow as marketplaceCashierNewPaymentWorkflow } from './marketplace-cashier-new-payment';
import { workflow as marketplaceSupplierPaymentConfirmedWorkflow } from './marketplace-supplier-payment-confirmed';
import { workflow as marketplaceSupplierPaymentDeclinedWorkflow } from './marketplace-supplier-payment-declined';
import { workflow as marketplaceOrderReadyWorkflow } from './marketplace-order-ready';
import { workflow as marketplaceReturnClaimSubmittedWorkflow } from './marketplace-return-claim-submitted';
import { workflow as marketplaceReturnClaimDecidedWorkflow } from './marketplace-return-claim-decided';
import { workflow as marketplaceReturnClaimFinalizedWorkflow } from './marketplace-return-claim-finalized';
import { workflow as marketplaceWriteoffDraftBuiltWorkflow } from './marketplace-writeoff-draft-built';
import { workflow as marketplaceWriteoffProposedWorkflow } from './marketplace-writeoff-proposed';
import { workflow as marketplaceWriteoffAuthorizedWorkflow } from './marketplace-writeoff-authorized';
import { workflow as marketplaceWriteoffExecutedWorkflow } from './marketplace-writeoff-executed';
import { workflow as marketplaceWriteoffRejectedWorkflow } from './marketplace-writeoff-rejected';
import { workflow as marketplaceNewOrderForSupplierWorkflow } from './marketplace-new-order-for-supplier';
import { workflow as marketplaceReturnAcceptedSupplierWorkflow } from './marketplace-return-accepted-supplier';
import { workflow as marketplaceOrderDeclinedBySupplierWorkflow } from './marketplace-order-declined-by-supplier';
import { workflow as marketplaceNewSupplierRequestWorkflow } from './marketplace-new-supplier-request';
import { workflow as marketplaceOfferOnModerationWorkflow } from './marketplace-offer-on-moderation';
import { workflow as marketplaceOfferApprovedWorkflow } from './marketplace-offer-approved';
import { workflow as marketplaceOfferRejectedWorkflow } from './marketplace-offer-rejected';
import { workflow as marketplaceSupplierApprovedWorkflow } from './marketplace-supplier-approved';
import { workflow as marketplaceAidPayoutConfirmedWorkflow } from './marketplace-aid-payout-confirmed';
import { workflow as marketplaceAidCouncilDecidedWorkflow } from './marketplace-aid-council-decided';
import { workflow as branchVotingStartedWorkflow } from './branch-voting-started';
import { workflow as branchMeetingReminderWorkflow } from './branch-meeting-reminder';
import { workflow as branchTrustedRequestedWorkflow } from './branch-trusted-requested';
import { workflow as branchTrustedResolvedWorkflow } from './branch-trusted-resolved';
import { workflow as expenseAdvanceReportReminderWorkflow } from './expense-advance-report-reminder';
import { workflow as capitalRoleRequestedWorkflow } from './capital-role-requested';
import { workflow as capitalRoleApprovedWorkflow } from './capital-role-approved';
import { workflow as capitalRoleDeclinedWorkflow } from './capital-role-declined';
import { workflow as capitalRoleInvitedWorkflow } from './capital-role-invited';
import { workflow as capitalRoleInviteAnsweredWorkflow } from './capital-role-invite-answered';
import { workflow as capitalDebtDueSoonWorkflow } from './capital-debt-due-soon';
import { workflow as capitalDebtOverdueWorkflow } from './capital-debt-overdue';
import { workflow as capitalDebtPaymentDeclinedWorkflow } from './capital-debt-payment-declined';

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
export * as NewDeviceLogin from './new-device-login';
export * as LoginEmailCode from './login-email-code';
export * as SecurityEvent from './security-event';
export * as Invite from './invite';
export * as EmailVerification from './email-verification';
export * as MembershipExitConfirmation from './membership-exit-confirmation';
export * as ServerProvisioned from './server-provisioned';
export * as DecisionExpired from './decision-expired';
export * as EndorsementExpiring from './endorsement-expiring';
export * as ChatCoopCalendarEventCreated from './chatcoop-calendar-event-created';
export * as ChatCoopCalendarEventUpdated from './chatcoop-calendar-event-updated';
export * as MarketplaceAplSupplierSignRequest from './marketplace-apl-supplier-sign-request';
export * as MarketplaceAplReceptionCancelledBySupplier from './marketplace-apl-reception-cancelled-by-supplier';
export * as MarketplaceCashierNewPayment from './marketplace-cashier-new-payment';
export * as MarketplaceSupplierPaymentConfirmed from './marketplace-supplier-payment-confirmed';
export * as MarketplaceSupplierPaymentDeclined from './marketplace-supplier-payment-declined';
export * as MarketplaceOrderReady from './marketplace-order-ready';
export * as MarketplaceReturnClaimSubmitted from './marketplace-return-claim-submitted';
export * as MarketplaceReturnClaimDecided from './marketplace-return-claim-decided';
export * as MarketplaceReturnClaimFinalized from './marketplace-return-claim-finalized';
export * as MarketplaceWriteoffDraftBuilt from './marketplace-writeoff-draft-built';
export * as MarketplaceWriteoffProposed from './marketplace-writeoff-proposed';
export * as MarketplaceWriteoffAuthorized from './marketplace-writeoff-authorized';
export * as MarketplaceWriteoffExecuted from './marketplace-writeoff-executed';
export * as MarketplaceWriteoffRejected from './marketplace-writeoff-rejected';
export * as MarketplaceNewOrderForSupplier from './marketplace-new-order-for-supplier';
export * as MarketplaceReturnAcceptedSupplier from './marketplace-return-accepted-supplier';
export * as MarketplaceOrderDeclinedBySupplier from './marketplace-order-declined-by-supplier';
export * as MarketplaceNewSupplierRequest from './marketplace-new-supplier-request';
export * as MarketplaceOfferOnModeration from './marketplace-offer-on-moderation';
export * as MarketplaceOfferApproved from './marketplace-offer-approved';
export * as MarketplaceOfferRejected from './marketplace-offer-rejected';
export * as MarketplaceSupplierApproved from './marketplace-supplier-approved';
export * as MarketplaceAidPayoutConfirmed from './marketplace-aid-payout-confirmed';
export * as MarketplaceAidCouncilDecided from './marketplace-aid-council-decided';
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
  newDeviceLoginWorkflow,
  loginEmailCodeWorkflow,
  securityEventWorkflow,
  inviteWorkflow,
  emailVerificationWorkflow,
  membershipExitConfirmationWorkflow,
  serverProvisionedWorkflow,
  decisionExpiredWorkflow,
  endorsementExpiringWorkflow,
  chatcoopCalendarEventCreatedWorkflow,
  chatcoopCalendarEventUpdatedWorkflow,
  marketplaceAplSupplierSignRequestWorkflow,
  marketplaceAplReceptionCancelledBySupplierWorkflow,
  marketplaceCashierNewPaymentWorkflow,
  marketplaceSupplierPaymentConfirmedWorkflow,
  marketplaceSupplierPaymentDeclinedWorkflow,
  marketplaceOrderReadyWorkflow,
  marketplaceReturnClaimSubmittedWorkflow,
  marketplaceReturnClaimDecidedWorkflow,
  marketplaceReturnClaimFinalizedWorkflow,
  marketplaceWriteoffDraftBuiltWorkflow,
  marketplaceWriteoffProposedWorkflow,
  marketplaceWriteoffAuthorizedWorkflow,
  marketplaceWriteoffExecutedWorkflow,
  marketplaceWriteoffRejectedWorkflow,
  marketplaceNewOrderForSupplierWorkflow,
  marketplaceReturnAcceptedSupplierWorkflow,
  marketplaceOrderDeclinedBySupplierWorkflow,
  marketplaceNewSupplierRequestWorkflow,
  marketplaceOfferOnModerationWorkflow,
  marketplaceOfferApprovedWorkflow,
  marketplaceOfferRejectedWorkflow,
  marketplaceSupplierApprovedWorkflow,
  marketplaceAidPayoutConfirmedWorkflow,
  marketplaceAidCouncilDecidedWorkflow,
  branchVotingStartedWorkflow,
  branchMeetingReminderWorkflow,
  branchTrustedRequestedWorkflow,
  branchTrustedResolvedWorkflow,
  expenseAdvanceReportReminderWorkflow,
  capitalRoleRequestedWorkflow,
  capitalRoleApprovedWorkflow,
  capitalRoleDeclinedWorkflow,
  capitalRoleInvitedWorkflow,
  capitalRoleInviteAnsweredWorkflow,
  capitalDebtDueSoonWorkflow,
  capitalDebtOverdueWorkflow,
  capitalDebtPaymentDeclinedWorkflow,
];

// Экспортируем воркфлоу по ID для удобного доступа
export const workflowsById = allWorkflows.reduce((acc, workflow) => {
  acc[workflow.workflowId] = workflow;
  return acc;
}, {} as Record<string, WorkflowDefinition>);
export * as BranchVotingStarted from './branch-voting-started';
export * as BranchMeetingReminder from './branch-meeting-reminder';
export * as BranchTrustedRequested from './branch-trusted-requested';
export * as BranchTrustedResolved from './branch-trusted-resolved';
export * as CapitalRoleRequested from './capital-role-requested';
export * as CapitalRoleApproved from './capital-role-approved';
export * as CapitalRoleDeclined from './capital-role-declined';
export * as CapitalRoleInvited from './capital-role-invited';
export * as CapitalRoleInviteAnswered from './capital-role-invite-answered';
export * as CapitalDebtDueSoon from './capital-debt-due-soon';
export * as CapitalDebtOverdue from './capital-debt-overdue';
export * as CapitalDebtPaymentDeclined from './capital-debt-payment-declined';
