import { reactive, readonly } from 'vue';

/** Что спрашивает диалог подтверждения. */
export interface ConfirmOptions {
  /** Вопрос в заголовке — коротко и по делу: «Отменить курс по недобору?» */
  title: string;
  /** Что произойдёт после подтверждения. Одно-два предложения. */
  message?: string;
  /** Предупреждение о необратимости или последствиях — отдельной строкой. */
  note?: string;
  /** Подпись кнопки подтверждения; по умолчанию «Подтвердить». */
  confirmLabel?: string;
  /** Подпись кнопки отказа; по умолчанию «Отмена». */
  cancelLabel?: string;
  /** Разрушительное действие красит кнопку в цвет отказа. */
  danger?: boolean;
}

interface ConfirmState {
  open: boolean;
  options: ConfirmOptions;
  resolve: ((value: boolean) => void) | null;
}

const EMPTY: ConfirmOptions = { title: '' };

/**
 * Одно окно подтверждения на всё приложение: диалог живёт глобальным оверлеем,
 * а вызывающий код ждёт ответ обычным `await`. Своих диалогов под каждое
 * «вы уверены?» больше не нужно, и ни одно разрушительное действие не уходит
 * мимо подтверждения по забывчивости.
 */
const state = reactive<ConfirmState>({ open: false, options: { ...EMPTY }, resolve: null });

/** Состояние для оверлея-хоста; страницы им не пользуются. */
export function useConfirmState() {
  return {
    state: readonly(state),
    answer(value: boolean): void {
      const resolve = state.resolve;
      state.open = false;
      state.resolve = null;
      resolve?.(value);
    },
  };
}

/**
 * Спросить подтверждение и дождаться ответа:
 *
 * ```ts
 * const { confirm } = useConfirm();
 * if (!(await confirm({ title: 'Отменить курс по недобору?', danger: true }))) return;
 * ```
 */
export function useConfirm() {
  return {
    confirm(options: ConfirmOptions): Promise<boolean> {
      // Второй вопрос поверх первого оставил бы висеть обещание навсегда:
      // отвечаем на прежний отказом и спрашиваем заново.
      state.resolve?.(false);
      state.options = { ...options };
      state.resolve = null;
      state.open = true;
      return new Promise<boolean>((resolve) => {
        state.resolve = resolve;
      });
    },
  };
}
