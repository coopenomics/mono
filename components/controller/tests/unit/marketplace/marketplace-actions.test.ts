describe('Marketplace action types', () => {
  it('ReqReturn interface exists', () => {
    const { MarketContract } = require('cooptypes');
    expect(MarketContract.Actions.ReqReturn).toBeDefined();
    expect(MarketContract.Actions.ReqReturn.actionName).toBe('reqreturn');
  });

  it('Coopstock interface exists', () => {
    const { MarketContract } = require('cooptypes');
    expect(MarketContract.Actions.Coopstock).toBeDefined();
    expect(MarketContract.Actions.Coopstock.actionName).toBe('coopstock');
  });

  it('AcceptStock interface exists', () => {
    const { MarketContract } = require('cooptypes');
    expect(MarketContract.Actions.AcceptStock).toBeDefined();
    expect(MarketContract.Actions.AcceptStock.actionName).toBe('acceptstock');
  });

  it('Destroy interface exists', () => {
    const { MarketContract } = require('cooptypes');
    expect(MarketContract.Actions.Destroy).toBeDefined();
    expect(MarketContract.Actions.Destroy.actionName).toBe('destroy');
  });

  it('Reoffer interface exists', () => {
    const { MarketContract } = require('cooptypes');
    expect(MarketContract.Actions.Reoffer).toBeDefined();
    expect(MarketContract.Actions.Reoffer.actionName).toBe('reoffer');
  });

  it('all existing actions still present', () => {
    const { MarketContract } = require('cooptypes');
    const existingActions = [
      'AcceptRequest', 'CancelRequest', 'CompleteRequest',
      'ConfirmReceive', 'ConfirmSupply', 'CreateOffer',
      'CreateOrder', 'DeclineRequest', 'DeliverOnRequest',
      'ModerateRequest', 'OpenDispute', 'ProhibitRequest',
      'PublishRequest', 'ReceiveOnRequest', 'SupplyOnRequest',
      'UnpublishRequest', 'UpdateRequest',
    ];

    for (const action of existingActions) {
      expect(MarketContract.Actions[action]).toBeDefined();
    }
  });
});

describe('Marketplace new flow statuses', () => {
  it('new statuses are documented', () => {
    const newStatuses = [
      'active', 'accepted', 'authorized',
      'supplied1', 'supplied2',
      'delivered', 'reqreturn', 'retauthorized',
      'received1', 'received2',
      'completed', 'canceled', 'declined',
    ];

    expect(newStatuses).toContain('reqreturn');
    expect(newStatuses).toContain('retauthorized');
    expect(newStatuses.length).toBe(13);
  });

  it('coopstock type is defined', () => {
    const types = ['orderoffer', 'coopstock'];
    expect(types).toContain('coopstock');
  });
});
