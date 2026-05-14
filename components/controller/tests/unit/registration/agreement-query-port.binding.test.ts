/**
 * Контрактный тест AGREEMENT_QUERY_PORT (Эпик 2.1).
 *
 * Цели:
 *   1. TypeScript structural check: AgreementConfigurationService
 *      реализует интерфейс AgreementQueryPort (без явного `implements`,
 *      биндинг useExisting в registration-domain.module работает только
 *      если структуры совпадают);
 *   2. Smoke: 4 базовые платформенные оферты возвращаются для individual;
 *   3. Smoke: при пустом AgreementRegistry список программ пуст.
 *
 * @nestjs/testing в репо не установлен — реальный binding-тест
 * (что Nest-контейнер выдаёт тот же singleton через @Inject) проверяется
 * косвенно через runtime smoke: coopback стартует без UnknownDependencies.
 */

import { AgreementConfigurationService } from '~/domain/registration/services/agreement-configuration.service';
import { AgreementRegistryService } from '~/domain/registration/services/agreement-registry.service';
import { CooperativeConfigService } from '~/domain/registration/services/cooperative-config.service';
import type { AgreementQueryPort } from '~/domain/registration/ports/agreement-query.port';
import { AccountType } from '~/application/account/enum/account-type.enum';

function makeLoggerStub() {
  return {
    setContext: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  } as any;
}

function makeService() {
  const cooperativeConfig = new CooperativeConfigService();
  const registry = new AgreementRegistryService(makeLoggerStub());
  return new AgreementConfigurationService(cooperativeConfig, registry);
}

describe('AgreementQueryPort contract', () => {
  it('AgreementConfigurationService structurally реализует AgreementQueryPort', () => {
    const service = makeService();

    // структурный assign: если хоть один метод не соответствует —
    // tsc не пропустит, и тест даже не запустится.
    const port: AgreementQueryPort = service;
    expect(typeof port.getAgreementsForAccountType).toBe('function');
    expect(typeof port.getAgreementById).toBe('function');
    expect(typeof port.getAgreementsForProgram).toBe('function');
    expect(typeof port.getAvailablePrograms).toBe('function');
  });

  it('для individual возвращает 4 платформенные оферты (signature/wallet/user/privacy)', () => {
    const port: AgreementQueryPort = makeService();

    const agreements = port.getAgreementsForAccountType(AccountType.individual, 'voskhod');
    const ids = agreements.map((a) => a.id).sort();

    expect(ids).toEqual(
      ['privacy_agreement', 'signature_agreement', 'user_agreement', 'wallet_agreement'].sort()
    );
  });

  it('при пустом реестре getAvailablePrograms возвращает пустой массив', () => {
    const port: AgreementQueryPort = makeService();

    expect(port.getAvailablePrograms('voskhod', AccountType.individual)).toEqual([]);
  });

  it('getAgreementById для платформенной оферты возвращает запись', () => {
    const port: AgreementQueryPort = makeService();

    const wallet = port.getAgreementById('wallet_agreement');
    expect(wallet).not.toBeNull();
    expect(wallet?.agreement_type).toBe('wallet');
  });

  it('getAgreementById для незарегистрированного id возвращает null', () => {
    const port: AgreementQueryPort = makeService();

    expect(port.getAgreementById('does_not_exist')).toBeNull();
  });
});
