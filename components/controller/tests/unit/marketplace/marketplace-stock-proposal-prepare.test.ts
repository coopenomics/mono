/**
 * Предложение пайщику у стойки показывается только после того, как выдача по
 * каждому заказу начата (замечание владельца 20.11.2026, реестр
 * marketplace.issuance, mkt.iss.side.62).
 *
 * Оператор создаёт предложение: узел отмечает готовность заказа в цепи и
 * фиксирует факт у стойки — около шести секунд. Раньше узел записывал
 * предложение в начале этого шага; стол пайщика по ленте изменений открывал его
 * и просил документы на подпись, а выдачи ещё не было — пайщик получал
 * «Выдача по заказу не начата».
 */
import { MarketplaceStockProposalService } from '~/extensions/marketplace/application/services/marketplace-stock-proposal.service';
import { MarketplaceStockProposalDomainEntity } from '~/extensions/marketplace/domain/entities/marketplace-stock-proposal.entity';
import {
  MarketplaceStockProposalStatuses,
  type MarketplaceStockProposalStatus,
} from '~/extensions/marketplace/domain/entities/marketplace-stock-proposal.types';

const COOP = 'voskhod';

function proposalWith(status: MarketplaceStockProposalStatus) {
  const now = new Date();
  return new MarketplaceStockProposalDomainEntity({
    id: 'proposal-1',
    coopname: COOP,
    braname: 'krg',
    member_account: 'ant',
    operator_account: 'chairkrg',
    items: [
      { offer_id: 'offer-1', quantity: 50, unit_price: '138.0000', product_name: 'Молоко', unit_of_measure: null, order_id: 'order-1', order_hash: 'hash-1' },
    ],
    status,
    created_order_ids: [],
    resolved_at: null,
    created_at: now,
    updated_at: now,
  });
}

function build() {
  const calls: string[] = [];
  const proposalRepo = {
    create: jest.fn(async (input: { status?: MarketplaceStockProposalStatus }) => {
      calls.push(`create:${input.status}`);
      return proposalWith(input.status ?? MarketplaceStockProposalStatuses.PROPOSED);
    }),
    publish: jest.fn(async () => {
      calls.push('publish');
      return proposalWith(MarketplaceStockProposalStatuses.PROPOSED);
    }),
    applyResolution: jest.fn(async () => proposalWith(MarketplaceStockProposalStatuses.CANCELLED)),
  };
  const orderRepo = { findById: jest.fn(async () => ({ id: 'order-1', status: 'ACCEPTED_TO_COOP' })) };
  const issuanceService = {
    readyIssue: jest.fn(async () => void calls.push('readyIssue')),
    fixFact: jest.fn(async () => void calls.push('fixFact')),
  };
  const eventBus = { emit: jest.fn(() => void calls.push('emit')) };
  const logger = { setContext: jest.fn(), log: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() };
  const service = new MarketplaceStockProposalService(
    proposalRepo as any,
    {} as any,
    orderRepo as any,
    {} as any,
    issuanceService as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    eventBus as any,
    logger as any
  );
  jest.spyOn(service as any, 'buildOrderItems').mockResolvedValue([]);
  return { service, proposalRepo, issuanceService, eventBus, calls };
}

const input = {
  coopname: COOP,
  braname: 'krg',
  member_account: 'ant',
  operator_account: 'chairkrg',
  items: [],
  order_items: [{ order_id: 'order-1', actual_quantity: 50, actual_unit_price: '138.0000' }],
} as any;

describe('предложение пайщику у стойки: показ после начала выдачи', () => {
  it('предложение создаётся «готовится», выдача начинается, затем предложение показывается пайщику', async () => {
    const { service, calls } = build();
    const proposal = await service.createProposal(input);
    expect(calls).toEqual([`create:${MarketplaceStockProposalStatuses.PREPARING}`, 'readyIssue', 'fixFact', 'publish', 'emit']);
    expect(proposal.status).toBe(MarketplaceStockProposalStatuses.PROPOSED);
  });

  it('у стойки отметка готовности не уведомляет заказчика', async () => {
    const { service, issuanceService } = build();
    await service.createProposal(input);
    expect(issuanceService.readyIssue).toHaveBeenCalledWith(expect.objectContaining({ notify: false }));
  });

  it('выдача не началась — предложение отозвано и пайщику не показывается, оператор получает отказ', async () => {
    const { service, proposalRepo, issuanceService, eventBus } = build();
    issuanceService.fixFact.mockRejectedValueOnce(new Error('на складе пусто'));
    await expect(service.createProposal(input)).rejects.toThrow('на складе пусто');
    expect(proposalRepo.publish).not.toHaveBeenCalled();
    expect(proposalRepo.applyResolution).toHaveBeenCalledWith(
      'proposal-1',
      MarketplaceStockProposalStatuses.PREPARING,
      MarketplaceStockProposalStatuses.CANCELLED
    );
    expect(eventBus.emit).not.toHaveBeenCalled();
  });
});
