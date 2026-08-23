export const NOT_ME_TOKEN_STORE = Symbol('NotMeTokenStore');

/**
 * Порт одноразового токена «Это не я» (CoopID, Story 3.10).
 *
 * Токен вкладывается в уведомление о подозрительном входе (3.9) как one-click ссылка и
 * позволяет пайщику отозвать все сессии **без активной сессии** (его собственная может
 * быть скомпрометирована). Поэтому токен — самостоятельный секрет (не JWT, не привязан к
 * сессии), single-use, с окном в несколько дней на реакцию.
 */
export interface INotMeTokenStore {
  /** Выпустить токен для пайщика; возвращает строку токена для ссылки. */
  issue(subjectId: string): Promise<string>;
  /** Атомарно потребить токен → subjectId (single-use); null, если недействителен/истёк. */
  consume(token: string): Promise<string | null>;
}
