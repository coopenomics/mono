/**
 * Решения мастера вступления о шаге пароля и продолжении — без сторов и сети,
 * чтобы их можно было проверить напрямую (тесты — test/unit/registration-resume.test.ts).
 *
 * Случай 16.10.2026 (стенд 5): сбой оборвал шаг пароля после создания учётки,
 * а возобновление сочло пароль установленным по признаку входа, который ставит
 * и серверный рендер по cookie. Пайщик вступил без пароля, и войти ему было нечем.
 * Поэтому пароль здесь признаётся только по ответу сервера (`has_password`).
 */

/** Номера шагов мастера, нужные решениям о продолжении. */
export interface IResumeSteps {
  GenerateAccount: number;
  SelectBranch: number;
  ReadStatement: number;
}

/**
 * Шаг пароля пройден: учётка создана и пароль стоит. Пока аккаунт не загружен
 * (`hasPassword` неизвестен), верим отметке учётки — иначе шаг пароля
 * возвращался бы на каждом «Далее» до загрузки аккаунта.
 */
export function isPasswordStepDone(accountCreated: boolean, hasPassword: boolean | undefined): boolean {
  return accountCreated && hasPassword !== false;
}

/** Следующий видимый шаг после текущего; пройденный шаг пароля не повторяется. */
export function nextVisibleStep(
  visible: readonly number[],
  current: number,
  passwordStep: number,
  passwordStepDone: boolean,
): number | undefined {
  return visible.find((i) => i > current && !(i === passwordStep && passwordStepDone));
}

export type ResumeDecision =
  // Продолжать нечего: гость, вступление уже подано либо браузер всё знает.
  | { kind: 'none' }
  // Учётку браузер знает, но пароля нет — вернуть на шаг пароля.
  | { kind: 'step'; step: number }
  // Браузер учётку не знает — принять её с узла и встать на нужный шаг.
  | { kind: 'adopt'; step: number };

export interface IResumeInput {
  isAuth: boolean;
  username: string;
  // Учётка на узле в статусе «создан»: анкета принята, заявление не подано.
  isCreated: boolean;
  // Признак пароля с сервера (`Account.has_password`); неизвестен, пока аккаунт не загружен.
  hasPassword: boolean | undefined;
  known: { accountCreated: boolean; username: string; step: number };
  steps: IResumeSteps;
  isBranched: boolean;
}

export function decideResume(input: IResumeInput): ResumeDecision {
  if (!input.isAuth || !input.username || !input.isCreated) return { kind: 'none' };

  const { known, steps } = input;
  if (known.accountCreated && known.username === input.username) {
    if (input.hasPassword === false && known.step > steps.GenerateAccount) {
      return { kind: 'step', step: steps.GenerateAccount };
    }
    return { kind: 'none' };
  }

  if (input.hasPassword !== true) return { kind: 'adopt', step: steps.GenerateAccount };
  return { kind: 'adopt', step: input.isBranched ? steps.SelectBranch : steps.ReadStatement };
}
