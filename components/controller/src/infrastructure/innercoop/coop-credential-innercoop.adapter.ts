/**
 * Адаптер порта удостоверения кооператива (`COOP_CREDENTIAL_PORT`).
 *
 * Сводит вместе то, что расширению нужно для выпуска документа во внешнюю сеть:
 * подпись ключом заверения, цепочку признания и идентификатор сети. Каждая часть
 * живёт в ядре по отдельности — ключ в `CertKeyService`, заверения в цепи, — и
 * собирать их в расширении означало бы дать ему доступ к ключам и к цепи разом.
 */
import { Inject, Injectable } from '@nestjs/common';
import type { ICoopCredentialPort, InnerEndorsementCredential } from '@coopenomics/innercoop';
import config from '~/config/config';
import { CertKeyService } from '~/application/auth-v2/certificate/cert-key.service';
import { BLOCKCHAIN_PORT } from '~/domain/common/ports/blockchain.port';
import type { BlockchainPort } from '~/domain/common/ports/blockchain.port';

/**
 * Предел длины цепочки признания.
 *
 * Цепочка строится ходом «кто заверил заверителя» и в норме короткая: кооператив
 * → оператор → якорь. Ограничение защищает от кольца в данных цепи: без него
 * ошибочная запись, где заверитель заверяет сам себя, увела бы обход в
 * бесконечность.
 */
const MAX_CHAIN_DEPTH = 8;

@Injectable()
export class CoopCredentialInnercoopAdapter implements ICoopCredentialPort {
  constructor(
    private readonly certKeyService: CertKeyService,
    @Inject(BLOCKCHAIN_PORT) private readonly blockchain: BlockchainPort
  ) {}

  async signWithCertKey(message: Uint8Array): Promise<string> {
    return this.certKeyService.signChainMessage(message);
  }

  /**
   * Цепочка признания от корня к кооперативу.
   *
   * Идём снизу вверх — от кооператива к тому, кто его заверил, — и в конце
   * разворачиваем: проверяющая сторона читает цепочку от корня, иначе первое же
   * звено окажется без известного ей заверителя. Обход прекращается, когда
   * заверитель совпал с заверяемым (звено якоря, дальше некуда) либо заверения
   * больше нет.
   */
  async getTrustChain(): Promise<InnerEndorsementCredential[]> {
    const chain: InnerEndorsementCredential[] = [];
    const visited = new Set<string>();
    let subject = config.coopname;

    for (let depth = 0; depth < MAX_CHAIN_DEPTH; depth += 1) {
      if (visited.has(subject)) break;
      visited.add(subject);

      const endorsement = await this.blockchain.getEndorsement(subject);
      if (!endorsement) break;

      chain.push(endorsement.credential);
      if (endorsement.issuer === subject) break;
      subject = endorsement.issuer;
    }

    return chain.reverse();
  }

  async getChainId(): Promise<string> {
    return (await this.blockchain.getInfo()).chain_id;
  }

  async getPermissionKey(account: string, permission: string): Promise<string | null> {
    return this.blockchain.getPermissionPublicKey(account, permission);
  }
}
