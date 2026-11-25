import { ref } from 'vue';

/**
 * Отбор истории движений по одному кошельку пайщика на странице кошелька.
 * Карточку кошелька нажимают в одном виджете, история живёт в другом — значение
 * общее для обоих. `null` — все кошельки.
 */
export const walletMovementsFilter = ref<string | null>(null);

/** Нажатие на карточку кошелька: выбрать его либо снять отбор повторным нажатием. */
export function toggleWalletMovementsFilter(walletName: string): void {
  walletMovementsFilter.value = walletMovementsFilter.value === walletName ? null : walletName;
}
