// infrastructure/blockchain/blockchain.service.ts
import { Injectable } from '@nestjs/common';
import { Action, API, Bytes, Name, PrivateKey, PublicKey, Signature } from '@wharfkit/antelope';
import { Table } from '@wharfkit/contract';
import { Session, TransactResult } from '@wharfkit/session';
import { WalletPluginPrivateKey } from '@wharfkit/wallet-plugin-privatekey';
import { AnoContract, RegistratorContract, SovietContract, SystemContract } from 'cooptypes';
import config from '~/config/config';
import { BlockchainPort } from '~/domain/common/ports/blockchain.port';
import type { ActiveKeysQuorum, EndorsementRecord, ServedCooperative } from '~/domain/common/ports/blockchain.port';
import { RpcPool } from './rpc-pool.service';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import type { GetInfoResult } from '~/types/shared/blockchain.types';
import type { BlockchainAccountInterface } from '~/types/shared';
import { VaultDomainService, VAULT_DOMAIN_SERVICE } from '~/domain/vault/services/vault-domain.service';
import { Inject } from '@nestjs/common';
import { normalizeAbiFloats } from './abi-float.normalizer';

/**
 * Индекс реестра кооперативов «по оператору». Третий по счёту после первичного:
 * порядок задан в самом контракте, и подписи у него нет — только номер.
 */
const BY_OPERATOR_INDEX = 'tertiary';

/**
 * «Такого аккаунта в цепи нет» — в отличие от «до цепи не достучались».
 *
 * Узел на запрос ABI несуществующего аккаунта отвечает не пустотой, а ошибкой
 * `account_query_exception` (HTTP 400). Для читающего это не сбой: контракта
 * просто нет в этой сети — обычное дело для свежего контура и тестовой сети.
 * Разбор по коду ошибки, а не по тексту; строка оставлена запасным вариантом,
 * потому что ошибка приходит из чужой библиотеки и оборачивается ею по-разному.
 */
/** Строка таблицы заверений — как её отдаёт узел, до приведения к записи. */
interface EndorsementRow {
  issuer: unknown;
  subject: unknown;
  chain_id: unknown;
  cert_key: unknown;
  expires_at: unknown;
  credential: unknown;
}

function isMissingAccount(e: unknown): boolean {
  const err = e as { error?: { name?: string; code?: number }; message?: string };
  if (err?.error?.name === 'account_query_exception' || err?.error?.code === 3060002) return true;
  const message = String(err?.message ?? '');
  return message.includes('account_query_exception')
    || message.includes('Account Query Exception')
    || message.includes('ABI контракта');
}

export type IndexPosition =
  | 'primary'
  | 'secondary'
  | 'tertiary'
  | 'fourth'
  | 'fifth'
  | 'sixth'
  | 'seventh'
  | 'eighth'
  | 'ninth'
  | 'tenth';

@Injectable()
export class BlockchainService implements BlockchainPort {
  private session!: Session;

  constructor(
    private readonly logger: WinstonLoggerService,
    private readonly rpcPool: RpcPool,
    @Inject(VAULT_DOMAIN_SERVICE) private readonly vaultDomainService: VaultDomainService
  ) {}

  public initialize(username: string, wif: string): void {
    this.session = new Session({
      actor: username,
      permission: 'active',
      chain: {
        id: config.blockchain.id,
        // write-путь идёт на текущий здоровый узел пула (Story 9.4); TaPoS-ссылка и
        // broadcast попадают на один узел (sticky), не размазываются round-robin.
        url: this.rpcPool.activeUrl(),
      },
      walletPlugin: new WalletPluginPrivateKey(PrivateKey.fromString(wif)),
    });
  }

  public async getInfo(): Promise<GetInfoResult> {
    return (await this.rpcPool.read((client) => client.v1.chain.get_info())).toJSON();
  }

  public async getAccount(name: string): Promise<BlockchainAccountInterface | null> {
    try {
      const result = (await this.rpcPool.read((client) => client.v1.chain.get_account(name))).toJSON();
      return result;
    } catch (e) {
      return null;
    }
  }

  /**
   * Кворумное чтение активных ключей (Story 9.7): опрашивает до `rpcQuorumSize`
   * здоровых узлов параллельно и сверяет нормализованные наборы активных ключей.
   * `agreed=true` при единственном доступном узле (single-source — проверить нечем);
   * `agreed=false` только при ≥2 расходящихся ответах (сигнал компрометации узла).
   */
  public async readActiveKeysQuorum(account: string): Promise<ActiveKeysQuorum> {
    const raw = await this.rpcPool.readFromHealthy(config.blockchain.rpcQuorumSize, async (client) => {
      const acc = (await client.v1.chain.get_account(account)).toJSON();
      return this.activeKeysOf(acc);
    });
    if (raw.length === 0) return { agreed: false, keys: [], samples: [] };
    const samples = raw.map((s) => ({ url: s.url, keys: [...s.value].map(normalizeKey).sort() }));
    const first = JSON.stringify(samples[0].keys);
    const agreed = samples.length < 2 || samples.every((s) => JSON.stringify(s.keys) === first);
    return { agreed, keys: samples[0].keys, samples };
  }

  /** Активные публичные ключи аккаунта COOPOS (plain JSON, без нормализации). */
  private activeKeysOf(account: unknown): string[] {
    try {
      const json = JSON.parse(JSON.stringify(account)) as {
        permissions?: Array<{ perm_name?: string; required_auth?: { keys?: Array<{ key?: string }> } }>;
      };
      const active = json.permissions?.find((p) => p.perm_name === 'active');
      return (active?.required_auth?.keys ?? []).map((k) => k.key).filter((k): k is string => typeof k === 'string');
    } catch {
      return [];
    }
  }

  public async transact(actionOrActions: any | any[], broadcast = true): Promise<TransactResult> {
    if (Array.isArray(actionOrActions)) {
      return this.sendActions(actionOrActions, broadcast);
    } else {
      return this.sendAction(actionOrActions, broadcast);
    }
  }

  private async formActionFromAbi(action: any): Promise<any> {
    const { abi } = (await this.rpcPool.read((client) => client.v1.chain.get_abi(action.account))) ?? { abi: undefined };
    return Action.from(action, abi);
  }

  private async sendAction(action: any, broadcast = true): Promise<TransactResult> {
    const formedAction = await this.formActionFromAbi(action);
    return await this.session.transact({ action: formedAction }, { broadcast });
  }

  private async sendActions(actions: any[], broadcast = true): Promise<TransactResult> {
    const data: Action[] = [];
    for (const action of actions) {
      const formedAction = await this.formActionFromAbi(action);
      data.push(formedAction);
    }

    return await this.session.transact({ actions: data }, { broadcast });
  }

  public async getAllRows<T = any>(code: string, scope: string, tableName: string): Promise<any[]> {
    return this.rpcPool.read(async (client) => {
      const { abi } = await client.v1.chain.get_abi(code);
      if (!abi) throw new Error(`ABI контракта ${code} не найден`);

      const table = new Table({
        abi,
        account: code,
        name: tableName,
        client,
      });

      const rows = await table.all({ scope });
      return normalizeAbiFloats(JSON.parse(JSON.stringify(rows)) as T[], abi, tableName);
    });
  }

  public async query<T = any>(
    code: string,
    scope: string,
    tableName: string,
    options: {
      indexPosition?: IndexPosition;
      from?: string | number;
      to?: string | number;
      maxRows?: number;
      keyType?: 'name' | 'sha256' | 'i64';
    } = { indexPosition: 'primary', keyType: 'i64' }
  ): Promise<T[]> {
    const { indexPosition = 'primary', from, to, maxRows, keyType } = options;

    return this.rpcPool.read(async (client) => {
      const { abi } = await client.v1.chain.get_abi(code);
      if (!abi) throw new Error(`ABI контракта ${code} не найден`);

      const table = new Table({
        abi,
        account: code,
        name: tableName,
        client,
      });
      const rows = await table.all({
        scope,
        index_position: indexPosition,
        key_type: keyType,
        from,
        to,
        maxRows,
      });
      return normalizeAbiFloats(JSON.parse(JSON.stringify(rows)) as T[], abi, tableName);
    });
  }

  public async getSingleRow<T = any>(
    code: string,
    scope: string,
    tableName: string,
    primaryKey: API.v1.TableIndexType,
    indexPosition: IndexPosition = 'primary',
    keyType: keyof API.v1.TableIndexTypes = 'i64'
  ): Promise<T | null> {
    return this.rpcPool.read(async (client) => {
      const { abi } = await client.v1.chain.get_abi(code);
      if (!abi) throw new Error(`ABI контракта ${code} не найден`);

      const table = new Table({
        abi,
        account: code,
        name: tableName,
        client,
      });

      const row = await table.get(primaryKey, {
        scope,
        index_position: indexPosition,
        key_type: keyType,
      });

      return row ? normalizeAbiFloats(JSON.parse(JSON.stringify(row)) as T, abi, tableName) : null;
    });
  }

  // Authentication related methods
  public async getCertPublicKey(accountName: string): Promise<string | null> {
    return this.getPermissionPublicKey(accountName, 'cert');
  }

  /**
   * Единственный ключ именованного разрешения аккаунта. Правило то же, что у права
   * заверения: один ключ, без делегирования — иначе проверить подпись нечем.
   */
  public async getPermissionPublicKey(accountName: string, permission: string): Promise<string | null> {
    const account = await this.getAccount(accountName);
    if (!account) return null;
    const accountJson = JSON.parse(JSON.stringify(account));
    const certPerm = accountJson.permissions?.find((p: any) => p.perm_name === permission);
    const auth = certPerm?.required_auth;
    // строго single-key cert-permission: один ключ, без делегирования (accounts/waits)
    if (!auth || auth.threshold !== 1 || auth.keys?.length !== 1 || auth.accounts?.length || auth.waits?.length)
      return null;
    try {
      return PublicKey.from(auth.keys[0].key).toString();
    } catch {
      return auth.keys[0].key ?? null;
    }
  }

  /**
   * Публикует право заверения `cert` кооператива: ровно один ключ, без делегирования.
   * Строгость не формальность — цепь доверия удостоверения должна вести к конкретному
   * ключу, а не к набору подписантов, иначе проверить подпись нечем.
   *
   * Подписывает сам кооператив своим распорядительным ключом; право заверения отдельно
   * именно затем, чтобы подпись удостоверений и распоряжение средствами не совпадали.
   */
  public async publishCertPermission(account: string, publicKey: string, signer?: string): Promise<void> {
    // Подписывает либо сам аккаунт, либо кооператив, которому переданы его
    // распорядительные права: цепь разрешает подпись по делегированию, а полномочие
    // указывается всё равно от имени аккаунта, которому меняют право.
    const signerAccount = signer ?? account;
    const signerWif = await this.vaultDomainService.getWif(signerAccount);
    if (!signerWif)
      throw new Error(`Нет ключа кооператива ${signerAccount} — опубликовать право заверения нечем`);

    this.initialize(signerAccount, signerWif);
    await this.transact({
      account: 'eosio',
      name: 'updateauth',
      authorization: [{ actor: account, permission: 'active' }],
      data: {
        account,
        permission: 'cert',
        parent: 'active',
        auth: {
          threshold: 1,
          keys: [{ key: publicKey, weight: 1 }],
          accounts: [],
          waits: [],
        },
      },
    });
  }

  /**
   * Заверение субъекта, выданное якорем доверия. `null` — заверения нет.
   *
   * Отсутствие самого якоря — это тоже «заверения нет», а не сбой. В сети, где
   * аккаунт `ano` ещё не заведён (свежий контур, тестовая сеть), узел отвечает на
   * запрос его ABI ошибкой `account_query_exception`, и без разбора она уезжала
   * наверх как недоступность цепи. Дальше `CertificateService` отказывался
   * выпускать удостоверение вообще — хотя там прямо написано обратное: «пустая
   * цепочка — не ошибка, отказать было бы хуже: пайщик не виноват, что кооператив
   * выпал из цепочки». Задуманное состояние (удостоверение выпущено, в карточке
   * честная пометка «не утверждено АНО») было недостижимо, а пайщик видел
   * «удостоверение ещё не выпущено» и ничего не мог с этим сделать.
   *
   * Настоящую недоступность цепи по-прежнему пробрасываем: она означает, что
   * заверение, возможно, есть, просто мы его не прочитали, — и выдавать в этом
   * случае удостоверение с пустой цепочкой нельзя.
   */
  public async getEndorsement(subject: string): Promise<EndorsementRecord | null> {
    const contract = AnoContract.contractName.production;
    let row: EndorsementRow | null;
    try {
      row = await this.getSingleRow<EndorsementRow>(contract, contract, AnoContract.Tables.Endorsements.tableName, Name.from(subject));
    }
    catch (e) {
      if (isMissingAccount(e)) return null;
      throw e;
    }
    if (!row) return null;
    return {
      issuer: String(row.issuer),
      subject: String(row.subject),
      chain_id: String(row.chain_id),
      cert_key: String(row.cert_key),
      expires_at: String(row.expires_at),
      credential: String(row.credential),
    };
  }

  /**
   * Кооперативы, у которых оператором указан `operator`.
   *
   * Читается по индексу «по оператору»: перебирать весь реестр ради нескольких
   * записей незачем, а у оператора их со временем станет много. Совпадение поля
   * сверяется ещё раз уже здесь — узел отдаёт диапазон индекса, и брать его на
   * веру, когда от этого зависит, кому выдавать заверение, не стоит.
   */
  public async getServedCooperatives(operator: string): Promise<ServedCooperative[]> {
    const contract = RegistratorContract.contractName.production;
    const rows = await this.query(contract, contract, RegistratorContract.Tables.Cooperatives.tableName, {
      indexPosition: BY_OPERATOR_INDEX,
      from: operator,
      to: operator,
      keyType: 'name',
    });
    return rows
      .filter((row: any) => String(row.parent_username) === operator && String(row.username) !== operator)
      .map((row: any) => ({ username: String(row.username), status: String(row.status ?? '') }));
  }

  /**
   * Записывает заверение в цепочку доверия.
   *
   * Подписывает заверяющий. Если у установки нет его ключа — а ключей АНО у неё и
   * не должно быть, — подпись ставит тот, кому переданы распорядительные права;
   * полномочие при этом всё равно указывается от имени заверяющего.
   */
  public async publishEndorsement(endorsement: EndorsementRecord, signer?: string): Promise<void> {
    const signerAccount = signer ?? endorsement.issuer;
    const signerWif = await this.vaultDomainService.getWif(signerAccount);
    if (!signerWif) throw new Error(`Нет ключа ${signerAccount} — подписать заверение нечем`);

    this.initialize(signerAccount, signerWif);
    await this.transact({
      account: AnoContract.contractName.production,
      name: AnoContract.Actions.Endorse.actionName,
      authorization: [{ actor: endorsement.issuer, permission: 'active' }],
      data: {
        issuer: endorsement.issuer,
        subject: endorsement.subject,
        chain_id: endorsement.chain_id,
        cert_key: endorsement.cert_key,
        expires_at: endorsement.expires_at,
        credential: endorsement.credential,
      },
    });
  }

  /**
   * Указан ли `steward` в распорядительных правах аккаунта как аккаунт. Именно так
   * кооператив ведёт чужой аккаунт, не владея его ключами: права передаются по
   * имени, и подпись кооператива удовлетворяет полномочие.
   */
  public async canManageAccount(account: string, steward: string): Promise<boolean> {
    const acc = await this.getAccount(account);
    if (!acc) return false;
    const json = JSON.parse(JSON.stringify(acc)) as {
      permissions?: { perm_name?: string; required_auth?: { accounts?: { permission?: { actor?: string } }[] } }[];
    };
    return (json.permissions ?? [])
      .filter((p) => p.perm_name === 'owner' || p.perm_name === 'active')
      .some((p) => (p.required_auth?.accounts ?? []).some((a) => a.permission?.actor === steward));
  }

  public recoverPublicKey(message: string, signature: string): string {
    // recoverMessage хэширует utf8-байты (Checksum256) и восстанавливает pubkey —
    // байт-в-байт зеркало клиентского PrivateKey.signMessage (SDK signTimestamp).
    return Signature.from(signature).recoverMessage(Bytes.fromString(message, 'utf8')).toString();
  }

  public hasActiveKey(account: BlockchainAccountInterface, publicKey: string): boolean {
    // Преобразуем объект аккаунта в обычный JSON для работы со строками (Wharfkit возвращает свои объекты)
    const accountJson = JSON.parse(JSON.stringify(account));
    const activePermissions = accountJson.permissions.find((p) => p.perm_name === 'active');
    if (!activePermissions) return false;

    // Нормализуем переданный ключ через PublicKey для обеспечения совместимости форматов
    let normalizedPublicKey: string;
    try {
      normalizedPublicKey = PublicKey.from(publicKey).toString();
    } catch (error) {
      // Если не удается нормализовать, используем как есть
      console.warn('Не удалось нормализовать публичный ключ:', error);
      normalizedPublicKey = publicKey;
    }

    const hasKey = activePermissions.required_auth.keys.some((key) => {
      // Проверяем точное совпадение
      if (key.key === normalizedPublicKey) return true;

      // Проверяем совпадение после нормализации ключа из аккаунта
      try {
        const normalizedAccountKey = PublicKey.from(key.key).toString();
        return normalizedAccountKey === normalizedPublicKey;
      } catch (error) {
        // Если не удается нормализовать ключ аккаунта, сравниваем как строки
        return false;
      }
    });

    return hasKey;
  }

  public async getCooperative(coopname: string): Promise<any> {
    const cooperative = await this.getSingleRow(
      RegistratorContract.contractName.production,
      RegistratorContract.contractName.production,
      RegistratorContract.Tables.Cooperatives.tableName,
      Name.from(coopname)
    );
    return cooperative;
  }

  public async changeKey(data: RegistratorContract.Actions.ChangeKey.IChangeKey): Promise<void> {
    // Инициализируем сессию перед транзакцией
    const wif = await this.vaultDomainService.getWif(config.coopname);
    if (!wif) throw new Error(`Не найден приватный ключ для кооператива ${config.coopname}`);

    this.initialize(config.coopname, wif);

    const actions = [
      {
        account: RegistratorContract.contractName.production,
        name: RegistratorContract.Actions.ChangeKey.actionName,
        authorization: [
          {
            actor: config.coopname,
            permission: 'active',
          },
        ],
        data,
      },
    ];

    await this.transact(actions);
  }

  public async powerUp(username: string, quantity: string): Promise<void> {
    // Инициализируем сессию перед транзакцией
    const wif = await this.vaultDomainService.getWif(username);
    if (!wif) throw new Error(`Не найден приватный ключ для аккаунта ${username}`);

    this.initialize(username, wif);

    const data: SystemContract.Actions.Powerup.IPowerup = {
      payer: username,
      receiver: username,
      days: 1,
      payment: quantity,
      transfer: false,
    };

    const actions = [
      {
        account: 'eosio',
        name: 'powerup',
        authorization: [
          {
            actor: username,
            permission: 'active',
          },
        ],
        data,
      },
    ];

    try {
      await this.transact(actions);
    } catch (error) {
      this.logger.info('Предупреждение при выполнении транзакции powerup:', String(error));
    }
  }

  public async addUser(data: RegistratorContract.Actions.AddUser.IAddUser): Promise<void> {
    // Инициализируем сессию перед транзакцией
    const wif = await this.vaultDomainService.getWif(config.coopname);
    if (!wif) throw new Error(`Не найден приватный ключ для кооператива ${config.coopname}`);

    this.initialize(config.coopname, wif);

    const actions = [
      {
        account: RegistratorContract.contractName.production,
        name: RegistratorContract.Actions.AddUser.actionName,
        authorization: [
          {
            actor: config.coopname,
            permission: 'active',
          },
        ],
        data,
      },
    ];

    await this.transact(actions);
  }

  public async createBoard(data: SovietContract.Actions.Boards.CreateBoard.ICreateboard): Promise<void> {
    // Инициализируем сессию перед транзакцией
    const wif = await this.vaultDomainService.getWif(config.coopname);
    if (!wif) throw new Error(`Не найден приватный ключ для кооператива ${config.coopname}`);

    this.initialize(config.coopname, wif);

    const actions = [
      {
        account: SovietContract.contractName.production,
        name: SovietContract.Actions.Boards.CreateBoard.actionName,
        authorization: [
          {
            actor: config.coopname,
            permission: 'active',
          },
        ],
        data,
      },
    ];

    await this.transact(actions);
  }
}

/** Нормализация публичного ключа в канон `PUB_K1_…` (терпит уже-валидные/чужие форматы). */
function normalizeKey(key: string): string {
  try {
    return PublicKey.from(key).toString();
  } catch {
    return key;
  }
}
