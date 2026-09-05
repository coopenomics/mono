import { SovietContract, SystemContract } from 'cooptypes';

/** Имя разрешения робота на аккаунте члена совета — одно для всей платформы. */
export const ROBOT_PERMISSION = 'robot';

/** Нулевое время в цепи — «бессрочно». */
export const NO_EXPIRY = '1970-01-01T00:00:00';

/** Правило «как ‹член совета›» по типу решения. */
export type RobotFollowRule = SovietContract.Interfaces.IFollowRule;

export interface RobotAutomationDraft {
  /** Типы, по которым робот голосует сразу. */
  vote_types: string[];
  /** Типы, по которым робот повторяет голос другого члена совета. */
  follow_rules: RobotFollowRule[];
  authorize_types: string[];
}

/** В черновике есть хоть одно правило — запись в реестре нужна. */
export function draftHasRules(draft: RobotAutomationDraft): boolean {
  return draft.vote_types.length > 0 || draft.follow_rules.length > 0 || draft.authorize_types.length > 0;
}

export interface RobotActionContext {
  coopname: string;
  username: string;
  /** Нулевой лимит в валюте кооператива, например «0.0000 RUB». */
  zeroLimit: string;
}

function memberAuth(ctx: RobotActionContext) {
  return [{ actor: ctx.username, permission: 'active' }];
}

/** Запись в реестр автоматизаций контракта совета. */
export function automateAction(ctx: RobotActionContext, boardId: number, draft: RobotAutomationDraft) {
  const data: SovietContract.Actions.Decisions.Automate.IAutomate = {
    coopname: ctx.coopname,
    board_id: boardId,
    member: ctx.username,
    permission_name: ROBOT_PERMISSION,
    vote_types: draft.vote_types,
    follow_rules: draft.follow_rules,
    authorize_types: draft.authorize_types,
    limit: ctx.zeroLimit,
    expires_at: NO_EXPIRY,
  };
  return {
    account: SovietContract.contractName.production,
    name: SovietContract.Actions.Decisions.Automate.actionName,
    authorization: memberAuth(ctx),
    data,
  };
}

/** Удаление записи из реестра автоматизаций. */
export function disautomateAction(ctx: RobotActionContext, boardId: number) {
  const data: SovietContract.Actions.Decisions.Disautomate.IDisautomate = {
    coopname: ctx.coopname,
    board_id: boardId,
    member: ctx.username,
  };
  return {
    account: SovietContract.contractName.production,
    name: SovietContract.Actions.Decisions.Disautomate.actionName,
    authorization: memberAuth(ctx),
    data,
  };
}

/** Разрешение робота с новым ключом под active. */
export function updateauthAction(ctx: RobotActionContext, publicKey: string) {
  return {
    account: SystemContract.contractName.production,
    name: 'updateauth',
    authorization: memberAuth(ctx),
    data: {
      account: ctx.username,
      permission: ROBOT_PERMISSION,
      parent: 'active',
      auth: { threshold: 1, keys: [{ key: publicKey, weight: 1 }], accounts: [], waits: [] },
    },
  };
}

/** Привязка разрешения робота только к голосованию в совете. */
export function linkauthAction(ctx: RobotActionContext) {
  return {
    account: SystemContract.contractName.production,
    name: 'linkauth',
    authorization: memberAuth(ctx),
    data: {
      account: ctx.username,
      code: SovietContract.contractName.production,
      type: SovietContract.Actions.Decisions.VoteFor.actionName,
      requirement: ROBOT_PERMISSION,
    },
  };
}

export function unlinkauthAction(ctx: RobotActionContext) {
  return {
    account: SystemContract.contractName.production,
    name: 'unlinkauth',
    authorization: memberAuth(ctx),
    data: {
      account: ctx.username,
      code: SovietContract.contractName.production,
      type: SovietContract.Actions.Decisions.VoteFor.actionName,
    },
  };
}

export function deleteauthAction(ctx: RobotActionContext) {
  return {
    account: SystemContract.contractName.production,
    name: 'deleteauth',
    authorization: memberAuth(ctx),
    data: { account: ctx.username, permission: ROBOT_PERMISSION },
  };
}

/** Повтор той же привязки цепь отвергает — после прошлого делегирования это не ошибка. */
export function isSameLinkError(e: unknown): boolean {
  return /same as old/.test(String((e as Error)?.message ?? e));
}
