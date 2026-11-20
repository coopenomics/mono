/**
 * Что показывает страница входа.
 *
 * Страница прячет форму только перед пайщиком, принятым советом: такого
 * пайщика стол ведёт на его стол, а форма входа на миг перед переходом лишняя.
 * При любом другом состоянии сессии страница показывает форму.
 *
 * Раньше форма пряталась перед любым вошедшим пайщиком с завершённой
 * регистрацией, а перехода на стол страница не делала. Вошедший пайщик,
 * оказавшийся на адресе входа (после выхода из одного окна, по закладке,
 * кнопкой «назад»), видел белый экран без единой ошибки (стенд 4, 20.11.2026).
 */
export type SignInView = 'form' | 'enter';

export interface SignInSessionState {
  isAuth: boolean;
  isFullyActive: boolean;
  /** Шаг регистратора: 1 — регистрация не начата и не идёт. */
  registratorStep: number;
}

export function signInViewOf(state: SignInSessionState): SignInView {
  return state.isAuth && state.isFullyActive && state.registratorStep === 1 ? 'enter' : 'form';
}
