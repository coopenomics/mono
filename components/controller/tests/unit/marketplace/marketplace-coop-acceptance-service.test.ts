/**
 * Unit-тесты MarketplaceCoopAcceptanceService (Story 1.9).
 *
 * Покрывают AC:
 *   (a) getStatus → 'not_accepted' пока coopAcceptance.accepted=false;
 *   (b) accept({...}) пишет в extension.config.coopAcceptance, возвращает
 *       'active' с переданным document_registry_id/board_decision_id;
 *   (c) accept повторно (re-accept) — overrides предыдущее, нет дубликата;
 *   (d) если расширения нет в БД → NotFoundException.
 */
import { NotFoundException } from '@nestjs/common';

import { MarketplaceCoopAcceptanceService } from '~/extensions/marketplace/application/coop-acceptance/marketplace-coop-acceptance.service';

const makeLogger = () =>
  ({
    setContext: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  } as any);

function makeRepo(initialConfig: any = {}) {
  const state = { name: 'market', config: { ...initialConfig } };
  const updateMock = jest.fn().mockImplementation(async (patch: any) => {
    Object.assign(state.config, patch.config);
    return state;
  });
  return {
    findByName: jest.fn().mockImplementation(async (name: string) =>
      name === 'market' ? state : null
    ),
    update: updateMock,
    _state: state,
  } as any;
}

describe('MarketplaceCoopAcceptanceService', () => {
  it('getStatus → not_accepted при default coopAcceptance.accepted=false', async () => {
    const repo = makeRepo({
      coopAcceptance: { accepted: false, document_registry_id: 0, accepted_at: '', accepted_by_board_decision_id: '' },
    });
    const service = new MarketplaceCoopAcceptanceService(repo, makeLogger());

    const status = await service.getStatus();
    expect(status.status).toBe('not_accepted');
    expect(status.document_registry_id).toBeUndefined();
  });

  it('getStatus → not_accepted даже если coopAcceptance отсутствует (fallback на default)', async () => {
    const repo = makeRepo({}); // нет coopAcceptance вообще
    const service = new MarketplaceCoopAcceptanceService(repo, makeLogger());
    const status = await service.getStatus();
    expect(status.status).toBe('not_accepted');
  });

  it('accept(input) → status=active + поля заполнены, repo.update вызван', async () => {
    const repo = makeRepo({
      coopAcceptance: { accepted: false, document_registry_id: 0, accepted_at: '', accepted_by_board_decision_id: '' },
    });
    const service = new MarketplaceCoopAcceptanceService(repo, makeLogger());

    const status = await service.accept({
      document_registry_id: 1101,
      accepted_by_board_decision_id: 'board-decision-42',
      accepted_at: '2026-05-14T12:00:00Z',
    });

    expect(status.status).toBe('active');
    expect(status.document_registry_id).toBe(1101);
    expect(status.accepted_at).toBe('2026-05-14T12:00:00Z');
    expect(status.accepted_by_board_decision_id).toBe('board-decision-42');
    expect(repo.update).toHaveBeenCalledTimes(1);
    expect(repo._state.config.coopAcceptance).toEqual({
      accepted: true,
      document_registry_id: 1101,
      accepted_at: '2026-05-14T12:00:00Z',
      accepted_by_board_decision_id: 'board-decision-42',
    });
  });

  it('accept повторно (re-accept) overrides предыдущее значение, не дубликат', async () => {
    const repo = makeRepo({
      coopAcceptance: {
        accepted: true,
        document_registry_id: 100,
        accepted_at: '2026-05-13T00:00:00Z',
        accepted_by_board_decision_id: 'old-decision',
      },
    });
    const service = new MarketplaceCoopAcceptanceService(repo, makeLogger());

    const status = await service.accept({
      document_registry_id: 200,
      accepted_by_board_decision_id: 'new-decision',
      accepted_at: '2026-05-14T00:00:00Z',
    });

    expect(status.document_registry_id).toBe(200);
    expect(status.accepted_by_board_decision_id).toBe('new-decision');
  });

  it('accept без явного accepted_at → берётся текущее время (валидный ISO)', async () => {
    const repo = makeRepo({});
    const service = new MarketplaceCoopAcceptanceService(repo, makeLogger());
    const status = await service.accept({
      document_registry_id: 1,
      accepted_by_board_decision_id: 'x',
    });
    expect(status.accepted_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/);
  });

  it('расширения нет в БД → NotFoundException для getStatus и accept', async () => {
    const repo = {
      findByName: jest.fn().mockResolvedValue(null),
      update: jest.fn(),
    } as any;
    const service = new MarketplaceCoopAcceptanceService(repo, makeLogger());

    await expect(service.getStatus()).rejects.toThrow(NotFoundException);
    await expect(
      service.accept({ document_registry_id: 1, accepted_by_board_decision_id: 'x' })
    ).rejects.toThrow(NotFoundException);
  });
});
