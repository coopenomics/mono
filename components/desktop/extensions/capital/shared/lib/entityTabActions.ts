import { inject, provide, ref, type InjectionKey, type Ref } from 'vue';

/**
 * Место в строке разделов проекта/компонента, куда вложенная страница
 * переносит свои действия.
 *
 * Страница артефакта живёт внутри ProjectPage/ComponentPage, а её команды
 * («Редакции», избранное, «Сохранить») по решению владельца стоят в общей
 * строке разделов — вместо «+ Артефакт», а не отдельной строкой под
 * заголовком. Оболочка отдаёт элемент-хост через provide; вложенная страница
 * телепортирует в него свои кнопки. Пока хоста нет (оболочка грузит проект,
 * страница открыта вне оболочки), телепорт выключен и кнопки остаются на месте.
 */
const ENTITY_TAB_ACTIONS_HOST: InjectionKey<Ref<HTMLElement | null>> = Symbol(
  'capital.entityTabActionsHost',
);

/** Оболочка: завести хост и отдать его вложенным страницам */
export function provideEntityTabActionsHost(): Ref<HTMLElement | null> {
  const host = ref<HTMLElement | null>(null);
  provide(ENTITY_TAB_ACTIONS_HOST, host);
  return host;
}

/** Вложенная страница: хост строки разделов или null вне оболочки */
export function useEntityTabActionsHost(): Ref<HTMLElement | null> {
  return inject(ENTITY_TAB_ACTIONS_HOST, ref<HTMLElement | null>(null));
}
