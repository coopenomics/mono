import { computed } from 'vue';
import { useDesktopStore } from 'src/entities/Desktop/model';

/** Может ли вошедший писать и включать шаблоны — право выдаёт сервер председателю. */
export function useCanManageGreetings() {
  const desktop = useDesktopStore();
  return computed(() => desktop.hasGrant('greetings', 'Greetings:manage'));
}
