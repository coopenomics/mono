/**
 * `core-ports/` — контракты, которые ПРЕДОСТАВЛЯЕТ ядро, а потребляют расширения.
 * Адаптер живёт в ядре, регистрация — в `InnercoopBridgeModule` (ADR-10).
 */
export * from './file-storage.port';
export * from './ledger2-history.port';
export * from './logger.port';
export * from './message-channel.port';
export * from './cooperative-vars.port';
export * from './document.port';
export * from './account.port';
export * from './notification.port';
export * from './meet.port';
export * from './tracking-rule.contract';
export * from './decision-tracking.port';
export * from './decision-tracked.event';
export * from './free-decision.port';
export * from './payment.port';
export * from './payment-provider.port';
export * from './payment-method.port';
export * from './payment-desk.port';
export * from './program.contract';
export * from './wallet.port';
export * from './vault.port';
export * from './onboarding.port';
export * from './branch.port';
export * from './registration.port';
export * from './chain.port';
export * from './mass-notification-eligibility';
export * from './user-data.port';
export * from './party-card.port';
export * from './signed-document.port';
export * from './signature-info.contract';
export * from './meta-document.contract';
export * from './mono-account.contract';
