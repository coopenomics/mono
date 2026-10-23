import { ref } from 'vue';

/**
 * Состояние кнопки карты в шапке страницы.
 *
 * Шапка живёт вне поддерева страницы, поэтому кнопка получает состояние через
 * общий ref, а не через props (канон header actions, как у собраний).
 */
export interface CardcoopHeaderState {
  /** Карта уже выпущена: кнопка открывает её, а не выпускает. */
  issued: boolean;
  /** Состояние ещё едет с сервера: кнопку не показываем, чтобы не менять подпись на лету. */
  loading: boolean;
  /** Уводит в сеть карт. */
  onOpen: () => void;
}

export const cardcoopHeaderState = ref<CardcoopHeaderState | null>(null);
