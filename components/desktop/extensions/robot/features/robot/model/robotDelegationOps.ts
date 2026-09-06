import { PrivateKey, KeyType } from '@wharfkit/antelope';
import {
  ROBOT_PERMISSION,
  automateAction,
  deleteauthAction,
  draftHasRules,
  disautomateAction,
  isMissingLinkError,
  isSameLinkError,
  linkauthActions,
  unlinkauthActions,
  updateauthAction,
  type RobotActionContext,
  type RobotAutomationDraft,
} from './robotActions';

export interface RobotDelegationDeps {
  ctx: () => RobotActionContext;
  transact: (actions: any) => Promise<unknown>;
  delegateKey: (wif: string) => Promise<unknown>;
  revokeKey: () => Promise<unknown>;
}

/**
 * Операции делегирования роботу без привязки к Vue: выпуск разрешения с новым
 * ключом, запись в реестр автоматизаций, отзыв. Ключ рождается здесь и уходит
 * роботу одной мутацией; если передача сорвалась после того, как разрешение
 * уже в цепи, ключ удерживается в памяти до успешной повторной передачи.
 */
export class RobotDelegationOps {
  /** Ключ, выпущенный в цепь, но ещё не принятый роботом. */
  pendingWif: string | null = null;

  constructor(private readonly deps: RobotDelegationDeps) {}

  async handOverPendingKey(): Promise<void> {
    if (!this.pendingWif) return;
    await this.deps.delegateKey(this.pendingWif);
    this.pendingWif = null;
  }

  /** Первое делегирование: разрешение с новым ключом и запись в реестр, затем ключ — роботу. */
  async issueAndDelegate(boardId: number, draft: RobotAutomationDraft): Promise<void> {
    if (this.pendingWif) return this.handOverPendingKey();
    const key = PrivateKey.generate(KeyType.K1);
    const actions: any[] = [updateauthAction(this.deps.ctx(), key.toPublic().toString())];
    if (draftHasRules(draft)) actions.push(automateAction(this.deps.ctx(), boardId, draft));
    await this.deps.transact(actions);
    this.pendingWif = key.toWif();
    try {
      await this.deps.transact(linkauthActions(this.deps.ctx()));
    } catch (e: unknown) {
      if (!isSameLinkError(e)) throw e;
    }
    await this.handOverPendingKey();
  }

  /** Изменение списков типов при уже выпущенном ключе. Пустые списки — отзыв записи. */
  async saveAutomation(boardId: number, draft: RobotAutomationDraft, hasRecord: boolean): Promise<void> {
    if (!draftHasRules(draft)) {
      if (hasRecord) await this.deps.transact(disautomateAction(this.deps.ctx(), boardId));
      return;
    }
    await this.deps.transact(automateAction(this.deps.ctx(), boardId, draft));
  }

  /** Полный отзыв: запись реестра, привязки и разрешение — одной транзакцией; ключ стирается у робота. */
  async revoke(boardId: number, hasRecord: boolean, hasPermission: boolean): Promise<void> {
    const actions: any[] = [];
    if (hasRecord) actions.push(disautomateAction(this.deps.ctx(), boardId));
    if (hasPermission) actions.push(...unlinkauthActions(this.deps.ctx()), deleteauthAction(this.deps.ctx()));
    if (actions.length) await this.transactSkippingMissingLinks(actions);
    await this.deps.revokeKey();
    this.pendingWif = null;
  }

  /**
   * Разрешение, выпущенное прежней версией стола, привязано не ко всем
   * действиям сразу. Снятие несуществующей привязки цепь отвергает и роняет
   * транзакцию целиком, а с ней и удаление разрешения. Поэтому при такой ошибке
   * снимаем привязки поштучно, пропуская отсутствующие.
   */
  private async transactSkippingMissingLinks(actions: any[]): Promise<void> {
    try {
      await this.deps.transact(actions);
      return;
    } catch (e: unknown) {
      if (!isMissingLinkError(e)) throw e;
    }
    for (const unlink of actions.filter((a) => a.name === 'unlinkauth')) {
      try {
        await this.deps.transact([unlink]);
      } catch (e: unknown) {
        if (!isMissingLinkError(e)) throw e;
      }
    }
    await this.deps.transact(actions.filter((a) => a.name !== 'unlinkauth'));
  }
}

export { ROBOT_PERMISSION };
