import { BuhotchGenerator } from '../../../src/extensions/reports/infrastructure/generators/buhotch.generator';
import { Ndfl6Generator } from '../../../src/extensions/reports/infrastructure/generators/ndfl6.generator';
import { RsvGenerator } from '../../../src/extensions/reports/infrastructure/generators/rsv.generator';
import { PsvGenerator } from '../../../src/extensions/reports/infrastructure/generators/psv.generator';
import { DusnGenerator } from '../../../src/extensions/reports/infrastructure/generators/dusn.generator';
import { Fss4Generator } from '../../../src/extensions/reports/infrastructure/generators/fss4.generator';
import { UvVznosyGenerator } from '../../../src/extensions/reports/infrastructure/generators/uv-vznosy.generator';
import { UusnGenerator } from '../../../src/extensions/reports/infrastructure/generators/uusn.generator';
import { ReportType } from '../../../src/extensions/reports/domain/enums/report-type.enum';
import type { ReportInput } from '../../../src/extensions/reports/domain/interfaces/report-generator.interface';

const baseInput: ReportInput = {
  reportType: ReportType.BUHOTCH,
  year: 2025,
  inn: '9728130611',
  kpp: '772801001',
  orgName: 'Потребительский Кооператив "ВОСХОД"',
  ogrn: '1247700283346',
  okved: '94.99',
  okfs: '16',
  okopf: '20200',
  oktmo: '45382000',
  address: 'г. Москва, ул. Тестовая, д.1',
  signerFio: { lastName: 'Иванов', firstName: 'Иван', middleName: 'Иванович' },
  signerSnils: '123-456-789 00',
  ledgerData: [
    { accountId: 51, name: 'Расчётный счёт', balanceCurrent: 150000, balancePrevious: 120000, balancePrePrevious: 80000 },
    { accountId: 80, name: 'Паевой фонд', balanceCurrent: 50000, balancePrevious: 40000, balancePrePrevious: 30000 },
    { accountId: 86, name: 'Целевое финансирование', balanceCurrent: 100000, balancePrevious: 80000, balancePrePrevious: 50000 },
  ],
};

function assertValidXml(xml: string) {
  expect(xml).toBeTruthy();
  expect(xml).toContain('<?xml');
  expect(xml).toContain('windows-1251');
  expect(xml).toContain('<Файл');
  expect(xml).toContain('ИдФайл=');
  expect(xml).toContain('ВерсПрог=');
  expect(xml).toContain('ВерсФорм=');
  expect(xml).toContain('<Документ');
  expect(xml).toContain('</Файл>');
}

function assertHasSigner(xml: string) {
  expect(xml).toContain('<Подписант');
  expect(xml).toContain('ПрПодп="1"');
  expect(xml).toContain('<ФИО');
  expect(xml).toContain('Фамилия="Иванов"');
  expect(xml).toContain('Имя="Иван"');
}

describe('Бухгалтерский баланс (BuhotchGenerator)', () => {
  const gen = new BuhotchGenerator();

  it('reportType = BUHOTCH', () => {
    expect(gen.reportType).toBe(ReportType.BUHOTCH);
  });

  it('генерирует валидный XML', () => {
    const result = gen.generate({ ...baseInput, reportType: ReportType.BUHOTCH });
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
    assertValidXml(result.xml);
  });

  it('содержит корректные атрибуты Документ', () => {
    const result = gen.generate({ ...baseInput, reportType: ReportType.BUHOTCH });
    expect(result.xml).toContain('КНД="0710099"');
    expect(result.xml).toContain('ОтчетГод="2025"');
    expect(result.xml).toContain('Период="34"');
    expect(result.xml).toContain('НомКорр="0"');
    expect(result.xml).toContain('ОКЕИ="384"');
  });

  it('содержит блок СвНП с НПЮЛ', () => {
    const result = gen.generate({ ...baseInput, reportType: ReportType.BUHOTCH });
    expect(result.xml).toContain('<СвНП');
    expect(result.xml).toContain('ОКВЭД2="94.99"');
    expect(result.xml).toContain('ОКФС="16"');
    expect(result.xml).toContain('ОКОПФ="20200"');
    expect(result.xml).toContain('<НПЮЛ');
    expect(result.xml).toContain('ИННЮЛ="9728130611"');
    expect(result.xml).toContain('КПП="772801001"');
  });

  it('содержит подписанта', () => {
    const result = gen.generate({ ...baseInput, reportType: ReportType.BUHOTCH });
    assertHasSigner(result.xml);
  });

  it('содержит Баланс с Активом и Пассивом', () => {
    const result = gen.generate({ ...baseInput, reportType: ReportType.BUHOTCH });
    expect(result.xml).toContain('<Баланс');
    expect(result.xml).toContain('<Актив');
    expect(result.xml).toContain('<ВнеОбА');
    expect(result.xml).toContain('<ОбА');
    expect(result.xml).toContain('<Пассив');
    expect(result.xml).toContain('<ДолгосрОбяз');
    expect(result.xml).toContain('<КраткосрОбяз');
  });

  it('рассчитывает суммы из ledger (в тыс.руб.)', () => {
    const result = gen.generate({ ...baseInput, reportType: ReportType.BUHOTCH });
    expect(result.xml).toContain('СумОтч="150"');
    expect(result.xml).toContain('СумПрдщ="120"');
  });

  it('содержит ЦелИсп', () => {
    const result = gen.generate({ ...baseInput, reportType: ReportType.BUHOTCH });
    expect(result.xml).toContain('<ЦелИсп');
    expect(result.xml).toContain('<ОстатНачОтч');
    expect(result.xml).toContain('<Поступило');
    expect(result.xml).toContain('<Использовано');
    expect(result.xml).toContain('<ОстатКонОтч');
  });

  it('генерирует корректное имя файла', () => {
    const result = gen.generate({ ...baseInput, reportType: ReportType.BUHOTCH });
    expect(result.fileName).toMatch(/^NO_BUHOTCH_9728130611_772801001_\d{8}_/);
  });

  it('работает с нулевыми данными ledger', () => {
    const input = { ...baseInput, reportType: ReportType.BUHOTCH as const, ledgerData: [] };
    const result = gen.generate(input);
    expect(result.isValid).toBe(true);
    expect(result.xml).toContain('СумОтч="0"');
  });
});

describe('6-НДФЛ (Ndfl6Generator)', () => {
  const gen = new Ndfl6Generator();

  it('reportType = NDFL6', () => {
    expect(gen.reportType).toBe(ReportType.NDFL6);
  });

  it('генерирует нулевой отчёт', () => {
    const result = gen.generate({ ...baseInput, reportType: ReportType.NDFL6, period: 1 });
    expect(result.isValid).toBe(true);
    assertValidXml(result.xml);
  });

  it('атрибуты Документ', () => {
    const result = gen.generate({ ...baseInput, reportType: ReportType.NDFL6, period: 2 });
    expect(result.xml).toContain('КНД="1151100"');
    expect(result.xml).toContain('ВерсФорм="5.05"');
    expect(result.xml).toContain('Период="31"');
    expect(result.xml).toContain('КодНО="7728"');
    expect(result.xml).toContain('ПоМесту="214"');
  });

  it('ОКТМО в СвНП', () => {
    const result = gen.generate({ ...baseInput, reportType: ReportType.NDFL6, period: 1 });
    expect(result.xml).toContain('ОКТМО="45382000"');
  });

  it('содержит РасчСумНал с нулями', () => {
    const result = gen.generate({ ...baseInput, reportType: ReportType.NDFL6, period: 1 });
    expect(result.xml).toContain('<НДФЛ6.2');
    expect(result.xml).toContain('<РасчСумНал');
    expect(result.xml).toContain('Ставка="13"');
    expect(result.xml).toContain('КолФЛ="0"');
    expect(result.xml).toContain('НалБаза="0"');
  });

  it('подписант', () => {
    const result = gen.generate({ ...baseInput, reportType: ReportType.NDFL6, period: 1 });
    assertHasSigner(result.xml);
  });

  it('корректные коды периодов', () => {
    const r1 = gen.generate({ ...baseInput, reportType: ReportType.NDFL6, period: 1 });
    expect(r1.xml).toContain('Период="21"');
    const r3 = gen.generate({ ...baseInput, reportType: ReportType.NDFL6, period: 3 });
    expect(r3.xml).toContain('Период="33"');
    const r4 = gen.generate({ ...baseInput, reportType: ReportType.NDFL6, period: 4 });
    expect(r4.xml).toContain('Период="34"');
  });
});

describe('РСВ (RsvGenerator)', () => {
  const gen = new RsvGenerator();

  it('reportType = RSV', () => {
    expect(gen.reportType).toBe(ReportType.RSV);
  });

  it('генерирует нулевой отчёт', () => {
    const result = gen.generate({ ...baseInput, reportType: ReportType.RSV, period: 1 });
    expect(result.isValid).toBe(true);
    assertValidXml(result.xml);
  });

  it('атрибуты Документ', () => {
    const result = gen.generate({ ...baseInput, reportType: ReportType.RSV, period: 1 });
    expect(result.xml).toContain('КНД="1151111"');
    expect(result.xml).toContain('ВерсФорм="5.08"');
    expect(result.xml).toContain('ПоМесту="214"');
  });

  it('содержит РасчетСВ с ОбязПлатСВ', () => {
    const result = gen.generate({ ...baseInput, reportType: ReportType.RSV, period: 1 });
    expect(result.xml).toContain('<РасчетСВ');
    expect(result.xml).toContain('<ОбязПлатСВ');
    expect(result.xml).toContain('ТипПлат="1"');
    expect(result.xml).toContain('ОКТМО="45382000"');
  });

  it('СвНП с СрЧисл', () => {
    const result = gen.generate({ ...baseInput, reportType: ReportType.RSV, period: 1 });
    expect(result.xml).toContain('СрЧисл="1"');
  });
});

describe('ПСВ (PsvGenerator)', () => {
  const gen = new PsvGenerator();

  it('reportType = PSV', () => {
    expect(gen.reportType).toBe(ReportType.PSV);
  });

  it('генерирует нулевой отчёт с ПерсСвФЛ', () => {
    const result = gen.generate({ ...baseInput, reportType: ReportType.PSV, period: 1 });
    expect(result.isValid).toBe(true);
    assertValidXml(result.xml);
  });

  it('атрибуты Документ', () => {
    const result = gen.generate({ ...baseInput, reportType: ReportType.PSV, period: 3 });
    expect(result.xml).toContain('КНД="1151162"');
    expect(result.xml).toContain('ВерсФорм="5.01"');
    expect(result.xml).toContain('Период="03"');
  });

  it('содержит ПерсСвФЛ с СНИЛС', () => {
    const result = gen.generate({ ...baseInput, reportType: ReportType.PSV, period: 1 });
    expect(result.xml).toContain('<ПерсСвФЛ');
    expect(result.xml).toContain('СНИЛС="123-456-789 00"');
    expect(result.xml).toContain('СумВыпл="0"');
  });

  it('имя файла NO_PERSSVFL', () => {
    const result = gen.generate({ ...baseInput, reportType: ReportType.PSV, period: 1 });
    expect(result.fileName).toMatch(/^NO_PERSSVFL_/);
  });
});

describe('ДУСН (DusnGenerator)', () => {
  const gen = new DusnGenerator();

  it('reportType = DUSN', () => {
    expect(gen.reportType).toBe(ReportType.DUSN);
  });

  it('генерирует нулевую декларацию', () => {
    const result = gen.generate({ ...baseInput, reportType: ReportType.DUSN });
    expect(result.isValid).toBe(true);
    assertValidXml(result.xml);
  });

  it('атрибуты Документ', () => {
    const result = gen.generate({ ...baseInput, reportType: ReportType.DUSN });
    expect(result.xml).toContain('КНД="1152017"');
    expect(result.xml).toContain('ВерсФорм="5.09"');
    expect(result.xml).toContain('Период="34"');
    expect(result.xml).toContain('ПоМесту="120"');
  });

  it('содержит УСН с ОбНал=1', () => {
    const result = gen.generate({ ...baseInput, reportType: ReportType.DUSN });
    expect(result.xml).toContain('<УСН');
    expect(result.xml).toContain('ОбНал="1"');
    expect(result.xml).toContain('<СумНалПУ_НП');
    expect(result.xml).toContain('ОКТМО="45382000"');
  });

  it('РасчНал1 с нулевыми суммами', () => {
    const result = gen.generate({ ...baseInput, reportType: ReportType.DUSN });
    expect(result.xml).toContain('<РасчНал1');
    expect(result.xml).toContain('ПризНП="2"');
    expect(result.xml).toContain('СтавкаНалПер="6.0"');
  });
});

describe('4-ФСС (Fss4Generator)', () => {
  const gen = new Fss4Generator();

  it('reportType = FSS4', () => {
    expect(gen.reportType).toBe(ReportType.FSS4);
  });

  it('генерирует XML', () => {
    const result = gen.generate({ ...baseInput, reportType: ReportType.FSS4, period: 1 });
    expect(result.isValid).toBe(true);
    assertValidXml(result.xml);
  });

  it('имя файла EFS1', () => {
    const result = gen.generate({ ...baseInput, reportType: ReportType.FSS4, period: 1 });
    expect(result.fileName).toMatch(/^EFS1_/);
  });
});

describe('Уведомление о взносах (UvVznosyGenerator)', () => {
  const gen = new UvVznosyGenerator();

  it('reportType = UV_VZNOSY', () => {
    expect(gen.reportType).toBe(ReportType.UV_VZNOSY);
  });

  it('генерирует нулевое уведомление', () => {
    const result = gen.generate({ ...baseInput, reportType: ReportType.UV_VZNOSY, period: 3 });
    expect(result.isValid).toBe(true);
    assertValidXml(result.xml);
  });

  it('атрибуты Документ', () => {
    const result = gen.generate({ ...baseInput, reportType: ReportType.UV_VZNOSY, period: 3 });
    expect(result.xml).toContain('КНД="1110355"');
    expect(result.xml).toContain('ВерсФорм="5.03"');
  });

  it('содержит УвИсчСумНалог', () => {
    const result = gen.generate({ ...baseInput, reportType: ReportType.UV_VZNOSY, period: 5 });
    expect(result.xml).toContain('<УвИсчСумНалог');
    expect(result.xml).toContain('ОКТМО="45382000"');
    expect(result.xml).toContain('СумНалогАванс="0"');
    expect(result.xml).toContain('Год="2025"');
  });

  it('СвНП с НПЮЛ (без НаимОрг)', () => {
    const result = gen.generate({ ...baseInput, reportType: ReportType.UV_VZNOSY, period: 1 });
    expect(result.xml).toContain('<НПЮЛ');
    expect(result.xml).toContain('ИННЮЛ="9728130611"');
  });
});

describe('Уведомление по УСН (UusnGenerator)', () => {
  const gen = new UusnGenerator();

  it('reportType = UUSN', () => {
    expect(gen.reportType).toBe(ReportType.UUSN);
  });

  it('генерирует нулевое уведомление', () => {
    const result = gen.generate({ ...baseInput, reportType: ReportType.UUSN, period: 2 });
    expect(result.isValid).toBe(true);
    assertValidXml(result.xml);
  });

  it('КБК для УСН', () => {
    const result = gen.generate({ ...baseInput, reportType: ReportType.UUSN, period: 1 });
    expect(result.xml).toContain('КБК="18210501021011000110"');
  });
});

describe('ReportRegistryService', () => {
  const { ReportRegistryService } = require('../../../src/extensions/reports/domain/services/report-registry.service');
  const registry = new ReportRegistryService();

  beforeAll(() => {
    registry.register(new BuhotchGenerator());
    registry.register(new Ndfl6Generator());
    registry.register(new RsvGenerator());
    registry.register(new PsvGenerator());
    registry.register(new DusnGenerator());
    registry.register(new Fss4Generator());
    registry.register(new UvVznosyGenerator());
    registry.register(new UusnGenerator());
  });

  it('регистрирует все 8 генераторов', () => {
    const reports = registry.getAvailableReports();
    expect(reports).toHaveLength(8);
  });

  it('генерирует отчёт по типу', () => {
    const result = registry.generate({ ...baseInput, reportType: ReportType.BUHOTCH });
    expect(result.isValid).toBe(true);
    expect(result.xml).toContain('<Баланс');
  });

  it('выбрасывает исключение для незарегистрированного типа', () => {
    expect(() => registry.generate({ ...baseInput, reportType: 'unknown' as any })).toThrow();
  });

  it('isGenerationAvailable для ежегодного отчёта', () => {
    expect(registry.isGenerationAvailable(ReportType.BUHOTCH, 2024)).toBe(true);
    expect(registry.isGenerationAvailable(ReportType.BUHOTCH, 2030)).toBe(false);
  });

  it('isGenerationAvailable для ежеквартального', () => {
    expect(registry.isGenerationAvailable(ReportType.NDFL6, 2020, 1)).toBe(true);
  });
});
