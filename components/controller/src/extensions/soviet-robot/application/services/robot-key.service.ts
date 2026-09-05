import { Inject, Injectable } from '@nestjs/common';
import { PrivateKey, PublicKey } from '@wharfkit/antelope';
import {
  ACCOUNT_PORT,
  LOGGER_PORT,
  SECRET_CIPHER_PORT,
  type IAccountPort,
  type ILoggerPort,
  type ISecretCipherPort,
} from '@coopenomics/innercoop';
import { ROBOT_PERMISSION } from '../../domain/constants';
import { ROBOT_KEY_REPOSITORY, type RobotKeyRepository } from '../../domain/repositories/robot-key.repository';
import { RobotChainService } from './robot-chain.service';

/** Состояние ключа робота у члена совета — то, что показывается в интерфейсе. */
export interface RobotKeyStatus {
  member: string;
  permission_name: string;
  has_key: boolean;
  public_key: string | null;
  /** На аккаунте есть разрешение робота. */
  chain_has_permission: boolean;
  /** Ключ в хранилище совпадает с ключом разрешения в цепи. */
  chain_key_matches: boolean;
  updated_at: Date | null;
}

/**
 * Хранилище ключей разрешений робота.
 *
 * Приватный ключ принимается один раз от самого члена совета, проверяется по
 * цепи (публичная часть должна стоять в его разрешении робота) и хранится
 * зашифрованным ключом кооператива. Наружу — только публичная часть; в логи
 * и ответы API приватный ключ не попадает. Расшифровка — только внутри подписи.
 */
@Injectable()
export class RobotKeyService {
  constructor(
    @Inject(ROBOT_KEY_REPOSITORY) private readonly keys: RobotKeyRepository,
    @Inject(SECRET_CIPHER_PORT) private readonly cipher: ISecretCipherPort,
    @Inject(ACCOUNT_PORT) private readonly accounts: IAccountPort,
    private readonly chain: RobotChainService,
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort
  ) {
    this.logger.setContext(RobotKeyService.name);
  }

  /** Сколько раз перечитать разрешения аккаунта, пока узел не отдаст свежее, и пауза между чтениями. */
  static PERMISSION_READ_ATTEMPTS = 6;
  static PERMISSION_READ_PAUSE_MS = 1000;

  /** Публичный ключ в едином представлении, чтобы сравнивать EOS… и PUB_K1_… формы. */
  static normalize(key: string): string {
    return PublicKey.from(key).toString();
  }

  private lastSeenPermissions: string[] = [];

  private async permissionKeys(member: string, permission_name: string): Promise<string[] | null> {
    const account = await this.accounts.getAccount(member);
    const permissions: any[] = account.blockchain_account?.permissions ?? [];
    this.lastSeenPermissions = permissions.map((p) => String(p.perm_name));
    // perm_name может прийти объектом Name из SDK узла, а не строкой — сравниваем по тексту
    const permission = permissions.find((p) => String(p.perm_name) === permission_name);
    if (!permission) return null;
    const keys: any[] = permission.required_auth?.keys ?? [];
    return keys.map((k) => RobotKeyService.normalize(String(k.key)));
  }

  async delegateKey(coopname: string, member: string, wif: string, requestedPermission?: string | null): Promise<RobotKeyStatus> {
    // Из GraphQL необязательное поле приходит как null, а не undefined — значение по умолчанию задаём сами.
    const permission_name = requestedPermission || ROBOT_PERMISSION;
    await this.assertCouncilMember(coopname, member);
    if (permission_name === 'active' || permission_name === 'owner') {
      throw new Error('Роботу выдаётся отдельное разрешение аккаунта, а не active или owner');
    }
    const publicKey = RobotKeyService.publicKeyOf(wif);
    const chainKeys = await this.waitPermissionKeys(member, permission_name);
    if (!chainKeys.includes(publicKey)) {
      throw new Error(`Ключ не принадлежит разрешению ${permission_name} аккаунта ${member}`);
    }

    await this.keys.upsert({ coopname, member, permission_name, encrypted_wif: this.cipher.encrypt(wif), public_key: publicKey });
    this.logger.info(`Принят ключ разрешения ${permission_name} члена совета ${member}`);
    return this.getStatus(coopname, member);
  }

  private async assertCouncilMember(coopname: string, member: string): Promise<void> {
    const board = await this.chain.getSovietBoard(coopname);
    if (!board || !board.members.some((m) => m.username === member)) {
      throw new Error('Ключ робота принимается только от члена совета кооператива');
    }
  }

  private static publicKeyOf(wif: string): string {
    try {
      return PrivateKey.from(wif).toPublic().toString();
    } catch {
      throw new Error('Приватный ключ не разобран: ожидается ключ в формате WIF');
    }
  }

  /**
   * Ключи разрешения из цепи. Разрешение выпускают той же секундой, что и
   * передают ключ, и узел может ещё не отдавать его — несколько повторных чтений.
   */
  private async waitPermissionKeys(member: string, permission_name: string): Promise<string[]> {
    for (let attempt = 0; attempt < RobotKeyService.PERMISSION_READ_ATTEMPTS; attempt += 1) {
      if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, RobotKeyService.PERMISSION_READ_PAUSE_MS));
      const keys = await this.permissionKeys(member, permission_name);
      if (keys) return keys;
    }
    throw new Error(
      `На аккаунте ${member} нет разрешения ${permission_name}: сначала выпустите его (в цепи видны: ${this.lastSeenPermissions.join(', ') || 'ничего'})`
    );
  }

  async revokeKey(coopname: string, member: string): Promise<boolean> {
    const removed = await this.keys.deleteByMember(coopname, member);
    if (removed) this.logger.info(`Ключ робота члена совета ${member} удалён из хранилища`);
    return removed;
  }

  async hasKey(coopname: string, member: string): Promise<boolean> {
    return (await this.keys.findByMember(coopname, member)) !== null;
  }

  async membersWithKeys(coopname: string): Promise<Set<string>> {
    return new Set((await this.keys.findAll(coopname)).map((k) => k.member));
  }

  /** Расшифрованный ключ — только для подписи; вызывающий не должен его хранить. */
  async getWif(coopname: string, member: string): Promise<{ wif: string; permission_name: string } | null> {
    const stored = await this.keys.findByMember(coopname, member);
    if (!stored) return null;
    return { wif: this.cipher.decrypt(stored.encrypted_wif), permission_name: stored.permission_name };
  }

  async getStatus(coopname: string, member: string): Promise<RobotKeyStatus> {
    const stored = await this.keys.findByMember(coopname, member);
    const permission_name = stored?.permission_name ?? ROBOT_PERMISSION;
    let chainKeys: string[] | null = null;
    try {
      chainKeys = await this.permissionKeys(member, permission_name);
    } catch (e: any) {
      this.logger.warn(`Не удалось прочитать разрешения аккаунта ${member}: ${e?.message}`);
    }
    return {
      member,
      permission_name,
      has_key: stored !== null,
      public_key: stored?.public_key ?? null,
      chain_has_permission: chainKeys !== null,
      chain_key_matches: stored !== null && chainKeys !== null && chainKeys.includes(stored.public_key),
      updated_at: stored?.updated_at ?? null,
    };
  }
}
