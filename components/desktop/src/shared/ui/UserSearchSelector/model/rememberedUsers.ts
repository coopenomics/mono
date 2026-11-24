import type { UserSearchResult } from './types';

/**
 * Пайщики, выбранные в полях выбора за время жизни вкладки, по имени аккаунта.
 * Поле, смонтированное заново с уже выбранным значением, берёт данные из этого кэша,
 * чтобы показать ФИО: поиск по имени аккаунта не ищет.
 */
export const rememberedUsers = new Map<string, UserSearchResult>();
