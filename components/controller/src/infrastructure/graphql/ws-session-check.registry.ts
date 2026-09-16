/**
 * Мостик от `GraphQLModule.forRoot` к проверке живости сессии.
 *
 * `forRoot` статичен: его `onConnect` выполняется вне графа модулей и провайдера
 * в себя не инжектит, а перевод всего модуля на `forRootAsync` ради одной функции
 * тянет за собой инициализацию схемы. Поэтому направление обратное — не ws просит
 * зависимость, а владелец проверки кладёт её сюда (тот же приём, что с реестрами
 * расширений: см. `forwardRef` в CLAUDE.md контроллера).
 *
 * До появления этого мостика ws проверял у токена только подпись и тип, из-за чего
 * отозванная сессия оставалась наполовину живой — подписки работали, HTTP отвечал
 * «Сессия завершена».
 */
type WsSessionCheck = (sessionId: unknown, username: string) => Promise<boolean>;

let check: WsSessionCheck | null = null;

/** Владелец проверки (`SessionAliveService`) отдаёт её веб-сокету. */
export function registerWsSessionCheck(fn: WsSessionCheck): void {
  check = fn;
}

/**
 * Жива ли сессия токена, пришедшего в ws-соединении.
 *
 * Проверка ещё не зарегистрирована — соединение отклоняем. Это осознанно строгий
 * выбор: пропускать «пока некому проверить» значит воспроизводить ровно ту дыру,
 * ради которой мостик и заведён, а регистрация происходит при создании провайдера,
 * то есть до приёма первого соединения.
 */
export async function isWsSessionAlive(sessionId: unknown, username: string): Promise<boolean> {
  if (!check) return false;
  return check(sessionId, username);
}
