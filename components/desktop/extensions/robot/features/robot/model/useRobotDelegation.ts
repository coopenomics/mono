import { computed, ref } from 'vue';
import { useSessionStore } from 'src/entities/Session';
import { useSystemStore } from 'src/entities/System/model';
import { useGlobalStore } from 'src/shared/store';
import { robotApi, useRobotStore } from '../../../entities/robot';
import { ROBOT_PERMISSION, type RobotAutomationDraft } from './robotActions';
import { RobotDelegationOps } from './robotDelegationOps';

export { ROBOT_PERMISSION, type RobotAutomationDraft } from './robotActions';

function zeroLimitOf(info: any): string {
  const symbols = info?.symbols ?? {};
  return `${(0).toFixed(Number(symbols.root_govern_precision ?? 4))} ${String(symbols.root_govern_symbol ?? 'RUB')}`;
}

/** Делегирование роботу с рабочего стола: операции — в RobotDelegationOps, здесь только сторы и занятость. */
export function useRobotDelegation() {
  const session = useSessionStore();
  const system = useSystemStore();
  const globalStore = useGlobalStore();
  const robotStore = useRobotStore();
  const busy = ref(false);
  const version = ref(0);

  const ops = new RobotDelegationOps({
    ctx: () => ({ coopname: system.info.coopname, username: session.username, zeroLimit: zeroLimitOf(system.info) }),
    transact: (actions) => globalStore.transact(actions),
    delegateKey: (wif) => robotApi.delegateKey({ wif, permission_name: ROBOT_PERMISSION }),
    revokeKey: () => robotApi.revokeKey(),
  });

  const pendingWif = computed(() => (version.value, ops.pendingWif));

  async function run(work: () => Promise<void>): Promise<void> {
    busy.value = true;
    try {
      await work();
      await Promise.all([robotStore.loadRegistry(), robotStore.loadKeyStatus()]);
    } finally {
      version.value += 1;
      busy.value = false;
    }
  }

  return {
    busy,
    pendingWif,
    issueAndDelegate: (boardId: number, draft: RobotAutomationDraft) => run(() => ops.issueAndDelegate(boardId, draft)),
    saveAutomation: (boardId: number, draft: RobotAutomationDraft, hasRecord: boolean) => run(() => ops.saveAutomation(boardId, draft, hasRecord)),
    revoke: (boardId: number, hasRecord: boolean, hasPermission: boolean) => run(() => ops.revoke(boardId, hasRecord, hasPermission)),
    handOverPendingKey: () => run(() => ops.handOverPendingKey()),
  };
}
