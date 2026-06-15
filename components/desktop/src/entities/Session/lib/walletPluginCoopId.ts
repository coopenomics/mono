import {
  AbstractWalletPlugin,
  Checksum256,
  Signature,
  Transaction,
  WalletPluginMetadata,
} from '@wharfkit/session';
import type {
  LoginContext,
  ResolvedSigningRequest,
  TransactContext,
  WalletPluginLoginResponse,
  WalletPluginSignResponse,
} from '@wharfkit/session';
import { signChainDigest } from '@coopenomics/auth';

export interface WalletPluginCoopIdOptions {
  /** Публичный ключ пайщика для metadata (из keystore @coopenomics/auth). */
  publicKey?: string;
  /**
   * Хук, гарантирующий разблокировку keystore перед подписью: авто-unlock по
   * локальному ПИН-кэшу при дефолтном ПИН (прозрачно), либо запрос ПИН при
   * кастомном. Вызывается перед КАЖДОЙ подписью — это единственная точка
   * перехвата «ключ должен быть доступен» для всех session.transact. Внедряется
   * из session.init (Эпик 7 шаг 4). Если не задан — подпись идёт напрямую и
   * бросит WalletLocked, когда keystore заперт.
   */
  ensureUnlocked?: () => Promise<void>;
}

/**
 * WalletPlugin контура CoopID (мост подписи, Эпик 7). Подписывает транзакции
 * COOPOS, НЕ извлекая приватный ключ: как Ledger/Anchor-плагины, он получает от
 * keystore готовую подпись, а не ключ. Считает signing-дайджест из резолвленной
 * транзакции и делегирует подпись в `@coopenomics/auth.signChainDigest`, который
 * подписывает ключом из RAM-keystore (Story 2.2) и возвращает только `SIG_K1_…`.
 * Так wharfkit `Session.transact()` подписывает «чужими руками», не зная WIF —
 * ключ остаётся в keystore и из него не выходит (инвариант RAM-only).
 *
 * Заменяет на десктопе путь подписи через `WalletPluginPrivateKey(globalStore.wif)`
 * (легаси-контур, где расшифрованный WIF лежал в pinia/IndexedDB).
 */
export class WalletPluginCoopId extends AbstractWalletPlugin {
  private readonly ensureUnlocked?: () => Promise<void>;

  constructor(options: WalletPluginCoopIdOptions = {}) {
    super();
    this.ensureUnlocked = options.ensureUnlocked;
    // Конструктивно не требует выбора цепи/прав: Session строится напрямую с уже
    // известными actor/permission/chain после CoopID-входа.
    this.config = {
      requiresChainSelect: false,
      requiresPermissionSelect: false,
    };
    this.metadata = WalletPluginMetadata.from({
      name: 'CoopID',
      description:
        'Подпись ключом пайщика из защищённого keystore CoopID; приватный ключ не покидает устройство.',
    });
    if (options.publicKey) this.metadata.publicKey = options.publicKey;
  }

  get id(): string {
    return 'coopid';
  }

  /**
   * Вход не используется при прямом построении Session (actor/permission уже
   * известны после CoopID-входа). Реализован для совместимости с интерфейсом —
   * возвращает цепь и permission из контекста (как `WalletPluginPrivateKey`).
   */
  async login(context: LoginContext): Promise<WalletPluginLoginResponse> {
    if (!context.permissionLevel)
      throw new Error('WalletPluginCoopId.login требует permissionLevel');
    const chain = context.chain ? context.chain.id : context.chains[0].id;
    return { chain, permissionLevel: context.permissionLevel };
  }

  async sign(
    resolved: ResolvedSigningRequest,
    context: TransactContext,
  ): Promise<WalletPluginSignResponse> {
    if (this.ensureUnlocked) await this.ensureUnlocked();
    const transaction = Transaction.from(resolved.transaction);
    const digest = transaction.signingDigest(Checksum256.from(context.chain.id));
    // signChainDigest принимает hex-строку дайджеста (а не Checksum256) намеренно —
    // чтобы не пересекать границу пакета двумя копиями antelope (см. signing/index.ts).
    const signature = Signature.from(await signChainDigest(String(digest)));
    return { signatures: [signature] };
  }
}
