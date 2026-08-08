import { getAppliedBlockNum } from '../../../src/shared/utils/transact-block-num';

describe('getAppliedBlockNum — номер блока применения транзакции', () => {
  it('берёт block_num из ответа API после broadcast', () => {
    const result: any = {
      response: { processed: { block_num: 128641857 } },
      transaction: { ref_block_num: 60852 },
    };

    expect(getAppliedBlockNum(result)).toBe(128641857);
  });

  it('не подменяет номер блока значением ref_block_num из TaPoS', () => {
    const result: any = { transaction: { ref_block_num: 60852 } };

    expect(getAppliedBlockNum(result)).toBe(0);
  });

  it('принимает block_num строкой — узел отдаёт числа в JSON по-разному', () => {
    const result: any = { response: { processed: { block_num: '128641857' } } };

    expect(getAppliedBlockNum(result)).toBe(128641857);
  });

  it('отдаёт 0 на пустом результате и на транзакции без broadcast', () => {
    expect(getAppliedBlockNum(undefined)).toBe(0);
    expect(getAppliedBlockNum(null)).toBe(0);
    expect(getAppliedBlockNum({} as any)).toBe(0);
    expect(getAppliedBlockNum({ response: {} } as any)).toBe(0);
  });

  it('отдаёт 0 на неинтерпретируемом значении', () => {
    expect(getAppliedBlockNum({ response: { processed: { block_num: 'н/д' } } } as any)).toBe(0);
    expect(getAppliedBlockNum({ response: { processed: { block_num: 0 } } } as any)).toBe(0);
  });
});
