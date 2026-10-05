/**
 * Права ядра по таблице прав: учётные записи, вступление, кошелёк, платежи,
 * участки, настройки кооператива (C28-87, случаи core.acc.* в
 * test-registry/core.account-rights.yaml).
 *
 * Прежний гард ролей пропускал любого вошедшего, когда в запросе названо его
 * имя, а совет — с любым именем. Теперь «своё» — явное право с охватом: имя в
 * запросе сверяется с вошедшим, за другого на узле не действует никто; совет
 * читает данные любого пайщика. Требование каждой операции тест читает из
 * исходника резолвера.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { desktopGrantsOf } from '@coopenomics/extension-kit';
import { ExtensionGrantsRegistry } from '~/application/desktop/extension-grants.registry';
import {
  APPLICATION,
  NO_RIGHT,
  OWN,
  candidate,
  chairman,
  councilMember,
  makeGuard,
  participant,
  requirementOf,
  type Caller,
} from './core-rights.harness';

const F = {
  account: 'account/resolvers/account.resolver.ts',
  agreement: 'agreement/resolvers/agreement.resolver.ts',
  appstore: 'appstore/resolvers/extension.resolver.ts',
  security: 'auth-v2/account-security/account-security.resolver.ts',
  explorer: 'blockchain-explorer/resolvers/blockchain-explorer.resolver.ts',
  branch: 'branch/resolvers/branch.resolver.ts',
  gateway: 'gateway/resolvers/gateway.resolver.ts',
  files: 'gateway/resolvers/payment-files.resolver.ts',
  ledger: 'ledger/resolvers/ledger.resolver.ts',
  ledger2: 'ledger2/resolvers/ledger2.resolver.ts',
  exit: 'membership-exit/resolvers/membership-exit.resolver.ts',
  inbox: 'notification-center/notification-inbox.resolver.ts',
  journal: 'notification-center/notification-journal.resolver.ts',
  notification: 'notification/resolvers/notification.resolver.ts',
  push: 'notification/resolvers/web-push-subscription.resolver.ts',
  onboarding: 'onboarding/resolvers/extension-onboarding.resolver.ts',
  participant: 'participant/resolvers/participant.resolver.ts',
  methods: 'payment-method/resolvers/payment-method.resolver.ts',
  process: 'process-registry/resolvers/process-registry.resolver.ts',
  provider: 'provider/resolvers/provider.resolver.ts',
  registration: 'registration/resolvers/registration.resolver.ts',
  system: 'system/resolvers/system.resolver.ts',
  wallet: 'wallet/resolvers/wallet.resolver.ts',
};

/** Аргументы операции с именем `username` там, где операция его называет. */
type Named = (username: string) => Record<string, unknown>;
const inData: Named = (username) => ({ data: { username } });
const inFilter: Named = (username) => ({ filter: { username } });
const inArgs: Named = (username) => ({ username });

/** Операции «своё» каждого вошедшего: читает и совет (кроме способов оплаты). */
const ACCOUNT_OWN: [string, string, Named][] = [
  [F.account, 'getAccount', inData],
  [F.agreement, 'agreements', inFilter],
  [F.gateway, 'getPayments', inData],
  [F.wallet, 'getProgramWallets', inFilter],
  [F.wallet, 'getProgramWallet', inFilter],
  [F.wallet, 'getUserWallets', inArgs],
  [F.registration, 'getCandidateIntake', inArgs],
  [F.process, 'processes', inFilter],
];

/** Действия каждого вошедшего только на своё имя — совету чужое имя закрыто. */
const ACCOUNT_ACTS: [string, string][] = [
  [F.agreement, 'generateWalletAgreement'],
  [F.agreement, 'generatePrivacyAgreement'],
  [F.agreement, 'generateSignatureAgreement'],
  [F.agreement, 'generateUserAgreement'],
  [F.registration, 'generateRegistrationDocuments'],
  [F.registration, 'generateParticipantApplication'],
  [F.registration, 'registerParticipant'],
  [F.registration, 'createInitialPayment'],
  [F.branch, 'selectBranch'],
  [F.branch, 'generateSelectBranchDocument'],
];

/** Действия принятого пайщика только на своё имя. */
const PARTICIPANT_ACTS: [string, string][] = [
  [F.wallet, 'generateReturnByMoneyStatementDocument'],
  [F.wallet, 'createWithdraw'],
  [F.wallet, 'createDepositPayment'],
  [F.exit, 'generateMembershipExitApplication'],
  [F.provider, 'generateConvertToAxonStatement'],
  [F.provider, 'processConvertToAxonStatement'],
  [F.push, 'createWebPushSubscription'],
  [F.push, 'getUserWebPushSubscriptions'],
];

const DECISION_DOCUMENTS: [string, string][] = [
  [F.registration, 'generateParticipantApplicationDecision'],
  [F.wallet, 'generateReturnByMoneyDecisionDocument'],
  [F.exit, 'generateMembershipExitDecision'],
];

const COUNCIL_READS: [string, string][] = [
  [F.account, 'getAccounts'],
  [F.account, 'searchPrivateAccounts'],
  [F.agreement, 'confirmAgreement'],
  [F.agreement, 'declineAgreement'],
  [F.appstore, 'getExtensionLogs'],
  [F.explorer, 'getDeltas'],
  [F.explorer, 'getActions'],
  [F.explorer, 'getCurrentTableStates'],
  [F.gateway, 'setPaymentStatus'],
  [F.files, 'uploadPaymentProof'],
  [F.ledger, 'getLedger'],
  [F.ledger, 'getLedgerHistory'],
  [F.ledger2, 'getLedger2Accounts'],
  [F.ledger2, 'getLedger2Wallets'],
  [F.ledger2, 'getLedger2History'],
  [F.ledger2, 'getLedger2Postings'],
  [F.journal, 'getNotifications'],
  [F.journal, 'getNotification'],
  [F.participant, 'addParticipant'],
  [F.process, 'process'],
  [F.provider, 'getProviderSubscriptionById'],
];

const CHAIRMAN_ONLY: [string, string][] = [
  [F.account, 'deleteAccount'],
  [F.account, 'updateAccount'],
  [F.appstore, 'getExtensions'],
  [F.appstore, 'installExtension'],
  [F.appstore, 'updateExtension'],
  [F.appstore, 'uninstallExtension'],
  [F.security, 'getParticipantLoginSecurity'],
  [F.security, 'resetParticipantTwoFactor'],
  [F.branch, 'createBranch'],
  [F.branch, 'editBranch'],
  [F.branch, 'deleteBranch'],
  [F.branch, 'addTrustedAccount'],
  [F.branch, 'deleteTrustedAccount'],
  [F.branch, 'setBranchPrivate'],
  [F.branch, 'addBranchWhitelist'],
  [F.branch, 'deleteBranchWhitelist'],
  [F.ledger2, 'walmoveWallets'],
  [F.journal, 'resendNotification'],
  [F.notification, 'triggerNotificationWorkflow'],
  [F.push, 'getWebPushSubscriptionStats'],
  [F.onboarding, 'completeExtensionOnboardingStep'],
  [F.system, 'updateSystem'],
  [F.system, 'updateSettings'],
];

const PAYMENT_METHODS = ['getPaymentMethods', 'addPaymentMethod', 'updateBankAccount', 'deletePaymentMethod'];

describe('свои данные каждого вошедшего', () => {
  // core.acc.happy.01
  it.each(ACCOUNT_OWN)('%s %s: кандидат и пайщик читают своё, совет — любого пайщика', async (file, operation, named) => {
    const { pass } = makeGuard();
    const requirement = requirementOf(file, operation);
    await expect(pass(requirement, candidate, named('cand'))).resolves.toBe(true);
    await expect(pass(requirement, participant, named('ivan'))).resolves.toBe(true);
    await expect(pass(requirement, councilMember, named('ivan'))).resolves.toBe(true);
  });

  // core.acc.side.01
  it.each(ACCOUNT_OWN)('%s %s: чужое имя и запрос без имени пайщику закрыты', async (file, operation, named) => {
    const { pass } = makeGuard();
    const requirement = requirementOf(file, operation);
    await expect(pass(requirement, participant, named('petr'))).rejects.toMatchObject(OWN);
    await expect(pass(requirement, participant, {})).rejects.toMatchObject(OWN);
    // Совет читает и без имени в запросе — весь кооператив.
    await expect(pass(requirement, councilMember, {})).resolves.toBe(true);
  });

  // core.acc.happy.02
  it.each(ACCOUNT_ACTS)('%s %s: кандидат проходит на своё имя', async (file, operation) => {
    const { pass } = makeGuard();
    await expect(pass(requirementOf(file, operation), candidate, inData('cand'))).resolves.toBe(true);
  });

  // core.acc.side.02
  it.each([...ACCOUNT_ACTS, ...PARTICIPANT_ACTS])('%s %s: чужое имя — отказ пайщику, члену совета и председателю', async (file, operation) => {
    const { pass } = makeGuard();
    const requirement = requirementOf(file, operation);
    for (const caller of [participant, councilMember, chairman]) {
      await expect(pass(requirement, caller, inData('drugoy'))).rejects.toMatchObject(OWN);
    }
  });

  // core.acc.happy.03
  it('входящие уведомления и участки читает каждый вошедший, включая кандидата', async () => {
    const { pass } = makeGuard();
    for (const operation of ['getInboxNotifications', 'getUnreadNotificationsCount', 'markNotificationRead', 'markAllNotificationsRead']) {
      await expect(pass(requirementOf(F.inbox, operation), candidate)).resolves.toBe(true);
    }
    await expect(pass(requirementOf(F.branch, 'getBranches'), candidate)).resolves.toBe(true);
  });
});

describe('права принятого пайщика', () => {
  // core.acc.happy.04
  it.each(PARTICIPANT_ACTS)('%s %s: принятый пайщик проходит на своё имя', async (file, operation) => {
    const { pass } = makeGuard();
    await expect(pass(requirementOf(file, operation), participant, inData('ivan'))).resolves.toBe(true);
  });

  // core.acc.side.03
  it('возврат, взнос и заявление на выход кандидату закрыты даже на своё имя', async () => {
    const { pass } = makeGuard();
    for (const [file, operation] of PARTICIPANT_ACTS.slice(0, 4)) {
      await expect(pass(requirementOf(file, operation), candidate, inData('cand'))).rejects.toMatchObject(NO_RIGHT);
    }
  });

  // core.acc.side.03
  it('подписки браузера, подписки провайдера и состояние подключения приложения — права принятого пайщика и совета', async () => {
    const { pass } = makeGuard();
    const own: [string, string][] = [
      [F.push, 'deactivateWebPushSubscriptionById'],
      [F.provider, 'getProviderSubscriptions'],
      [F.provider, 'getCurrentInstance'],
      [F.onboarding, 'getExtensionOnboardingState'],
    ];
    for (const [file, operation] of own) {
      const requirement = requirementOf(file, operation);
      await expect(pass(requirement, participant)).resolves.toBe(true);
      await expect(pass(requirement, { ...councilMember, status: 'registered' })).resolves.toBe(true);
      await expect(pass(requirement, candidate)).rejects.toMatchObject(NO_RIGHT);
    }
  });
});

describe('права совета и председателя', () => {
  // core.acc.side.04
  it.each(DECISION_DOCUMENTS)('%s %s: документ решения совета собирает совет на имя заявителя; пайщику отказ и на своё имя', async (file, operation) => {
    const { pass } = makeGuard();
    const requirement = requirementOf(file, operation);
    await expect(pass(requirement, councilMember, inData('ivan'))).resolves.toBe(true);
    await expect(pass(requirement, participant, inData('ivan'))).rejects.toMatchObject(NO_RIGHT);
    await expect(pass(requirement, candidate, inData('cand'))).rejects.toMatchObject(NO_RIGHT);
  });

  // core.acc.happy.05
  it.each(COUNCIL_READS)('%s %s: член совета и председатель проходят, пайщик получает отказ', async (file, operation) => {
    const { pass } = makeGuard();
    const requirement = requirementOf(file, operation);
    await expect(pass(requirement, councilMember)).resolves.toBe(true);
    await expect(pass(requirement, chairman)).resolves.toBe(true);
    await expect(pass(requirement, participant, inData('ivan'))).rejects.toMatchObject(NO_RIGHT);
  });

  // core.acc.side.05
  it.each(CHAIRMAN_ONLY)('%s %s: председатель проходит, члену совета отказ и на своё имя', async (file, operation) => {
    const { pass } = makeGuard();
    const requirement = requirementOf(file, operation);
    await expect(pass(requirement, chairman, inData('ivan'))).resolves.toBe(true);
    await expect(pass(requirement, councilMember, inData('petr'))).rejects.toMatchObject(NO_RIGHT);
  });

  // core.acc.side.06
  it.each(PAYMENT_METHODS)('%s: свои реквизиты ведёт каждый вошедший, чужие — председатель', async (operation) => {
    const { pass } = makeGuard();
    const requirement = requirementOf(F.methods, operation);
    await expect(pass(requirement, candidate, inData('cand'))).resolves.toBe(true);
    await expect(pass(requirement, councilMember, inData('petr'))).resolves.toBe(true);
    await expect(pass(requirement, councilMember, inData('ivan'))).rejects.toMatchObject(OWN);
    await expect(pass(requirement, chairman, inData('ivan'))).resolves.toBe(true);
    await expect(pass(requirement, chairman, {})).resolves.toBe(true);
  });

  // core.acc.side.07
  it('подписанное соглашение пайщик подаёт на своё имя; совет — за любого пайщика', async () => {
    const { pass } = makeGuard();
    const requirement = requirementOf(F.agreement, 'sendAgreement');
    await expect(pass(requirement, candidate, inData('cand'))).resolves.toBe(true);
    await expect(pass(requirement, participant, inData('petr'))).rejects.toMatchObject(OWN);
    await expect(pass(requirement, councilMember, inData('ivan'))).resolves.toBe(true);
  });
});

describe('чеки платежей', () => {
  const STAND = { payments: { p1: 'ivan' }, files: { 7: 'p1', 8: 'нет-платежа' } };

  // core.acc.side.08
  it('чек читают плательщик и совет; другому пайщику отказ', async () => {
    const { pass } = makeGuard(STAND);
    const byFile = requirementOf(F.files, 'paymentFile');
    const byPayment = requirementOf(F.files, 'paymentProofs');
    await expect(pass(byFile, participant, { id: 7 })).resolves.toBe(true);
    await expect(pass(byPayment, participant, { coopname: 'voskhod', payment_hash: 'p1' })).resolves.toBe(true);
    await expect(pass(byFile, candidate, { id: 7 })).rejects.toMatchObject(OWN);
    await expect(pass(byPayment, candidate, { coopname: 'voskhod', payment_hash: 'p1' })).rejects.toMatchObject(OWN);
    await expect(pass(byFile, councilMember, { id: 7 })).resolves.toBe(true);
  });

  // core.acc.side.09
  it('платежа с таким номером нет — пайщику отказ: чужие чеки по номеру не перебираются', async () => {
    const { pass } = makeGuard(STAND);
    await expect(pass(requirementOf(F.files, 'paymentProofs'), participant, { coopname: 'voskhod', payment_hash: 'p9' })).rejects.toMatchObject(OWN);
    await expect(pass(requirementOf(F.files, 'paymentFile'), participant, { id: 8 })).rejects.toMatchObject(OWN);
  });

  it('файла с таким номером нет — гард пропускает, «не найдено» отвечает операция', async () => {
    const { pass } = makeGuard(STAND);
    await expect(pass(requirementOf(F.files, 'paymentFile'), participant, { id: 99 })).resolves.toBe(true);
  });
});

describe('состав операций ядра', () => {
  const resolvers = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) return resolvers(path);
      return name.endsWith('.resolver.ts') ? [path] : [];
    });

  it('в резолверах ядра не осталось ни `@AuthRoles`, ни гарда ролей', () => {
    for (const file of resolvers(APPLICATION)) {
      const src = readFileSync(file, 'utf8').replace(/^\s*(\/\/|\*).*$/gm, '');
      expect({ file, legacy: /@AuthRoles|RolesGuard/.test(src) }).toEqual({ file, legacy: false });
    }
  });
});

describe('права страниц столов ядра', () => {
  const grantsFor = async (caller: Caller | null) => {
    const { rights } = makeGuard();
    return desktopGrantsOf(rights).resolveGrants(caller ? { username: caller.username, userRole: caller.role, userStatus: caller.status } : {});
  };

  // core.acc.happy.06
  it('гость получает только права страниц без входа', async () => {
    expect([...(await grantsFor(null))].sort()).toEqual(['Cooperative:read', 'MembershipExit:confirm']);
  });

  // core.acc.happy.06
  it('кандидат видит страницы своих данных; собрания и подключение — страницы принятого пайщика', async () => {
    const grants = await grantsFor(candidate);
    for (const grant of ['Cooperative:read', 'Account:read:own', 'Wallet:read:own', 'Document:read:own', 'Payment:read:own', 'PaymentMethod:manage:own', 'Card:read:own']) {
      expect(grants).toContain(grant);
    }
    expect(grants).not.toContain('Meet:read');
    expect(grants).not.toContain('ProviderSubscription:read:own');
    expect(await grantsFor(participant)).toEqual(expect.arrayContaining(['Meet:read', 'ProviderSubscription:read:own']));
  });

  // core.acc.side.10
  it('страницы стола председателя открыты председателю; члену совета и пайщику — нет', async () => {
    const pages = ['System:manage', 'Extension:manage', 'Branch:manage', 'Account:update', 'NotificationJournal:resend'];
    expect(await grantsFor(chairman)).toEqual(expect.arrayContaining(pages));
    for (const caller of [councilMember, participant]) {
      const grants = await grantsFor(caller);
      for (const page of pages) expect(grants).not.toContain(page);
    }
  });

  it('права ядра регистрируются для столов совета, председателя и пайщика', () => {
    const { rights, registry } = makeGuard();
    rights.onModuleInit();
    const desks = registry.register.mock.calls.map(([provider]) => provider.extensionName).sort();
    expect(desks).toEqual(['chairman', 'participant', 'soviet']);
  });

  // core.acc.happy.07
  it('реестр прав столов объединяет права нескольких таблиц одного стола', async () => {
    const registry = new ExtensionGrantsRegistry();
    registry.register({ extensionName: 'chairman', resolveGrants: async () => ['Branch:manage', 'System:manage'] });
    registry.register({ extensionName: 'chairman', resolveGrants: async () => ['Approval:confirm', 'System:manage'] });
    expect(await registry.resolve('chairman', { coopname: 'voskhod' })).toEqual(['Branch:manage', 'System:manage', 'Approval:confirm']);
    expect(await registry.resolve('market', { coopname: 'voskhod' })).toBeUndefined();
  });
});
