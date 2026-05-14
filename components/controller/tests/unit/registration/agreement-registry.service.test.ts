/**
 * Unit-тесты AgreementRegistryService (Эпик 1.1 плана C28-10).
 *
 * Покрывают:
 *   (a) register/unregister оферты и программы — happy path;
 *   (b) идемпотентность повторного register от того же extension_name;
 *   (c) collision при попытке зарегистрировать тот же id/key из другого
 *       extension_name → ConflictException;
 *   (d) unregister чужой записи проигнорирован без удаления;
 *   (e) listAgreementsForAccountType фильтрует по applicable_account_types;
 *   (f) listAgreementsForProgram возвращает оферты в порядке agreement_ids;
 *   (g) onExtensionTerminate чистит ровно записи этого extension_name,
 *       чужие сохраняются.
 *
 * @OnEvent-декоратор сам по себе тут не проверяется — обработчик вызывается
 * напрямую как обычный метод, что соответствует unit-уровню.
 */

import { ConflictException } from '@nestjs/common';
import { AccountType } from '~/application/account/enum/account-type.enum';
import { AgreementRegistryService } from '~/domain/registration/services/agreement-registry.service';
import type { AgreementRegistrationSpec } from '~/domain/registration/dto/agreement-registration-spec.dto';
import type { ProgramRegistrationSpec } from '~/domain/registration/dto/program-registration-spec.dto';

// ---------- helpers ----------

function makeLoggerStub() {
  return {
    setContext: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  } as any;
}

function makeAgreementSpec(
  partial: Partial<AgreementRegistrationSpec> & Pick<AgreementRegistrationSpec, 'id' | 'extension_name'>
): AgreementRegistrationSpec {
  return {
    id: partial.id,
    registry_id: partial.registry_id ?? 1000,
    agreement_type: partial.agreement_type ?? 'test-agreement',
    title: partial.title ?? 'Оферта',
    checkbox_text: partial.checkbox_text ?? 'Я прочитал и принимаю',
    link_text: partial.link_text ?? 'оферту',
    applicable_account_types: partial.applicable_account_types ?? [AccountType.individual],
    order: partial.order ?? 1,
    extension_name: partial.extension_name,
  };
}

function makeProgramSpec(
  partial: Partial<ProgramRegistrationSpec> & Pick<ProgramRegistrationSpec, 'key' | 'extension_name'>
): ProgramRegistrationSpec {
  return {
    key: partial.key,
    title: partial.title ?? 'Программа',
    description: partial.description ?? 'Описание',
    applicable_account_types: partial.applicable_account_types ?? [AccountType.individual],
    agreement_ids: partial.agreement_ids ?? [],
    order: partial.order ?? 1,
    extension_name: partial.extension_name,
  };
}

// ---------- tests ----------

describe('AgreementRegistryService', () => {
  let service: AgreementRegistryService;

  beforeEach(() => {
    service = new AgreementRegistryService(makeLoggerStub());
  });

  describe('registerAgreement', () => {
    it('регистрирует новую оферту и делает её доступной через getAgreement/listAgreements', () => {
      const spec = makeAgreementSpec({ id: 'capital_offer', extension_name: 'capital' });
      service.registerAgreement(spec);

      expect(service.getAgreement('capital_offer')).toEqual(spec);
      expect(service.listAgreements()).toEqual([spec]);
    });

    it('идемпотентен: повторный register от того же extension_name перезаписывает spec', () => {
      service.registerAgreement(
        makeAgreementSpec({ id: 'capital_offer', extension_name: 'capital', title: 'v1' })
      );
      service.registerAgreement(
        makeAgreementSpec({ id: 'capital_offer', extension_name: 'capital', title: 'v2' })
      );

      expect(service.getAgreement('capital_offer')!.title).toBe('v2');
      expect(service.listAgreements()).toHaveLength(1);
    });

    it('бросает ConflictException при попытке другого extension_name занять тот же id', () => {
      service.registerAgreement(makeAgreementSpec({ id: 'shared_offer', extension_name: 'capital' }));

      expect(() =>
        service.registerAgreement(makeAgreementSpec({ id: 'shared_offer', extension_name: 'order-table' }))
      ).toThrow(ConflictException);
    });

    it('listAgreements возвращает оферты в порядке order возрастания', () => {
      service.registerAgreement(makeAgreementSpec({ id: 'b', extension_name: 'capital', order: 2 }));
      service.registerAgreement(makeAgreementSpec({ id: 'a', extension_name: 'capital', order: 1 }));
      service.registerAgreement(makeAgreementSpec({ id: 'c', extension_name: 'capital', order: 3 }));

      expect(service.listAgreements().map((s) => s.id)).toEqual(['a', 'b', 'c']);
    });
  });

  describe('unregisterAgreement', () => {
    it('удаляет регистрацию владельца', () => {
      service.registerAgreement(makeAgreementSpec({ id: 'capital_offer', extension_name: 'capital' }));
      service.unregisterAgreement('capital_offer', 'capital');

      expect(service.getAgreement('capital_offer')).toBeNull();
    });

    it('игнорирует попытку чужого extension_name снять регистрацию', () => {
      service.registerAgreement(makeAgreementSpec({ id: 'capital_offer', extension_name: 'capital' }));
      service.unregisterAgreement('capital_offer', 'order-table');

      expect(service.getAgreement('capital_offer')).not.toBeNull();
    });

    it('no-op для отсутствующего id', () => {
      expect(() => service.unregisterAgreement('missing', 'capital')).not.toThrow();
    });
  });

  describe('registerProgram', () => {
    it('регистрирует программу и делает её доступной через getProgram/listPrograms', () => {
      const spec = makeProgramSpec({ key: 'generation', extension_name: 'capital' });
      service.registerProgram(spec);

      expect(service.getProgram('generation')).toEqual(spec);
      expect(service.listPrograms()).toEqual([spec]);
    });

    it('идемпотентен для того же extension_name', () => {
      service.registerProgram(
        makeProgramSpec({ key: 'generation', extension_name: 'capital', title: 'v1' })
      );
      service.registerProgram(
        makeProgramSpec({ key: 'generation', extension_name: 'capital', title: 'v2' })
      );

      expect(service.getProgram('generation')!.title).toBe('v2');
      expect(service.listPrograms()).toHaveLength(1);
    });

    it('бросает ConflictException при collision key между разными extension_name', () => {
      service.registerProgram(makeProgramSpec({ key: 'generation', extension_name: 'capital' }));

      expect(() =>
        service.registerProgram(makeProgramSpec({ key: 'generation', extension_name: 'order-table' }))
      ).toThrow(ConflictException);
    });
  });

  describe('listAgreementsForAccountType', () => {
    it('возвращает только оферты, в applicable_account_types которых входит запрошенный тип', () => {
      service.registerAgreement(
        makeAgreementSpec({
          id: 'individual_only',
          extension_name: 'capital',
          applicable_account_types: [AccountType.individual],
        })
      );
      service.registerAgreement(
        makeAgreementSpec({
          id: 'org_only',
          extension_name: 'capital',
          applicable_account_types: [AccountType.organization],
        })
      );
      service.registerAgreement(
        makeAgreementSpec({
          id: 'all',
          extension_name: 'capital',
          applicable_account_types: [AccountType.individual, AccountType.organization],
        })
      );

      const forIndividual = service.listAgreementsForAccountType(AccountType.individual).map((s) => s.id);
      expect(forIndividual.sort()).toEqual(['all', 'individual_only']);
    });
  });

  describe('listAgreementsForProgram', () => {
    it('возвращает оферты программы в порядке agreement_ids, пропуская незарегистрированные', () => {
      service.registerAgreement(makeAgreementSpec({ id: 'a', extension_name: 'capital', order: 3 }));
      service.registerAgreement(makeAgreementSpec({ id: 'b', extension_name: 'capital', order: 1 }));
      service.registerProgram(
        makeProgramSpec({
          key: 'generation',
          extension_name: 'capital',
          agreement_ids: ['b', 'a', 'missing'],
        })
      );

      expect(service.listAgreementsForProgram('generation').map((s) => s.id)).toEqual(['b', 'a']);
    });

    it('пустой массив для неизвестной программы', () => {
      expect(service.listAgreementsForProgram('unknown')).toEqual([]);
    });
  });

  describe('onExtensionTerminate', () => {
    it('чистит ровно записи завершённого расширения, чужие сохраняются', () => {
      service.registerAgreement(makeAgreementSpec({ id: 'capital_offer', extension_name: 'capital' }));
      service.registerAgreement(makeAgreementSpec({ id: 'order_offer', extension_name: 'order-table' }));
      service.registerProgram(makeProgramSpec({ key: 'generation', extension_name: 'capital' }));
      service.registerProgram(makeProgramSpec({ key: 'order_basic', extension_name: 'order-table' }));

      service.onExtensionTerminate({ appName: 'capital' });

      expect(service.getAgreement('capital_offer')).toBeNull();
      expect(service.getAgreement('order_offer')).not.toBeNull();
      expect(service.getProgram('generation')).toBeNull();
      expect(service.getProgram('order_basic')).not.toBeNull();
    });

    it('no-op если у расширения нет регистраций', () => {
      service.registerAgreement(makeAgreementSpec({ id: 'capital_offer', extension_name: 'capital' }));
      service.onExtensionTerminate({ appName: 'unused' });

      expect(service.listAgreements()).toHaveLength(1);
    });
  });
});
