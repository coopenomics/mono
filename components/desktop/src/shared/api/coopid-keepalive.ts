/**
 * Поддержание сессии CoopID, пока пайщик работает в кабинете.
 *
 * У кабинета и у CoopID сессии РАЗНЫЕ. Кабинет живёт на своих токенах и продлевает их сам,
 * а сессия authentik продлевается только когда браузер в неё обращается — чего кабинет
 * после входа не делает вовсе. Через сутки-другую она истекает незаметно: человек по-прежнему
 * в кабинете, но любой переход наружу — в Карту кооператора, на форум — упирается в форму
 * «введите почту и пароль», хотя он только что нажал кнопку внутри своего же кабинета
 * (прод 08.09.2026, разбор по журналу authentik: единственная живая сессия принадлежала
 * другому адресу, а обращения с рабочего места приходили неопознанными).
 *
 * Поэтому кабинет напоминает о себе сам: раз в четверть часа тихо спрашивает у authentik,
 * кто он, — этого достаточно, чтобы отметка последнего использования обновилась и срок
 * пошёл заново. Запрос дешёвый, ходит на свой же домен и ничего не меняет.
 *
 * Чего он НЕ делает: не создаёт сессию и не продлевает её вопреки настройке. Нет сессии —
 * authentik отвечает 403, и напоминания прекращаются до следующего входа: у пайщика,
 * вошедшего легаси-ключом, сессии CoopID нет и быть не может, и звать сервер ради него
 * незачем.
 *
 * @packageDocumentation
 */
import { hasIdpSession } from './authentik-flow';

/** Как часто напоминаем о себе: заметно чаще самого короткого разумного срока сессии. */
const KEEPALIVE_INTERVAL_MS = 15 * 60 * 1000;

/**
 * Запускает поддержание сессии CoopID.
 *
 * Пока вкладка скрыта, напоминания не идут: фоновая вкладка держала бы сессию живой у
 * закрытого ноутбука. Вернувшись к работе, человек получает напоминание сразу — возврат
 * на вкладку сам его и вызывает.
 *
 * @param base — origin authentik; пусто — свой же домен (кабинет и CoopID same-origin).
 * @returns Остановка: снимает таймер и подписку. Идемпотентна.
 */
export const startCoopidKeepalive = (base = ''): (() => void) => {
  if (typeof window === 'undefined') return () => undefined;

  let timer: ReturnType<typeof setInterval> | null = null;
  let running = false;
  /** Обработчик возврата на вкладку; объявлен до остановки, чтобы та могла его снять. */
  let onVisible: () => void = () => undefined;

  const stop = (): void => {
    if (timer) clearInterval(timer);
    timer = null;
    document.removeEventListener('visibilitychange', onVisible);
  };

  const ping = async (): Promise<void> => {
    if (running || document.visibilityState !== 'visible') return;
    running = true;
    try {
      // 403 — сессии нет: продлевать нечего, и напоминать больше незачем.
      if (!(await hasIdpSession(base))) stop();
    } finally {
      running = false;
    }
  };

  onVisible = () => {
    if (document.visibilityState === 'visible') void ping();
  };

  document.addEventListener('visibilitychange', onVisible);
  timer = setInterval(() => void ping(), KEEPALIVE_INTERVAL_MS);
  void ping();

  return stop;
};
