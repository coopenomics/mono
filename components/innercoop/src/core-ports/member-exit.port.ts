/**
 * Выход пайщика из кооператива глазами расширения.
 *
 * Деньги и соглашения при выходе ведёт цепь: остатки кошельков собирает
 * контракт по таблице политики (EXIT_WALLET_POLICY), соглашения аннулирует
 * `wallet::revokeagree`. Расширению остаётся одно — сказать, почему пайщику
 * выходить сейчас рано: он ведёт курс, не сдал отчёт, не закрыл обязательство.
 *
 * Ядро собирает причины со всех расширений, показывает их пайщику в диалоге
 * выхода и отказывает в подаче заявления, пока список непуст.
 */

export interface InnerExitBlockersProvider {
  /** Расширение, которому принадлежит проверка; совпадает с его именем в реестре. */
  extension_name: string;
  /**
   * Причины, по которым пайщику нельзя выйти сейчас. Пустой массив — расширение
   * выходу не мешает. Текст пишется для пайщика: что случилось и что сделать.
   */
  blockers(coopname: string, username: string): Promise<string[]>;
}

export interface IMemberExitRegistryPort {
  registerExitBlockers(provider: InnerExitBlockersProvider): void;

  /**
   * Снять проверки расширения — при остановке или переустановке. Иначе после
   * перезапуска пайщик получил бы одну и ту же причину дважды.
   */
  unregisterExitBlockersByExtension(extensionName: string): void;
}

export const MEMBER_EXIT_REGISTRY_PORT = Symbol.for('Innercoop.CorePort.MemberExitRegistry');
