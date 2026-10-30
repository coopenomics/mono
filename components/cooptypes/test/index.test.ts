import { describe, expect, it } from 'vitest'
import * as cooptypes from '../src'

describe('cooptypes exports', () => {
  it('exports core contract namespaces', () => {
    expect(cooptypes.SovietContract).toBeDefined()
    expect(cooptypes.RegistratorContract).toBeDefined()
    expect(cooptypes.DraftContract).toBeDefined()
    expect(cooptypes.TokenContract).toBeDefined()
    expect(cooptypes.WalletContract).toBeDefined()
    expect(cooptypes.CapitalContract).toBeDefined()
    expect(cooptypes.GatewayContract).toBeDefined()
    expect(cooptypes.MeetContract).toBeDefined()
    expect(cooptypes.FundContract).toBeDefined()
    expect(cooptypes.LedgerContract).toBeDefined()
    expect(cooptypes.MarketContract).toBeDefined()
    expect(cooptypes.EdubridgeContract).toBeDefined()
    expect(cooptypes.BranchContract).toBeDefined()
  })

  // Модель документа, субъекты и реквизиты — в @coopenomics/docs-templates.
  it('exports Cooperative namespace with chain documents and blockchain types', () => {
    expect(cooptypes.Cooperative).toBeDefined()
    expect(cooptypes.Cooperative.Document.canonicalizationForVersion).toBeDefined()
  })

  it('exports Interfaces', () => {
    expect(cooptypes.Interfaces).toBeDefined()
  })

  it('contract names are non-empty strings', () => {
    expect(typeof cooptypes.SovietContract.contractName.production).toBe('string')
    expect(cooptypes.SovietContract.contractName.production.length).toBeGreaterThan(0)
    expect(typeof cooptypes.DraftContract.contractName.production).toBe('string')
    expect(cooptypes.DraftContract.contractName.production.length).toBeGreaterThan(0)
  })
})
