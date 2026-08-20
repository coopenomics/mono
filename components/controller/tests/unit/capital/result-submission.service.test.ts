/**
 * Unit-тесты ResultSubmissionService — прикладной слой приёма РИД
 * (процесс p.cap.rid, слайс result_submission).
 *
 * Что здесь защищается. Интерфейс прячет кнопку по статусу сегмента и по
 * владельцу (ResultSubmissionActionsWidget), но сервер обязан отказывать
 * самостоятельно: мутации доступны напрямую по GraphQL. Отдельная группа
 * тестов — сверка подписанного документа со сгенерированным: это единственная
 * защита от подмены содержимого заявления между генерацией и подписью.
 *
 * Реестр случаев: test-registry/capital.result-submission.yaml
 */

import { Classes } from '@coopenomics/sdk';
import { ResultSubmissionService } from '~/extensions/capital/application/services/result-submission.service';

function makeLoggerStub() {
  return {
    setContext: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  } as any;
}

function makeSignedDocument(overrides: Record<string, any> = {}) {
  return {
    version: '2',
    hash: 'h',
    doc_hash: 'doc-hash-1',
    meta_hash: 'mh',
    meta: {},
    signatures: [],
    ...overrides,
  } as any;
}

/** Мета заявления и решения совпадают по умолчанию — расхождения задаются точечно. */
function makeMeta(overrides: Record<string, any> = {}) {
  return {
    component_name: 'Компонент',
    project_name: 'Проект',
    total_amount: '100.0000 RUB',
    percent_of_result: '0.50000000',
    result_hash: 'rh',
    ...overrides,
  };
}

type Overrides = {
  result?: any;
  resultByHash?: any;
  segment?: any;
  project?: any;
  parentProject?: any;
  generatedDocument?: any;
  comparison?: any;
  updatedResult?: any;
};

function makeService(o: Overrides = {}) {
  const segmentOut = { username: 'alice', project_hash: 'ph' };

  const resultSubmissionInteractor = {
    pushResult: jest.fn(async () => segmentOut),
    convertSegment: jest.fn(async () => segmentOut),
    signActAsContributor: jest.fn(async () => segmentOut),
    signActAsChairman: jest.fn(async () => segmentOut),
    getResults: jest.fn(),
    getResultById: jest.fn(),
  } as any;

  // Порт документов ядра: генерация черновика и поиск ранее сгенерированного.
  const documentPort = {
    generate: jest.fn(async () => ({ hash: 'generated' })),
    getByHash: jest.fn(async () => ('generatedDocument' in o ? o.generatedDocument : { doc_hash: 'doc-hash-1' })),
  } as any;

  const segmentMapper = { toDTO: jest.fn(async (s: any) => s) } as any;
  const resultMapper = { toDTO: jest.fn(async (r: any) => r) } as any;

  const projects: Record<string, any> = {};
  const project =
    'project' in o
      ? o.project
      : { project_hash: 'ph', title: 'Компонент', parent_hash: 'parent', fact: { total: '200.0000 RUB' } };
  if (project) projects[project.project_hash ?? 'ph'] = project;
  const parentProject = 'parentProject' in o ? o.parentProject : { project_hash: 'parent', title: 'Проект' };
  if (parentProject) projects['parent'] = parentProject;

  const projectRepository = {
    findByHash: jest.fn(async (hash: string) => projects[hash] ?? null),
  } as any;

  const resultRepository = {
    findByProjectHashAndUsername: jest.fn(async () =>
      'result' in o ? o.result : { result_hash: 'rh', data: 'payload', project_hash: 'ph', username: 'alice' }
    ),
    findByResultHash: jest.fn(async () =>
      'resultByHash' in o ? o.resultByHash : ('updatedResult' in o ? o.updatedResult : { result_hash: 'rh' })
    ),
    create: jest.fn(),
    update: jest.fn(),
  } as any;

  const segmentRepository = {
    findOne: jest.fn(async () =>
      'segment' in o
        ? o.segment
        : { intellectual_cost: '100.0000 RUB', debt_amount: '5.0000 RUB', share_percent: 0.5, username: 'alice' }
    ),
  } as any;

  const service = new ResultSubmissionService(
    resultSubmissionInteractor,
    documentPort,
    segmentMapper,
    resultMapper,
    projectRepository,
    { findByProjectHash: jest.fn(async () => []) } as any,
    { findUnconsumedByProjectAndUsername: jest.fn(async () => []) } as any,
    resultRepository,
    segmentRepository,
    { findProjectStories: jest.fn(async () => []), findByIssueHash: jest.fn(async () => []) } as any,
    { findByProjectHash: jest.fn(async () => []), findCompletedByProjectAndCreators: jest.fn(async () => []) } as any,
    makeLoggerStub()
  );

  jest
    .spyOn(Classes.Document, 'compareDocuments')
    .mockResolvedValue(('comparison' in o ? o.comparison : { isValid: true, differences: {} }) as any);

  return {
    service,
    resultSubmissionInteractor,
    documentPort,
    projectRepository,
    resultRepository,
    segmentRepository,
  };
}

const alice = { username: 'alice', role: 'user' } as any;
const chairman = { username: 'bob', role: 'chairman' } as any;

function pushDto(overrides: Record<string, any> = {}) {
  return {
    project_hash: 'ph',
    username: 'alice',
    statement: makeSignedDocument(),
    ...overrides,
  } as any;
}

describe('ResultSubmissionService', () => {
  describe('pushResult', () => {
    // cap.rid.side.23
    it('отказывает при попытке внести результат за другого пайщика', async () => {
      const { service, resultSubmissionInteractor } = makeService();

      await expect(service.pushResult(pushDto({ username: 'mallory' }), alice)).rejects.toThrow(
        'Вы можете вносить результаты только для себя'
      );
      expect(resultSubmissionInteractor.pushResult).not.toHaveBeenCalled();
    });

    // cap.rid.side.24
    it('отказывает, если заявление ещё не сгенерировано (нет записи результата)', async () => {
      const { service, resultSubmissionInteractor } = makeService({ result: null });

      await expect(service.pushResult(pushDto(), alice)).rejects.toThrow(
        'Сначала необходимо сгенерировать заявление'
      );
      expect(resultSubmissionInteractor.pushResult).not.toHaveBeenCalled();
    });

    it('отказывает, если у найденного результата нет result_hash', async () => {
      const { service } = makeService({ result: { project_hash: 'ph', username: 'alice' } });

      await expect(service.pushResult(pushDto(), alice)).rejects.toThrow(
        'Сначала необходимо сгенерировать заявление'
      );
    });

    // cap.rid.side.25
    it('отказывает, если подписан документ, которого сервер не генерировал', async () => {
      const { service, resultSubmissionInteractor } = makeService({ generatedDocument: null });

      await expect(service.pushResult(pushDto(), alice)).rejects.toThrow(
        'Сгенерированный документ с хешем doc-hash-1 не найден'
      );
      expect(resultSubmissionInteractor.pushResult).not.toHaveBeenCalled();
    });

    it('ищет сгенерированный документ именно по doc_hash из присланного заявления', async () => {
      const { service, documentPort } = makeService();

      await service.pushResult(pushDto({ statement: makeSignedDocument({ doc_hash: 'иной-хэш' }) }), alice);

      expect(documentPort.getByHash).toHaveBeenCalledWith('иной-хэш');
    });

    // cap.rid.side.26
    it('отказывает при расхождении подписанного и сгенерированного документов, перечисляя поля', async () => {
      const { service, resultSubmissionInteractor } = makeService({
        comparison: {
          isValid: false,
          differences: {
            total_amount: { expected: '100.0000 RUB', actual: '900.0000 RUB' },
          },
        },
      });

      await expect(service.pushResult(pushDto(), alice)).rejects.toThrow(
        'total_amount: ожидалось "100.0000 RUB", получено "900.0000 RUB"'
      );
      await expect(service.pushResult(pushDto(), alice)).rejects.toThrow('Возможна подмена документа');
      expect(resultSubmissionInteractor.pushResult).not.toHaveBeenCalled();
    });

    it('разделяет несколько расхождений точкой с запятой', async () => {
      const { service } = makeService({
        comparison: {
          isValid: false,
          differences: {
            total_amount: { expected: '100.0000 RUB', actual: '900.0000 RUB' },
            percent_of_result: { expected: '0.50000000', actual: '0.99000000' },
          },
        },
      });

      await expect(service.pushResult(pushDto(), alice)).rejects.toThrow(
        'total_amount: ожидалось "100.0000 RUB", получено "900.0000 RUB"; percent_of_result: ожидалось "0.50000000", получено "0.99000000"'
      );
    });

    // cap.rid.side.27
    it('отказывает, если сегмент пайщика по проекту не найден', async () => {
      const { service, resultSubmissionInteractor } = makeService({ segment: null });

      await expect(service.pushResult(pushDto(), alice)).rejects.toThrow(
        'Сегмент для пользователя alice и проекта ph не найден'
      );
      expect(resultSubmissionInteractor.pushResult).not.toHaveBeenCalled();
    });

    // cap.rid.happy.02
    it('берёт суммы и result_hash из базы, а не из клиентского ввода', async () => {
      const { service, resultSubmissionInteractor } = makeService();

      await service.pushResult(
        pushDto({ contribution_amount: '999.0000 RUB', result_hash: 'подложный' } as any),
        alice
      );

      const sent = resultSubmissionInteractor.pushResult.mock.calls[0][0];
      expect(sent.result_hash).toBe('rh');
      expect(sent.contribution_amount).toBe('100.0000 RUB');
      expect(sent.debt_amount).toBe('5.0000 RUB');
      expect(sent.username).toBe('alice');
      // Погашение займов через этот путь пока не передаётся — пустой список,
      // а не «какие-нибудь» хэши: цепь спишет ровно перечисленные долги.
      expect(sent.debt_hashes).toEqual([]);
    });

    it('ищет сегмент по паре проект + пайщик', async () => {
      const { service, segmentRepository } = makeService();

      await service.pushResult(pushDto(), alice);

      expect(segmentRepository.findOne).toHaveBeenCalledWith({ project_hash: 'ph', username: 'alice' });
    });

    // cap.rid.side.29 — исправлено: пустые суммы сегмента больше не уходят в цепь
    it('отказывает, если у сегмента не заданы суммы взноса или долга', async () => {
      const { service, resultSubmissionInteractor } = makeService({ segment: { username: 'alice' } });

      await expect(service.pushResult(pushDto(), alice)).rejects.toThrow(
        'не синхронизирован с блокчейном'
      );
      expect(resultSubmissionInteractor.pushResult).not.toHaveBeenCalled();
    });

    it('отказывает, если задана сумма взноса, но не задан долг', async () => {
      const { service, resultSubmissionInteractor } = makeService({
        segment: { username: 'alice', intellectual_cost: '100.0000 RUB' },
      });

      await expect(service.pushResult(pushDto(), alice)).rejects.toThrow(
        'не синхронизирован с блокчейном'
      );
      expect(resultSubmissionInteractor.pushResult).not.toHaveBeenCalled();
    });
  });

  describe('подписание актов', () => {
    // cap.rid.side.31
    it('signActAsContributor подставляет пайщика из сессии, игнорируя присланный username', async () => {
      const { service, resultSubmissionInteractor } = makeService();

      await service.signActAsContributor(
        { coopname: 'coop', result_hash: 'rh', act: makeSignedDocument(), username: 'mallory' } as any,
        alice
      );

      expect(resultSubmissionInteractor.signActAsContributor).toHaveBeenCalledWith(
        expect.objectContaining({ username: 'alice' })
      );
    });

    // cap.rid.side.34
    it('signActAsChairman подставляет председателя из сессии, игнорируя присланного', async () => {
      const { service, resultSubmissionInteractor } = makeService();

      await service.signActAsChairman(
        { coopname: 'coop', result_hash: 'rh', act: makeSignedDocument(), chairman: 'mallory' } as any,
        chairman
      );

      expect(resultSubmissionInteractor.signActAsChairman).toHaveBeenCalledWith(
        expect.objectContaining({ chairman: 'bob' })
      );
    });
  });

  describe('generateResultContributionStatement', () => {
    it('отказывает при генерации заявления за другого пайщика', async () => {
      const { service, documentPort } = makeService();

      await expect(
        service.generateResultContributionStatement({ project_hash: 'ph', username: 'mallory' } as any, {} as any, alice)
      ).rejects.toThrow('Вы можете генерировать документы только для себя');
      expect(documentPort.generate).not.toHaveBeenCalled();
    });

    it('отказывает, если текст результата ещё не сформирован', async () => {
      const { service } = makeService({ result: { result_hash: 'rh' } });

      await expect(
        service.generateResultContributionStatement({ project_hash: 'ph', username: 'alice' } as any, {} as any, alice)
      ).rejects.toThrow('Текст результата не найден');
    });

    // cap.rid.side.48
    it('отказывает, если проект не найден', async () => {
      const { service } = makeService({ project: null });

      await expect(
        service.generateResultContributionStatement({ project_hash: 'ph', username: 'alice' } as any, {} as any, alice)
      ).rejects.toThrow('Проект с хешем ph не найден');
    });

    it('отказывает, если у проекта нет родителя с названием', async () => {
      const { service } = makeService({ parentProject: null });

      await expect(
        service.generateResultContributionStatement({ project_hash: 'ph', username: 'alice' } as any, {} as any, alice)
      ).rejects.toThrow('Название проекта не найдено');
    });

    // cap.rid.side.49
    it('отказывает, если сегмент пайщика по проекту не найден', async () => {
      const { service } = makeService({ segment: null });

      await expect(
        service.generateResultContributionStatement({ project_hash: 'ph', username: 'alice' } as any, {} as any, alice)
      ).rejects.toThrow('Сегмент для пользователя alice и проекта ph не найден');
    });

    it('ищет сегмент по проекту из запроса и пайщику из сессии', async () => {
      const { service, segmentRepository } = makeService();

      await service.generateResultContributionStatement(
        { project_hash: 'ph', username: 'alice' } as any,
        {} as any,
        alice
      );

      expect(segmentRepository.findOne).toHaveBeenCalledWith({ project_hash: 'ph', username: 'alice' });
    });

    // ── cap.rid.side.52: guard'ы обязательных полей ─────────────────────
    //
    // Мутационный прогон показал, что порча этих условий не роняла ни одного
    // теста: guard'ы написаны, но не защищены. Заявление о результате уходит
    // в реестр документов и подписывается пайщиком, поэтому пустое поле в нём
    // хуже отказа — документ будет выглядеть законченным.
    //
    // Проверено повторной мутацией: обезвредить сами условия компилятор уже не
    // даёт — они сужают тип, и без них поля уходят в DTO как string|undefined
    // (TS2322). Тесты ниже фиксируют вторую половину — что отказ приходит с
    // называющим поле текстом, а не падает где-то глубже.

    it('cap.rid.side.52: отказывает, если у компонента нет названия', async () => {
      const { service, documentPort } = makeService({
        project: { project_hash: 'ph', parent_hash: 'parent', fact: { total: '1000.0000 RUB' } },
      });

      await expect(
        service.generateResultContributionStatement({ project_hash: 'ph', username: 'alice' } as any, {} as any, alice)
      ).rejects.toThrow('Название компонента не найдено');
      expect(documentPort.generate).not.toHaveBeenCalled();
    });

    it('cap.rid.side.52: отказывает, если у сегмента нет стоимости интеллектуального вклада', async () => {
      const { service, documentPort } = makeService({
        segment: { project_hash: 'ph', username: 'alice', share_percent: 50 },
      });

      await expect(
        service.generateResultContributionStatement({ project_hash: 'ph', username: 'alice' } as any, {} as any, alice)
      ).rejects.toThrow('Сумма сегмента не найдена');
      expect(documentPort.generate).not.toHaveBeenCalled();
    });

    it('cap.rid.side.52: отказывает, если у проекта нет фактической суммы', async () => {
      const { service, documentPort } = makeService({
        project: { project_hash: 'ph', title: 'Компонент', parent_hash: 'parent', fact: {} },
      });

      await expect(
        service.generateResultContributionStatement({ project_hash: 'ph', username: 'alice' } as any, {} as any, alice)
      ).rejects.toThrow('Сумма проекта не найдена');
      expect(documentPort.generate).not.toHaveBeenCalled();
    });

    // cap.rid.side.42
    it('отказывает, если сумма проекта не положительна — доля неисчислима', async () => {
      const { service } = makeService({
        project: { project_hash: 'ph', title: 'Компонент', parent_hash: 'parent', fact: { total: '0.0000 RUB' } },
      });

      await expect(
        service.generateResultContributionStatement({ project_hash: 'ph', username: 'alice' } as any, {} as any, alice)
      ).rejects.toThrow('Сумма проекта не может быть меньше или равна 0');
    });

    // cap.rid.side.43
    it('отказывает, если доля участника не задана', async () => {
      const { service } = makeService({
        segment: { intellectual_cost: '100.0000 RUB', debt_amount: '5.0000 RUB', username: 'alice' },
      });

      await expect(
        service.generateResultContributionStatement({ project_hash: 'ph', username: 'alice' } as any, {} as any, alice)
      ).rejects.toThrow('Доля участника в результате');
    });

    it('передаёт долю с восемью знаками и суммы из сегмента', async () => {
      const { service, documentPort } = makeService();

      await service.generateResultContributionStatement(
        { project_hash: 'ph', username: 'alice' } as any,
        {} as any,
        alice
      );

      const { data } = documentPort.generate.mock.calls[0][0];
      expect(data.percent_of_result).toBe('0.50000000');
      expect(data.total_amount).toBe('100.0000 RUB');
      expect(data.component_name).toBe('Компонент');
      expect(data.project_name).toBe('Проект');
    });
  });

  describe('generateResultContributionDecision', () => {
    // cap.rid.side.41
    it.each([
      ['названия компонента', { component_name: 'Другой компонент' }, 'Несоответствие названия компонента'],
      ['названия проекта', { project_name: 'Другой проект' }, 'Несоответствие названия проекта'],
      ['общей суммы', { total_amount: '999.0000 RUB' }, 'Несоответствие общей суммы'],
      ['доли участника', { percent_of_result: '0.99000000' }, 'Несоответствие процента от результата'],
    ])('отказывает при расхождении %s между заявлением и текущими данными', async (_label, patch, message) => {
      const { service, documentPort } = makeService({
        resultByHash: {
          result_hash: 'rh',
          project_hash: 'ph',
          username: 'alice',
          statement: { meta: makeMeta(patch) },
        },
      });

      await expect(
        service.generateResultContributionDecision({ result_hash: 'rh', decision_id: 7 } as any, {} as any, chairman)
      ).rejects.toThrow(message);
      expect(documentPort.generate).not.toHaveBeenCalled();
    });

    it('отказывает, если у результата нет заявления', async () => {
      const { service } = makeService({
        resultByHash: { result_hash: 'rh', project_hash: 'ph', username: 'alice' },
      });

      await expect(
        service.generateResultContributionDecision({ result_hash: 'rh', decision_id: 7 } as any, {} as any, chairman)
      ).rejects.toThrow('Заявление не найдено в данных результата');
    });

    // cap.rid.side.50
    it('отказывает, если результат по хэшу не найден', async () => {
      const { service } = makeService({ resultByHash: null });

      await expect(
        service.generateResultContributionDecision({ result_hash: 'rh', decision_id: 7 } as any, {} as any, chairman)
      ).rejects.toThrow('Результат с хешем rh не найден');
    });

    it('ищет сегмент по проекту и пайщику из результата, а не из запроса', async () => {
      const { service, segmentRepository } = makeService({
        resultByHash: {
          result_hash: 'rh',
          project_hash: 'ph',
          username: 'alice',
          statement: { meta: makeMeta() },
        },
      });

      await service.generateResultContributionDecision(
        { result_hash: 'rh', decision_id: 7 } as any,
        {} as any,
        chairman
      );

      expect(segmentRepository.findOne).toHaveBeenCalledWith({ project_hash: 'ph', username: 'alice' });
    });

    it('генерирует решение, когда заявление сходится с текущими данными', async () => {
      const { service, documentPort } = makeService({
        resultByHash: {
          result_hash: 'rh',
          project_hash: 'ph',
          username: 'alice',
          statement: { meta: makeMeta() },
        },
      });

      await service.generateResultContributionDecision(
        { result_hash: 'rh', decision_id: 7 } as any,
        {} as any,
        chairman
      );

      const { data } = documentPort.generate.mock.calls[0][0];
      expect(data.decision_id).toBe(7);
      expect(data.username).toBe('alice');
    });
  });

  describe('generateResultContributionAct', () => {
    function resultWithActSources(statementPatch = {}, decisionPatch = {}) {
      return {
        result_hash: 'rh',
        project_hash: 'ph',
        username: 'alice',
        statement: { meta: makeMeta(statementPatch) },
        authorization: { meta: makeMeta({ decision_id: 7, ...decisionPatch }) },
      };
    }

    // cap.rid.side.39
    it.each([
      ['названия компонента', { component_name: 'Другой' }, 'Несоответствие названия компонента'],
      ['названия проекта', { project_name: 'Другой' }, 'Несоответствие названия проекта'],
      ['общей суммы', { total_amount: '999.0000 RUB' }, 'Несоответствие общей суммы'],
      ['доли участника', { percent_of_result: '0.99000000' }, 'Несоответствие процента от результата'],
      ['хэша результата', { result_hash: 'иной' }, 'Несоответствие хеша результата'],
    ])('отказывает при расхождении %s между заявлением и решением совета', async (_label, patch, message) => {
      const { service, documentPort } = makeService({
        resultByHash: resultWithActSources({}, patch),
      });

      await expect(
        service.generateResultContributionAct({ result_hash: 'rh', username: 'alice' } as any, {} as any, alice)
      ).rejects.toThrow(message);
      expect(documentPort.generate).not.toHaveBeenCalled();
    });

    // cap.rid.side.51
    it('отказывает, если результат по хэшу не найден', async () => {
      const { service } = makeService({ resultByHash: null });

      await expect(
        service.generateResultContributionAct({ result_hash: 'rh', username: 'alice' } as any, {} as any, alice)
      ).rejects.toThrow('Результат с хешем rh не найден');
    });

    it('отказывает, если заявление отсутствует', async () => {
      const { service } = makeService({
        resultByHash: { result_hash: 'rh', username: 'alice', authorization: { meta: makeMeta({ decision_id: 7 }) } },
      });

      await expect(
        service.generateResultContributionAct({ result_hash: 'rh', username: 'alice' } as any, {} as any, alice)
      ).rejects.toThrow('Заявление не найдено в данных результата');
    });

    it('отказывает, если у заявления или решения нет мета-данных', async () => {
      const { service } = makeService({
        resultByHash: { result_hash: 'rh', username: 'alice', statement: {}, authorization: {} },
      });

      await expect(
        service.generateResultContributionAct({ result_hash: 'rh', username: 'alice' } as any, {} as any, alice)
      ).rejects.toThrow('Мета-данные заявления или решения не найдены');
    });

    it('отказывает, если решение совета отсутствует', async () => {
      const { service } = makeService({
        resultByHash: { result_hash: 'rh', username: 'alice', statement: { meta: makeMeta() } },
      });

      await expect(
        service.generateResultContributionAct({ result_hash: 'rh', username: 'alice' } as any, {} as any, alice)
      ).rejects.toThrow('Решение совета не найдено в данных результата');
    });

    it('отказывает, если в решении нет decision_id', async () => {
      const { service } = makeService({
        resultByHash: resultWithActSources({}, { decision_id: undefined }),
      });

      await expect(
        service.generateResultContributionAct({ result_hash: 'rh', username: 'alice' } as any, {} as any, alice)
      ).rejects.toThrow('ID решения не найден');
    });

    // cap.rid.side.40
    it('связывает result_act_hash и с хэшем результата, и с номером решения', async () => {
      const hashes = new Set<string>();

      for (const [resultHash, decisionId] of [
        ['rh', 7],
        ['rh', 8],
        ['иной', 7],
      ] as const) {
        const { service, documentPort } = makeService({
          resultByHash: resultWithActSources({ result_hash: resultHash }, { result_hash: resultHash, decision_id: decisionId }),
        });

        await service.generateResultContributionAct(
          { result_hash: resultHash, username: 'alice' } as any,
          {} as any,
          alice
        );

        const { data } = documentPort.generate.mock.calls[0][0];
        expect(data.result_act_hash).toMatch(/^[0-9a-f]{64}$/);
        hashes.add(data.result_act_hash);
      }

      // Смена любого из двух входных значений обязана менять хэш акта.
      expect(hashes.size).toBe(3);
    });

    it('повторный вызов с теми же входными даёт тот же result_act_hash', async () => {
      const run = async () => {
        const { service, documentPort } = makeService({ resultByHash: resultWithActSources() });
        await service.generateResultContributionAct(
          { result_hash: 'rh', username: 'alice' } as any,
          {} as any,
          alice
        );
        return documentPort.generate.mock.calls[0][0].data.result_act_hash;
      };

      expect(await run()).toBe(await run());
    });

    it('председателю разрешено генерировать акт по чужому результату', async () => {
      const { service, documentPort } = makeService({ resultByHash: resultWithActSources() });

      await service.generateResultContributionAct(
        { result_hash: 'rh', username: 'alice' } as any,
        {} as any,
        chairman
      );

      expect(documentPort.generate).toHaveBeenCalled();
    });

    // cap.rid.side.38 — исправлено: владельца определяет result.username
    it('отказывает пайщику по чужому результату, даже если он назвал своё имя', async () => {
      const { service, documentPort } = makeService({
        resultByHash: { ...resultWithActSources(), username: 'mallory' },
      });

      await expect(
        service.generateResultContributionAct({ result_hash: 'rh', username: 'alice' } as any, {} as any, alice)
      ).rejects.toThrow('Вы можете генерировать документы только для себя');
      expect(documentPort.generate).not.toHaveBeenCalled();
    });

    it('разрешает пайщику свой результат независимо от присланного имени', async () => {
      const { service, documentPort } = makeService({ resultByHash: resultWithActSources() });

      await service.generateResultContributionAct(
        { result_hash: 'rh', username: 'кто-угодно' } as any,
        {} as any,
        alice
      );

      expect(documentPort.generate).toHaveBeenCalled();
    });

    it('отказывает, если у результата нет имени пользователя', async () => {
      const { service } = makeService({
        resultByHash: { ...resultWithActSources(), username: undefined },
      });

      await expect(
        service.generateResultContributionAct({ result_hash: 'rh', username: 'alice' } as any, {} as any, alice)
      ).rejects.toThrow('Имя пользователя не найдено в результате');
    });
  });
});
