import { describe, expect, it } from 'vitest';
import {
  decideResume,
  isPasswordStepDone,
  nextVisibleStep,
  type IResumeInput,
} from 'src/entities/Registrator/lib/registration-resume';

/**
 * Продолжение вступления и шаг пароля.
 *
 * Случаи 16.10.2026 (стенд 5): сбой оборвал шаг пароля после создания учётки, а
 * повторный проход мастера пропустил шаг пароля по признаку входа, который ставит
 * и серверный рендер по cookie. Пайщик вступил без пароля. Пароль признаётся только
 * по ответу сервера (`has_password`).
 */
const STEPS = { GenerateAccount: 5, SelectBranch: 6, ReadStatement: 7 };

function input(overrides: Partial<IResumeInput> = {}): IResumeInput {
  return {
    isAuth: true,
    username: 'newmember',
    isCreated: true,
    hasPassword: false,
    known: { accountCreated: false, username: '', step: 2 },
    steps: STEPS,
    isBranched: false,
    ...overrides,
  };
}

describe('decideResume — продолжать ли вступление и с какого шага', () => {
  it('гость: продолжать нечего', () => {
    expect(decideResume(input({ isAuth: false }))).toEqual({ kind: 'none' });
  });

  it('вошедший без имени: продолжать нечего', () => {
    expect(decideResume(input({ username: '' }))).toEqual({ kind: 'none' });
  });

  it('заявление уже подано (статус не «создан»): продолжать нечего', () => {
    expect(decideResume(input({ isCreated: false }))).toEqual({ kind: 'none' });
  });

  it('сбой после создания учётки, браузер её не знает, пароля нет → шаг пароля', () => {
    expect(decideResume(input({ hasPassword: false }))).toEqual({ kind: 'adopt', step: STEPS.GenerateAccount });
  });

  it('признак пароля ещё неизвестен (аккаунт не загружен) → шаг пароля, а не заявление', () => {
    expect(decideResume(input({ hasPassword: undefined }))).toEqual({ kind: 'adopt', step: STEPS.GenerateAccount });
  });

  it('другое устройство, пароль стоит → заявление', () => {
    expect(decideResume(input({ hasPassword: true }))).toEqual({ kind: 'adopt', step: STEPS.ReadStatement });
  });

  it('другое устройство, пароль стоит, кооператив с участками → выбор участка', () => {
    expect(decideResume(input({ hasPassword: true, isBranched: true }))).toEqual({
      kind: 'adopt',
      step: STEPS.SelectBranch,
    });
  });

  it('браузер знает учётку, пароля нет, шаг ушёл дальше пароля → назад на шаг пароля', () => {
    const decision = decideResume(input({
      hasPassword: false,
      known: { accountCreated: true, username: 'newmember', step: STEPS.ReadStatement },
    }));
    expect(decision).toEqual({ kind: 'step', step: STEPS.GenerateAccount });
  });

  it('браузер знает учётку, пароля нет, стоим на шаге пароля → шаг не трогаем', () => {
    const decision = decideResume(input({
      hasPassword: false,
      known: { accountCreated: true, username: 'newmember', step: STEPS.GenerateAccount },
    }));
    expect(decision).toEqual({ kind: 'none' });
  });

  it('браузер знает учётку и пароль стоит → шаг не трогаем', () => {
    const decision = decideResume(input({
      hasPassword: true,
      known: { accountCreated: true, username: 'newmember', step: STEPS.ReadStatement },
    }));
    expect(decision).toEqual({ kind: 'none' });
  });

  it('в браузере чужая незаконченная регистрация → принять учётку вошедшего', () => {
    const decision = decideResume(input({
      hasPassword: true,
      known: { accountCreated: true, username: 'someoneelse', step: STEPS.ReadStatement },
    }));
    expect(decision).toEqual({ kind: 'adopt', step: STEPS.ReadStatement });
  });
});

describe('isPasswordStepDone — шаг пароля пройден', () => {
  it('учётка не создана → не пройден', () => {
    expect(isPasswordStepDone(false, true)).toBe(false);
  });

  it('учётка создана, сервер говорит «пароля нет» → не пройден', () => {
    expect(isPasswordStepDone(true, false)).toBe(false);
  });

  it('учётка создана, пароль стоит → пройден', () => {
    expect(isPasswordStepDone(true, true)).toBe(true);
  });

  it('учётка создана, аккаунт ещё не загружен → верим отметке учётки', () => {
    expect(isPasswordStepDone(true, undefined)).toBe(true);
  });
});

describe('nextVisibleStep — «Далее» не перепрыгивает непройденный шаг пароля', () => {
  const visible = [1, 2, 4, 5, 7, 8];

  it('шаг пароля не пройден → «Далее» с анкеты ведёт на шаг пароля', () => {
    expect(nextVisibleStep(visible, 4, STEPS.GenerateAccount, false)).toBe(STEPS.GenerateAccount);
  });

  it('шаг пароля пройден → «Далее» с анкеты ведёт к заявлению', () => {
    expect(nextVisibleStep(visible, 4, STEPS.GenerateAccount, true)).toBe(STEPS.ReadStatement);
  });

  it('последний шаг → дальше некуда', () => {
    expect(nextVisibleStep(visible, 8, STEPS.GenerateAccount, true)).toBeUndefined();
  });
});
