import { ref } from 'vue';
import { PrivateKey, KeyType } from '@wharfkit/antelope';
import { SovietContract, SystemContract } from 'cooptypes';
import { useSessionStore } from 'src/entities/Session';
import { useSystemStore } from 'src/entities/System/model';
import { useGlobalStore } from 'src/shared/store';
import { robotApi, useRobotStore } from '../../../entities/robot';

/** Имя разрешения робота на аккаунте члена совета — одно для всей платформы. */
export const ROBOT_PERMISSION = 'robot';

/** Нулевое время в цепи — «бессрочно». */
const NO_EXPIRY = '1970-01-01T00:00:00';

export interface RobotAutomationDraft {
  vote_types: string[];
  authorize_types: string[];
}

/**
 * Делегирование роботу: выпуск разрешения с новым ключом на устройстве члена
 * совета, передача ключа роботу, запись в реестр автоматизаций и отзыв.
 *
 * Приватный ключ рождается здесь и уходит роботу одной мутацией по TLS; на
 * устройстве он не сохраняется. Если передача ключа сорвалась после того, как
 * разрешение уже в цепи, ключ удерживается в памяти до успешной повторной
 * передачи — иначе робот получил бы разрешение без ключа.
 */
export function useRobotDelegation() {
  const session = useSessionStore();
  const system = useSystemStore();
  const globalStore = useGlobalStore();
  const robotStore = useRobotStore();

  const busy = ref(false);
  /** Ключ, выпущенный в цепь, но ещё не принятый роботом. */
  const pendingWif = ref<string | null>(null);

  function zeroLimit(): string {
    const symbols = (system.info as any)?.symbols ?? {};
    const symbol = String(symbols.root_govern_symbol ?? 'RUB');
    const precision = Number(symbols.root_govern_precision ?? 4);
    return `${(0).toFixed(precision)} ${symbol}`;
  }

  function memberAuth() {
    return [{ actor: session.username, permission: 'active' }];
  }

  function automateAction(boardId: number, draft: RobotAutomationDraft) {
    const data: SovietContract.Actions.Decisions.Automate.IAutomate = {
      coopname: system.info.coopname,
      board_id: boardId,
      member: session.username,
      permission_name: ROBOT_PERMISSION,
      vote_types: draft.vote_types,
      authorize_types: draft.authorize_types,
      limit: zeroLimit(),
      expires_at: NO_EXPIRY,
    };
    return {
      account: SovietContract.contractName.production,
      name: SovietContract.Actions.Decisions.Automate.actionName,
      authorization: memberAuth(),
      data,
    };
  }

  function disautomateAction(boardId: number) {
    const data: SovietContract.Actions.Decisions.Disautomate.IDisautomate = {
      coopname: system.info.coopname,
      board_id: boardId,
      member: session.username,
    };
    return {
      account: SovietContract.contractName.production,
      name: SovietContract.Actions.Decisions.Disautomate.actionName,
      authorization: memberAuth(),
      data,
    };
  }

  function updateauthAction(publicKey: string) {
    return {
      account: SystemContract.contractName.production,
      name: 'updateauth',
      authorization: memberAuth(),
      data: {
        account: session.username,
        permission: ROBOT_PERMISSION,
        parent: 'active',
        auth: { threshold: 1, keys: [{ key: publicKey, weight: 1 }], accounts: [], waits: [] },
      },
    };
  }

  function linkauthAction() {
    return {
      account: SystemContract.contractName.production,
      name: 'linkauth',
      authorization: memberAuth(),
      data: {
        account: session.username,
        code: SovietContract.contractName.production,
        type: SovietContract.Actions.Decisions.VoteFor.actionName,
        requirement: ROBOT_PERMISSION,
      },
    };
  }

  function unlinkauthAction() {
    return {
      account: SystemContract.contractName.production,
      name: 'unlinkauth',
      authorization: memberAuth(),
      data: {
        account: session.username,
        code: SovietContract.contractName.production,
        type: SovietContract.Actions.Decisions.VoteFor.actionName,
      },
    };
  }

  function deleteauthAction() {
    return {
      account: SystemContract.contractName.production,
      name: 'deleteauth',
      authorization: memberAuth(),
      data: { account: session.username, permission: ROBOT_PERMISSION },
    };
  }

  async function reload(): Promise<void> {
    await Promise.all([robotStore.loadRegistry(), robotStore.loadKeyStatus()]);
  }

  /** Досылка ключа роботу, если предыдущая передача сорвалась. */
  async function handOverPendingKey(): Promise<void> {
    if (!pendingWif.value) return;
    await robotApi.delegateKey({ wif: pendingWif.value, permission_name: ROBOT_PERMISSION });
    pendingWif.value = null;
  }

  /**
   * Первое делегирование: новое разрешение с новым ключом, привязка к голосованию,
   * запись в реестр — одной транзакцией; затем ключ уходит роботу.
   */
  async function issueAndDelegate(boardId: number, draft: RobotAutomationDraft): Promise<void> {
    busy.value = true;
    try {
      if (pendingWif.value) {
        await handOverPendingKey();
        await reload();
        return;
      }
      const key = PrivateKey.generate(KeyType.K1);
      const wif = key.toWif();
      const publicKey = key.toPublic().toString();
      const actions: any[] = [updateauthAction(publicKey), linkauthAction()];
      if (draft.vote_types.length || draft.authorize_types.length) actions.push(automateAction(boardId, draft));
      await globalStore.transact(actions);
      pendingWif.value = wif;
      await handOverPendingKey();
      await reload();
    } finally {
      busy.value = false;
    }
  }

  /** Изменение списков типов при уже выпущенном ключе. Пустые списки — отзыв записи. */
  async function saveAutomation(boardId: number, draft: RobotAutomationDraft, hasRecord: boolean): Promise<void> {
    busy.value = true;
    try {
      const empty = !draft.vote_types.length && !draft.authorize_types.length;
      if (empty) {
        if (hasRecord) await globalStore.transact(disautomateAction(boardId));
      } else {
        await globalStore.transact(automateAction(boardId, draft));
      }
      await reload();
    } finally {
      busy.value = false;
    }
  }

  /** Полный отзыв: запись реестра, привязка и само разрешение — одной транзакцией; ключ стирается у робота. */
  async function revoke(boardId: number, hasRecord: boolean, hasPermission: boolean): Promise<void> {
    busy.value = true;
    try {
      const actions: any[] = [];
      if (hasRecord) actions.push(disautomateAction(boardId));
      if (hasPermission) actions.push(unlinkauthAction(), deleteauthAction());
      if (actions.length) await globalStore.transact(actions);
      await robotApi.revokeKey();
      pendingWif.value = null;
      await reload();
    } finally {
      busy.value = false;
    }
  }

  return { busy, pendingWif, issueAndDelegate, saveAutomation, revoke, handOverPendingKey };
}
