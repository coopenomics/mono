import { describe, expect, it } from 'vitest'
import { BillingContract, Cooperative, Interfaces } from '../src'
import { LEDGER2_PROCESS_REGISTRY } from '../src/ledger2/processes'
import { LEDGER2_OPERATION_REGISTRY } from '../src/ledger2/operations'

/**
 * Тесты cooptypes под Epic 12 Single-Hub v5:
 *  - IConvert содержит convert_hash (детерминированный process-якорь);
 *  - 1095.BillingConversionStatement зарегистрирован в Cooperative.Registry;
 *  - ledger2 processes p.bil.fund + p.bil.pay присутствуют;
 *  - ledger2 operations o.bil.fund + o.bil.pay привязаны к правильным процессам;
 *  - в реестре нет Tables.Payments (v5 контракт billing без своих таблиц).
 */
describe('cooptypes — Epic 12 Single-Hub v5', () => {
  describe('BillingContract', () => {
    it('экспортирует contractName и Actions Convert/Pay', () => {
      expect(BillingContract).toBeDefined()
      expect(BillingContract.contractName).toBeDefined()
      expect(BillingContract.Actions).toBeDefined()
      expect(BillingContract.Actions.Convert).toBeDefined()
      expect(BillingContract.Actions.Pay).toBeDefined()
    })

    it('НЕ экспортирует Tables (v5 контракт billing без своих таблиц)', () => {
      expect((BillingContract as any).Tables).toBeUndefined()
    })
  })

  describe('Interfaces.Billing.IConvert', () => {
    it('тип содержит convert_hash (sha256-якорь процесса billing::convert)', () => {
      const convertInput: Interfaces.Billing.IConvert = {
        coopname: 'voskhod',
        username: 'ant',
        amount: '100.0000 AXON',
        convert_hash: 'a'.repeat(64),
        document: {
          version: '1',
          hash: 'b'.repeat(64),
          doc_hash: 'c'.repeat(64),
          meta_hash: 'd'.repeat(64),
          meta: '{}',
          signatures: [],
        },
      }
      expect(convertInput.convert_hash).toHaveLength(64)
    })
  })

  describe('Cooperative.Registry.BillingConversionStatement', () => {
    it('registry_id = 1095', () => {
      expect(Cooperative.Registry.BillingConversionStatement.registry_id).toBe(1095)
    })

    it('имеет title и description (DTO для desktop)', () => {
      expect(Cooperative.Registry.BillingConversionStatement.title).toBeTruthy()
      expect(Cooperative.Registry.BillingConversionStatement.description).toBeTruthy()
    })
  })

  describe('ledger2 processes registry', () => {
    it('содержит p.bil.fund → billing::CONVERT', () => {
      const entry = LEDGER2_PROCESS_REGISTRY.find((p) => p.type === 'p.bil.fund')
      expect(entry).toBeDefined()
      expect(entry?.contract).toBe('billing')
      expect(entry?.name).toBe('CONVERT')
    })

    it('содержит p.bil.pay → billing::PAY', () => {
      const entry = LEDGER2_PROCESS_REGISTRY.find((p) => p.type === 'p.bil.pay')
      expect(entry).toBeDefined()
      expect(entry?.contract).toBe('billing')
      expect(entry?.name).toBe('PAY')
    })
  })

  describe('ledger2 operations registry', () => {
    it('содержит o.bil.fund → process_type p.bil.fund (contract: billing)', () => {
      const entry = LEDGER2_OPERATION_REGISTRY.find((o) => o.code === 'o.bil.fund')
      expect(entry).toBeDefined()
      expect(entry?.process_type).toBe('p.bil.fund')
      expect(entry?.contract).toBe('billing')
    })

    it('содержит o.bil.pay → process_type p.bil.pay (contract: billing)', () => {
      const entry = LEDGER2_OPERATION_REGISTRY.find((o) => o.code === 'o.bil.pay')
      expect(entry).toBeDefined()
      expect(entry?.process_type).toBe('p.bil.pay')
      expect(entry?.contract).toBe('billing')
    })
  })
})
