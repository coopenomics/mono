import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Cooperative } from 'cooptypes';
import { MarketplaceWriteoffService } from './marketplace-writeoff.service';
import type {
  MarketplaceWriteoffItemInput,
  MarketplaceCreateWriteoffDraftInput,
} from './marketplace-writeoff.service';
import type { MarketplaceWriteoffProposalDomainRepository } from '../../domain/repositories/marketplace-writeoff-proposal.repository';
import type { MarketplaceInventoryDomainRepository } from '../../domain/repositories/marketplace-inventory.repository';
import type { MarketplaceCanonicalBlockchainPort } from '../../domain/ports/marketplace-canonical-blockchain.port';
import type { MarketplaceAssetConfig } from './marketplace-asset.config';
import { MarketplaceWriteoffProposalDomainEntity } from '../../domain/entities/marketplace-writeoff-proposal.entity';
import {
  MarketplaceWriteoffProposalStatuses,
  MarketplaceWriteoffProposalTriggers,
} from '../../domain/entities/marketplace-writeoff-proposal.types';

function buildProposal(
  overrides: Partial<MarketplaceWriteoffProposalDomainEntity> = {}
): MarketplaceWriteoffProposalDomainEntity {
  return new MarketplaceWriteoffProposalDomainEntity({
    id: 'p-1',
    coopname: 'voskhod',
    trigger: MarketplaceWriteoffProposalTriggers.MANUAL,
    status: MarketplaceWriteoffProposalStatuses.DRAFT,
    cycle_started_at: new Date('2026-06-01T00:00:00Z'),
    proposal_hash: '',
    decision_id: null,
    proposed_by_account: 'chairman1',
    decided_by_account: null,
    items: [
      {
        braname: 'voskhod1',
        asset_title: 'Молоко «Доброе»',
        quantity: '5',
        amount: '485.0000',
        reason: 'Истёк срок годности',
        inventory_ids: [],
        executed: false,
      },
    ],
    total_amount: '485.0000 RUB',
    protocol_doc: null,
    statement_doc: null,
    reject_reason: null,
    decision_log: [],
    submitted_at: null,
    authorized_at: null,
    executed_at: null,
    rejected_at: null,
    created_at: new Date('2026-06-01T00:00:00Z'),
    updated_at: new Date('2026-06-01T00:00:00Z'),
    ...(overrides as any),
  });
}

function buildItem(over: Partial<MarketplaceWriteoffItemInput> = {}): MarketplaceWriteoffItemInput {
  return {
    braname: 'voskhod1',
    asset_title: 'Молоко «Доброе»',
    quantity: '5',
    amount: '485.0000',
    reason: 'Истёк срок годности',
    ...over,
  };
}

function buildMocks() {
  const repo: jest.Mocked<MarketplaceWriteoffProposalDomainRepository> = {
    create: jest.fn(),
    findById: jest.fn(),
    findByHash: jest.fn(),
    findOpenDraft: jest.fn(),
    findOpenInCouncil: jest.fn(),
    list: jest.fn(),
    updateDraftItems: jest.fn(),
    submitToCouncil: jest.fn(),
    markAuthorized: jest.fn(),
    markExecuting: jest.fn(),
    markItemExecuted: jest.fn(),
    markFullyExecuted: jest.fn(),
    markRejected: jest.fn(),
    cancelDraft: jest.fn(),
  } as unknown as jest.Mocked<MarketplaceWriteoffProposalDomainRepository>;

  const inventoryRepo: jest.Mocked<MarketplaceInventoryDomainRepository> = {
    applyStatusTransition: jest.fn(),
  } as unknown as jest.Mocked<MarketplaceInventoryDomainRepository>;

  // Обогащение позиций списания названием товара/заказа и адресом КУ
  // (см. MarketplaceOrderDisplayService.resolveBranchDisplay) — по умолчанию
  // «нет данных», тесты бизнес-логики списания эти поля не проверяют.
  const orderRepo = { findById: jest.fn().mockResolvedValue(null) } as any;
  const offerRepo = { findById: jest.fn().mockResolvedValue(null) } as any;
  const orderDisplay = {
    resolveBranchDisplay: jest
      .fn()
      .mockResolvedValue({ name: null, address: null, lat: null, lng: null }),
  } as any;

  const chainPort: jest.Mocked<MarketplaceCanonicalBlockchainPort> = {
    propWroff: jest.fn().mockResolvedValue({ transaction: { id: 'tx-prop' } } as any),
    execWroff: jest.fn().mockResolvedValue({ transaction: { id: 'tx-exec' } } as any),
  } as unknown as jest.Mocked<MarketplaceCanonicalBlockchainPort>;

  const assetConfig: MarketplaceAssetConfig = { symbol: 'RUB', decimals: 4 };

  const documentDomainService = {} as any;
  const eventBus = { emit: jest.fn() } as any;
  const logger = {
    setContext: jest.fn(),
    info: jest.fn(),
    log: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  } as any;

  return {
    repo,
    inventoryRepo,
    orderRepo,
    offerRepo,
    chainPort,
    assetConfig,
    documentDomainService,
    orderDisplay,
    eventBus,
    logger,
  };
}

function buildService(mocks: ReturnType<typeof buildMocks>): MarketplaceWriteoffService {
  return new MarketplaceWriteoffService(
    mocks.repo,
    mocks.inventoryRepo,
    mocks.orderRepo,
    mocks.offerRepo,
    mocks.chainPort,
    mocks.assetConfig,
    mocks.documentDomainService,
    mocks.orderDisplay,
    mocks.eventBus,
    mocks.logger
  );
}

function buildSignedStatement(proposalHash: string) {
  const doc = {
    hash: 'doc-hash',
    meta: {
      registry_id: Cooperative.Registry.MarketplaceWriteoffStatement.registry_id,
      proposal_hash: proposalHash,
    },
    signatures: [
      {
        public_key: 'PUB_K1_test',
        signature: 'SIG_K1_test',
        signed_hash: 'signed-hash',
      },
    ],
    toDocument: jest.fn().mockReturnValue({ hash: 'doc-hash' }),
  } as any;
  return doc;
}

describe('MarketplaceWriteoffService', () => {
  let mocks: ReturnType<typeof buildMocks>;
  let service: MarketplaceWriteoffService;

  beforeEach(() => {
    mocks = buildMocks();
    service = buildService(mocks);
  });

  // ── createDraft ────────────────────────────────────────────────────────

  describe('createDraft', () => {
    const baseInput: MarketplaceCreateWriteoffDraftInput = {
      coopname: 'voskhod',
      trigger: MarketplaceWriteoffProposalTriggers.MANUAL,
      proposed_by_account: 'chairman1',
      items: [buildItem()],
    };

    it('happy path — формирует DRAFT и эмитит draft_built событие', async () => {
      mocks.repo.findOpenDraft.mockResolvedValue(null);
      mocks.repo.findOpenInCouncil.mockResolvedValue(null);
      mocks.repo.create.mockResolvedValue(buildProposal());

      const result = await service.createDraft(baseInput);

      expect(mocks.repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          coopname: 'voskhod',
          trigger: MarketplaceWriteoffProposalTriggers.MANUAL,
          total_amount: '485.0000 RUB',
          items: [expect.objectContaining({ executed: false, amount: '485.0000' })],
        })
      );
      expect(mocks.eventBus.emit).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ coopname: 'voskhod', items_count: 1 })
      );
      expect(result.id).toBe('p-1');
    });

    it('ConflictException — уже есть открытый DRAFT', async () => {
      mocks.repo.findOpenDraft.mockResolvedValue(buildProposal({ id: 'old-draft' } as any));

      await expect(service.createDraft(baseInput)).rejects.toThrow(ConflictException);
      expect(mocks.repo.create).not.toHaveBeenCalled();
    });

    it('разрешает создать второй проект, даже когда первый уже на повестке совета (разные партии скоропорта независимы)', async () => {
      // Гард findOpenInCouncil снят намеренно (598, коммит f20e416a): защита от
      // двойного списания одной позиции перенесена на уровень кандидатов
      // (findActiveLockedInventoryIds), а не запретом второго проекта целиком.
      mocks.repo.findOpenDraft.mockResolvedValue(null);
      mocks.repo.create.mockResolvedValue(buildProposal());

      const result = await service.createDraft(baseInput);

      expect(mocks.repo.create).toHaveBeenCalled();
      expect(result.id).toBe('p-1');
    });

    it('BadRequest — пустой список позиций', async () => {
      mocks.repo.findOpenDraft.mockResolvedValue(null);
      mocks.repo.findOpenInCouncil.mockResolvedValue(null);
      await expect(
        service.createDraft({ ...baseInput, items: [] })
      ).rejects.toThrow(BadRequestException);
    });

    it('BadRequest — более 200 позиций', async () => {
      mocks.repo.findOpenDraft.mockResolvedValue(null);
      mocks.repo.findOpenInCouncil.mockResolvedValue(null);
      const items = Array.from({ length: 201 }, () => buildItem());
      await expect(service.createDraft({ ...baseInput, items })).rejects.toThrow(
        BadRequestException
      );
    });

    it('BadRequest — некорректная сумма позиции', async () => {
      mocks.repo.findOpenDraft.mockResolvedValue(null);
      mocks.repo.findOpenInCouncil.mockResolvedValue(null);
      await expect(
        service.createDraft({ ...baseInput, items: [buildItem({ amount: '-5' })] })
      ).rejects.toThrow(BadRequestException);
    });

    it('BadRequest — причина списания не указана (пусто/пробелы)', async () => {
      mocks.repo.findOpenDraft.mockResolvedValue(null);
      mocks.repo.findOpenInCouncil.mockResolvedValue(null);
      await expect(
        service.createDraft({ ...baseInput, items: [buildItem({ reason: '' })] })
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.createDraft({ ...baseInput, items: [buildItem({ reason: '   ' })] })
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── computeProposalHash ────────────────────────────────────────────────

  describe('computeProposalHash', () => {
    it('детерминистичен — одинаковые items дают одинаковый hash', () => {
      const itemsA = [
        {
          braname: 'voskhod1',
          asset_title: 'A',
          quantity: '1',
          amount: '10.0000',
          reason: 'r',
          inventory_ids: [],
          executed: false,
        },
        {
          braname: 'voskhod2',
          asset_title: 'B',
          quantity: '2',
          amount: '20.0000',
          reason: 'r',
          inventory_ids: [],
          executed: false,
        },
      ];
      const itemsB = [...itemsA].reverse();
      const h1 = service.computeProposalHash({
        coopname: 'voskhod',
        cycle_started_at: '2026-06-01',
        draft_id: 'p-1',
        items: itemsA,
      });
      const h2 = service.computeProposalHash({
        coopname: 'voskhod',
        cycle_started_at: '2026-06-01',
        draft_id: 'p-1',
        items: itemsB,
      });
      expect(h1).toBe(h2);
      expect(h1).toHaveLength(64);
    });

    it('различает разные cycle_started_at', () => {
      const items = [
        {
          braname: 'voskhod1',
          asset_title: 'A',
          quantity: '1',
          amount: '10.0000',
          reason: 'r',
          inventory_ids: [],
          executed: false,
        },
      ];
      const h1 = service.computeProposalHash({
        coopname: 'voskhod',
        cycle_started_at: '2026-06-01',
        draft_id: 'p-1',
        items,
      });
      const h2 = service.computeProposalHash({
        coopname: 'voskhod',
        cycle_started_at: '2026-07-01',
        draft_id: 'p-1',
        items,
      });
      expect(h1).not.toBe(h2);
    });
  });

  // ── updateDraft / cancelDraft ──────────────────────────────────────────

  describe('updateDraft', () => {
    it('NotFound когда DRAFT не существует', async () => {
      mocks.repo.findById.mockResolvedValue(null);
      await expect(
        service.updateDraft({ id: 'p-1', actor: 'chairman1', items: [buildItem()] })
      ).rejects.toThrow(NotFoundException);
    });

    it('BadRequest когда статус не DRAFT', async () => {
      mocks.repo.findById.mockResolvedValue(buildProposal({ status: 'AUTHORIZED' } as any));
      await expect(
        service.updateDraft({ id: 'p-1', actor: 'chairman1', items: [buildItem()] })
      ).rejects.toThrow(BadRequestException);
    });

    it('happy — пересобирает items с пересчётом total_amount', async () => {
      mocks.repo.findById.mockResolvedValue(buildProposal());
      mocks.repo.updateDraftItems.mockResolvedValue(buildProposal());
      await service.updateDraft({
        id: 'p-1',
        actor: 'chairman1',
        items: [buildItem({ amount: '100.0000' }), buildItem({ amount: '200.0000' })],
      });
      expect(mocks.repo.updateDraftItems).toHaveBeenCalledWith(
        'p-1',
        expect.any(Array),
        '300.0000 RUB',
        expect.objectContaining({ action: 'draft_updated', actor: 'chairman1' })
      );
    });
  });

  describe('cancelDraft', () => {
    it('NotFound', async () => {
      mocks.repo.findById.mockResolvedValue(null);
      await expect(service.cancelDraft('p-1')).rejects.toThrow(NotFoundException);
    });

    it('BadRequest когда не DRAFT', async () => {
      mocks.repo.findById.mockResolvedValue(buildProposal({ status: 'EXECUTED' } as any));
      await expect(service.cancelDraft('p-1')).rejects.toThrow(BadRequestException);
    });

    it('happy', async () => {
      mocks.repo.findById.mockResolvedValue(buildProposal());
      await service.cancelDraft('p-1');
      expect(mocks.repo.cancelDraft).toHaveBeenCalledWith('p-1');
    });
  });

  // ── submitToCouncil ───────────────────────────────────────────────────

  describe('submitToCouncil', () => {
    beforeEach(() => {
      jest
        .spyOn(service as any, 'verifyDocumentSignature')
        .mockImplementation(() => undefined);
    });

    function setupDraft() {
      const draft = buildProposal();
      mocks.repo.findById.mockResolvedValue(draft);
      const proposalHash = service.computeProposalHash({
        coopname: draft.coopname,
        cycle_started_at: draft.cycle_started_at.toISOString(),
        draft_id: draft.id,
        items: draft.items,
      });
      mocks.repo.submitToCouncil.mockResolvedValue(
        buildProposal({ status: 'ON_AGENDA', proposal_hash: proposalHash } as any)
      );
      return { draft, proposalHash };
    }

    it('happy — propWroff (с мостом повестки в контракте) + submitToCouncil', async () => {
      const { proposalHash } = setupDraft();

      const result = await service.submitToCouncil({
        id: 'p-1',
        chairman_account: 'chairman1',
        signed_statement: buildSignedStatement(proposalHash),
      });

      // propWroff несёт statement + meta: повестку совета ставит сам контракт
      // (inline createagenda), отдельного backend-вызова больше нет.
      expect(mocks.chainPort.propWroff).toHaveBeenCalledWith(
        expect.objectContaining({
          coopname: 'voskhod',
          proposed_by: 'chairman1',
          proposal_hash: proposalHash,
          statement: expect.anything(),
          meta: expect.any(String),
        })
      );
      expect(mocks.repo.submitToCouncil).toHaveBeenCalledWith(
        'p-1',
        expect.objectContaining({ proposal_hash: proposalHash, proposed_by_account: 'chairman1' })
      );
      expect(result.status).toBe('ON_AGENDA');
    });

    it('NotFound когда DRAFT не существует', async () => {
      mocks.repo.findById.mockResolvedValue(null);
      await expect(
        service.submitToCouncil({
          id: 'p-1',
          chairman_account: 'chairman1',
          signed_statement: buildSignedStatement('any-hash'),
        })
      ).rejects.toThrow(NotFoundException);
    });

    it('BadRequest когда статус не DRAFT', async () => {
      mocks.repo.findById.mockResolvedValue(buildProposal({ status: 'AUTHORIZED' } as any));
      await expect(
        service.submitToCouncil({
          id: 'p-1',
          chairman_account: 'chairman1',
          signed_statement: buildSignedStatement('any-hash'),
        })
      ).rejects.toThrow(BadRequestException);
      expect(mocks.chainPort.propWroff).not.toHaveBeenCalled();
    });

    it('BadRequest когда корзина пуста', async () => {
      mocks.repo.findById.mockResolvedValue(buildProposal({ items: [] } as any));
      await expect(
        service.submitToCouncil({
          id: 'p-1',
          chairman_account: 'chairman1',
          signed_statement: buildSignedStatement('any-hash'),
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('BadRequest когда registry_id не 1106', async () => {
      const draft = buildProposal();
      mocks.repo.findById.mockResolvedValue(draft);
      const proposalHash = service.computeProposalHash({
        coopname: draft.coopname,
        cycle_started_at: draft.cycle_started_at.toISOString(),
        draft_id: draft.id,
        items: draft.items,
      });
      const wrongDoc = buildSignedStatement(proposalHash);
      wrongDoc.meta.registry_id = 9999;
      await expect(
        service.submitToCouncil({
          id: 'p-1',
          chairman_account: 'chairman1',
          signed_statement: wrongDoc,
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('BadRequest когда proposal_hash в подписанном Заявлении не сошёлся', async () => {
      const draft = buildProposal();
      mocks.repo.findById.mockResolvedValue(draft);
      const wrongDoc = buildSignedStatement('wrong-hash-zzz');
      await expect(
        service.submitToCouncil({
          id: 'p-1',
          chairman_account: 'chairman1',
          signed_statement: wrongDoc,
        })
      ).rejects.toThrow(/пересоберите Заявление/);
      expect(mocks.chainPort.propWroff).not.toHaveBeenCalled();
    });
  });

  // ── onCouncilAuthorized ────────────────────────────────────────────────

  describe('onCouncilAuthorized', () => {
    it('happy — markAuthorized переводит проект в PENDING_CONFIRMATION, списание НЕ запускается автоматически', async () => {
      // Автозапуск списания убран (598, коммит 02841aba8): совет только
      // одобряет, а фактическое списание по каждому КУ подтверждает его
      // председатель отдельной подписью (confirmWriteoff → confirmwroff).
      const onAgenda = buildProposal({ status: 'ON_AGENDA' } as any);
      const authorized = buildProposal({ status: 'PENDING_CONFIRMATION' } as any);
      mocks.repo.findByHash.mockResolvedValue(onAgenda);
      mocks.repo.markAuthorized.mockResolvedValue(authorized);

      await service.onCouncilAuthorized({
        coopname: 'voskhod',
        proposal_hash: 'h1',
        authorized_by: 'chairman1',
        protocol_doc: { hash: 'protocol-doc' },
      });

      expect(mocks.repo.markAuthorized).toHaveBeenCalledWith(
        'p-1',
        expect.objectContaining({ decided_by_account: 'chairman1' })
      );
      expect(mocks.eventBus.emit).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ coopname: 'voskhod', proposal_id: 'p-1' })
      );
      expect(mocks.chainPort.execWroff).not.toHaveBeenCalled();
    });

    it('пропускает — proposal не найден по hash', async () => {
      mocks.repo.findByHash.mockResolvedValue(null);
      await service.onCouncilAuthorized({
        coopname: 'voskhod',
        proposal_hash: 'h1',
        authorized_by: 'chairman1',
        protocol_doc: null,
      });
      expect(mocks.repo.markAuthorized).not.toHaveBeenCalled();
      expect(mocks.logger.warn).toHaveBeenCalled();
    });

    it('пропускает — статус не ON_AGENDA', async () => {
      mocks.repo.findByHash.mockResolvedValue(
        buildProposal({ status: 'EXECUTED' } as any)
      );
      await service.onCouncilAuthorized({
        coopname: 'voskhod',
        proposal_hash: 'h1',
        authorized_by: 'chairman1',
        protocol_doc: null,
      });
      expect(mocks.repo.markAuthorized).not.toHaveBeenCalled();
    });
  });

  // ── onCouncilDeclined ─────────────────────────────────────────────────

  describe('onCouncilDeclined', () => {
    it('happy — markRejected + REJECTED event', async () => {
      const onAgenda = buildProposal({ status: 'ON_AGENDA' } as any);
      mocks.repo.findByHash.mockResolvedValue(onAgenda);
      mocks.repo.markRejected.mockResolvedValue(
        buildProposal({ status: 'REJECTED', reject_reason: 'не одобрено' } as any)
      );

      await service.onCouncilDeclined({
        coopname: 'voskhod',
        proposal_hash: 'h1',
        reason: 'не одобрено',
      });

      expect(mocks.repo.markRejected).toHaveBeenCalledWith(
        'p-1',
        expect.objectContaining({ reject_reason: 'не одобрено' })
      );
      expect(mocks.eventBus.emit).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ reason: 'не одобрено' })
      );
    });

    it('пропускает — proposal не найден', async () => {
      mocks.repo.findByHash.mockResolvedValue(null);
      await service.onCouncilDeclined({ coopname: 'voskhod', proposal_hash: 'h1', reason: 'x' });
      expect(mocks.repo.markRejected).not.toHaveBeenCalled();
    });

    it('пропускает — статус не ON_AGENDA', async () => {
      mocks.repo.findByHash.mockResolvedValue(buildProposal({ status: 'EXECUTED' } as any));
      await service.onCouncilDeclined({ coopname: 'voskhod', proposal_hash: 'h1', reason: 'x' });
      expect(mocks.repo.markRejected).not.toHaveBeenCalled();
    });
  });

  // ── executeAuthorizedProposal ─────────────────────────────────────────

  describe('executeAuthorizedProposal', () => {
    it('per-item execWroff + markItemExecuted на каждой позиции + markFullyExecuted в конце', async () => {
      const authorized = buildProposal({
        status: 'AUTHORIZED',
        items: [
          { ...buildProposal().items[0], braname: 'voskhod1', amount: '10.0000' },
          { ...buildProposal().items[0], braname: 'voskhod2', amount: '20.0000' },
        ],
      } as any);
      mocks.repo.findById.mockResolvedValue(authorized);
      mocks.repo.markExecuting.mockResolvedValue(
        buildProposal({ status: 'EXECUTING', items: authorized.items } as any)
      );
      // После каждого markItemExecuted возвращаем working с актуальным executed
      let executed = 0;
      mocks.repo.markItemExecuted.mockImplementation(async () => {
        executed++;
        return buildProposal({
          status: 'EXECUTING',
          items: authorized.items.map((it, idx) => ({ ...it, executed: idx < executed })),
        } as any);
      });
      mocks.repo.markFullyExecuted.mockResolvedValue(
        buildProposal({ status: 'EXECUTED' } as any)
      );

      await service.executeAuthorizedProposal('p-1', 'chairman1');

      expect(mocks.chainPort.execWroff).toHaveBeenCalledTimes(2);
      expect(mocks.repo.markItemExecuted).toHaveBeenCalledTimes(2);
      expect(mocks.repo.markFullyExecuted).toHaveBeenCalled();
    });

    it('NotFound', async () => {
      mocks.repo.findById.mockResolvedValue(null);
      await expect(service.executeAuthorizedProposal('p-1', 'chairman1')).rejects.toThrow(
        NotFoundException
      );
    });

    it('BadRequest когда статус не AUTHORIZED/EXECUTING', async () => {
      mocks.repo.findById.mockResolvedValue(buildProposal({ status: 'DRAFT' } as any));
      await expect(service.executeAuthorizedProposal('p-1', 'chairman1')).rejects.toThrow(
        BadRequestException
      );
    });

    it('пропускает уже исполненные item-ы (idempotent)', async () => {
      const items = [
        { ...buildProposal().items[0], braname: 'voskhod1', executed: true },
        { ...buildProposal().items[0], braname: 'voskhod2', executed: false },
      ];
      const executing = buildProposal({ status: 'EXECUTING', items } as any);
      mocks.repo.findById.mockResolvedValue(executing);
      mocks.repo.markItemExecuted.mockResolvedValue(
        buildProposal({
          status: 'EXECUTING',
          items: items.map((it) => ({ ...it, executed: true })),
        } as any)
      );
      mocks.repo.markFullyExecuted.mockResolvedValue(
        buildProposal({ status: 'EXECUTED' } as any)
      );

      await service.executeAuthorizedProposal('p-1', 'chairman1');

      expect(mocks.chainPort.execWroff).toHaveBeenCalledTimes(1);
    });
  });

  // ── formatAsset / formatAssetNumber через assetConfig ─────────────────

  describe('formatAsset', () => {
    it('берёт symbol/decimals из DI assetConfig (не хардкод)', () => {
      const customMocks = buildMocks();
      customMocks.assetConfig.symbol = 'XYZ';
      customMocks.assetConfig.decimals = 2;
      const customService = buildService(customMocks);
      expect(customService.formatAsset(123.456)).toBe('123.46 XYZ');
      expect(customService.formatAssetNumber(7)).toBe('7.00');
    });
  });
});
