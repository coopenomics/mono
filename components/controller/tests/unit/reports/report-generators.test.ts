import { readFile, readdir } from 'fs/promises';
import { join } from 'path';
import iconv from 'iconv-lite';
import { parseXml, type Document } from 'libxmljs2';
import { BuhotchGenerator } from '../../../src/extensions/reports/infrastructure/generators/buhotch.generator';
import { Ndfl6Generator } from '../../../src/extensions/reports/infrastructure/generators/ndfl6.generator';
import { RsvGenerator } from '../../../src/extensions/reports/infrastructure/generators/rsv.generator';
import { PsvGenerator } from '../../../src/extensions/reports/infrastructure/generators/psv.generator';
import { DusnGenerator } from '../../../src/extensions/reports/infrastructure/generators/dusn.generator';
import { Fss4Generator } from '../../../src/extensions/reports/infrastructure/generators/fss4.generator';
import { UvVznosyGenerator } from '../../../src/extensions/reports/infrastructure/generators/uv-vznosy.generator';
import { UusnGenerator } from '../../../src/extensions/reports/infrastructure/generators/uusn.generator';
import { ReportType, REPORT_CONFIG } from '../../../src/extensions/reports/domain/enums/report-type.enum';
import type { ReportInput } from '../../../src/extensions/reports/domain/interfaces/report-generator.interface';

const SCHEMAS_DIR = join(__dirname, '..', '..', '..', 'src', 'extensions', 'reports', 'schemas');
// Санитизированные фикстуры ПК "Ромашка". Реальные отчёты ВОСХОДа лежат в
// `components/reports-standarts/ВОСХОД/` — они в .gitignore, т.к. содержат
// живые ИНН/КПП/ОГРН/ФИО. Для публичных тестов все реквизиты заменены на
// вымышленные; структура XML и атрибуты (КНД, ВерсФорм, Период, коды НО)
// сохранены как у эталонов ФНС/СФР — мы сверяем именно их, а не данные.
const REFERENCES_DIR = join(__dirname, '..', '..', 'fixtures', 'reports-references');

/**
 * Unit-тесты генераторов отчётности ФНС/ФСС.
 *
 * Тесты выполняют двойную проверку:
 *   1) Структурную сверку выхлопа generate() с эталонами ВОСХОДа
 *      (`components/reports-standarts/ВОСХОД/*.xml`) — те же КНД, ВерсФорм,
 *      Период, ПрПодп, обязательные поля.
 *   2) XSD-валидацию: для ФНС (cp1251) — прямо из `schemas/*.xsd`, для
 *      ЕФС-1 (utf-8 + multi-file imports) — из `schemas/efs1/` с chdir в
 *      эту директорию на время validate (libxml2 резолвит `xs:import
 *      schemaLocation` относительно CWD) + подменой кириллических
 *      namespace'ов в XML на ASCII-safe (см. `schemas/efs1/README.md`).
 */

const EFS1_DIR = join(SCHEMAS_DIR, 'efs1');
const EFS1_MAIN_XSD = 'efs1.xsd';
const EFS1_XSD_KEY = 'efs1/efs1.xsd';

// Синхронно с XsdValidatorService.EFS1_XML_NS_MAP: подменяем кириллические
// namespace'ы в XML ЕФС-1 на ASCII-safe перед валидацией.
const EFS1_XML_NS_MAP: [string, string][] = [
  ['http://пф.рф/ВС/ЕФС/2026-01-01', 'http://ns.efs.ru/VS/EFS/2026-01-01'],
  ['http://пф.рф/ЕФС-1/2026-01-01',  'http://ns.efs.ru/EFS-1/2026-01-01'],
  ['http://пф.рф/ВС/типы/2025-01-01','http://ns.efs.ru/VS/types/2025-01-01'],
  ['http://пф.рф/АФ/2025-01-01',     'http://ns.efs.ru/AF/2025-01-01'],
  ['http://пф.рф/УТ/2025-01-01',     'http://ns.efs.ru/UT/2025-01-01'],
];

const xsdCache = new Map<string, Document>();
let xsdLoadError: string | null = null;

async function loadAllSchemas(): Promise<void> {
  try {
    // ФНС — в корне schemas/, cp1251.
    const files = await readdir(SCHEMAS_DIR, { withFileTypes: true });
    for (const d of files.filter((f) => f.isFile() && f.name.toLowerCase().endsWith('.xsd'))) {
      const buf = await readFile(join(SCHEMAS_DIR, d.name));
      const decoded = iconv.decode(buf, 'win1251');
      const utf8Source = decoded.replace(/encoding="windows-1251"/i, 'encoding="utf-8"');
      xsdCache.set(d.name, parseXml(utf8Source));
    }
    // ЕФС-1 — в schemas/efs1/, utf-8, с xs:import'ами. Парсинг требует CWD
    // = efs1/ чтобы libxml2 нашёл зависимые xsd.
    const origCwd = process.cwd();
    try {
      process.chdir(EFS1_DIR);
      const buf = await readFile(EFS1_MAIN_XSD);
      xsdCache.set(EFS1_XSD_KEY, parseXml(buf.toString('utf-8')));
    } finally {
      process.chdir(origCwd);
    }
  } catch (e) {
    xsdLoadError = e instanceof Error ? e.message : String(e);
  }
}

function validateAgainstXsd(xml: string, xsdFile: string): { isValid: boolean; errors: string[] } {
  const xsd = xsdCache.get(xsdFile);
  if (!xsd) {
    return { isValid: false, errors: [`XSD не загружена: ${xsdFile}`] };
  }
  // Для ЕФС-1: подменяем namespace'ы в XML + chdir на время validate.
  const isEfs1 = xsdFile === EFS1_XSD_KEY;
  let source = xml.replace(/encoding="windows-1251"/i, 'encoding="utf-8"');
  if (isEfs1) {
    for (const [cyr, ascii] of EFS1_XML_NS_MAP) {
      source = source.split(cyr).join(ascii);
    }
  }
  let doc: Document;
  try {
    doc = parseXml(source);
  } catch (e) {
    return { isValid: false, errors: [`parse: ${e instanceof Error ? e.message : String(e)}`] };
  }
  const origCwd = process.cwd();
  try {
    if (isEfs1) process.chdir(EFS1_DIR);
    const ok = doc.validate(xsd);
    if (ok) return { isValid: true, errors: [] };
    const raw = doc.validationErrors ?? [];
    return {
      isValid: false,
      errors: raw.map((e: any) => `line ${e.line ?? '?'}: ${e.message ?? String(e)}`),
    };
  } finally {
    if (isEfs1) process.chdir(origCwd);
  }
}

// Все реквизиты — вымышленные (ПК "Ромашка"), совпадают с фикстурами.
const baseInput: ReportInput = {
  reportType: ReportType.BUHOTCH,
  year: 2026,
  inn: '7701234567',
  kpp: '770101001',
  orgName: 'Потребительский Кооператив "Ромашка"',
  ogrn: '1237700000001',
  okved: '94.99',
  okfs: '16',
  okopf: '20100',
  oktmo: '45000000',
  address: '101000, Москва г, ул. Тестовая, д. 1',
  signerFio: { lastName: 'Петров', firstName: 'Пётр', middleName: 'Петрович' },
  signerType: 'representative',
  signerRepDoc: 'Доверенность №1 от 01.01.2024',
  signerSnils: '123-456-789 00',
  sfrRegNumber: '7701234567',
  chairmanPosition: 'Председатель Совета',
  okpo: '12345678',
  correctionNumber: 0,
};

function assertFnsWellFormed(xml: string): void {
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

function assertRepresentativeSigner(xml: string): void {
  expect(xml).toContain('<Подписант');
  expect(xml).toContain('ПрПодп="2"');
  expect(xml).toContain('Фамилия="Петров"');
  expect(xml).toContain('Имя="Пётр"');
  expect(xml).toContain('Отчество="Петрович"');
  expect(xml).toContain('<СвПред');
  expect(xml).toContain('НаимДок="Доверенность №1 от 01.01.2024"');
}

beforeAll(async () => {
  await loadAllSchemas();
});

describe('XSD-схемы', () => {
  it('все XSD из schemas/ загружены без ошибок', () => {
    expect(xsdLoadError).toBeNull();
    expect(xsdCache.size).toBeGreaterThan(0);
  });

  it('все xsdFile из REPORT_CONFIG присутствуют в cache', () => {
    for (const [reportType, cfg] of Object.entries(REPORT_CONFIG)) {
      if (!cfg.xsdFile) continue;
      expect(xsdCache.has(cfg.xsdFile)).toBe(true);
    }
  });

  it('XSD ЕФС-1 загружена из subdir efs1/', () => {
    expect(xsdCache.has(EFS1_XSD_KEY)).toBe(true);
  });
});

describe('Бухгалтерский баланс НКО (BuhotchGenerator)', () => {
  const gen = new BuhotchGenerator();

  it('reportType = BUHOTCH', () => {
    expect(gen.reportType).toBe(ReportType.BUHOTCH);
  });

  it('генерирует валидный XML (НКО-форма КНД 0710096)', () => {
    const result = gen.generate({ ...baseInput, reportType: ReportType.BUHOTCH });
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
    assertFnsWellFormed(result.xml);
  });

  it('содержит атрибуты Документ как в эталоне', () => {
    const result = gen.generate({ ...baseInput, reportType: ReportType.BUHOTCH });
    expect(result.xml).toContain('КНД="0710096"');
    expect(result.xml).toContain('Период="91"');
    expect(result.xml).toContain('ОтчетГод="2026"');
    expect(result.xml).toContain('ВерсФорм="5.04"');
    expect(result.xml).toContain('ОКЕИ="384"');
  });

  it('содержит блок СвНП с НПЮЛ и ОКПО/ОКФС/ОКОПФ', () => {
    const result = gen.generate({ ...baseInput, reportType: ReportType.BUHOTCH });
    expect(result.xml).toContain('ОКПО="12345678"');
    expect(result.xml).toContain('ОКФС="16"');
    expect(result.xml).toContain('ОКОПФ="20100"');
    expect(result.xml).toContain('ИННЮЛ="7701234567"');
    expect(result.xml).toContain('КПП="770101001"');
  });

  it('содержит НКО-структуру Баланса (без ВнеОбА/ОбА)', () => {
    const result = gen.generate({ ...baseInput, reportType: ReportType.BUHOTCH });
    expect(result.xml).toContain('<Баланс');
    expect(result.xml).toContain('ОКУД="0710001"');
    expect(result.xml).toContain('<Актив');
    expect(result.xml).toContain('<Пассив');
    expect(result.xml).not.toContain('<ВнеОбА');
    expect(result.xml).not.toContain('<ОбА');
    expect(result.xml).not.toContain('<ДолгосрОбяз');
    expect(result.xml).not.toContain('<КраткосрОбяз');
  });

  it('считает балансы из ledger в тыс. руб.', () => {
    const input = {
      ...baseInput,
      reportType: ReportType.BUHOTCH as const,
      ledgerData: [
        { accountId: 51000, name: 'Р/С', balanceCurrent: 150000, balancePrevious: 120000, balancePrePrevious: 80000 },
        { accountId: 80000, name: 'Пай', balanceCurrent: 50000, balancePrevious: 40000, balancePrePrevious: 30000 },
        { accountId: 86000, name: 'ЦФ', balanceCurrent: 100000, balancePrevious: 80000, balancePrePrevious: 50000 },
      ],
    };
    const result = gen.generate(input);
    // 150000 руб → 150 тыс в ДенежнСр; 150+50+100 = 150 тыс в Актив (целевые идут в Пассив)
    expect(result.xml).toContain('<ДенежнСр');
    expect(result.xml).toContain('<ЦелевСредства');
  });

  it('имя файла NO_BOUPR_<tax>_<tax>_<inn><kpp>_<date>_<uuid>', () => {
    const result = gen.generate({ ...baseInput, reportType: ReportType.BUHOTCH });
    expect(result.fileName).toMatch(
      /^NO_BOUPR_7701_7701_7701234567770101001_\d{8}_[0-9a-f-]{36}$/,
    );
  });

  it('подписант — представитель по доверенности', () => {
    const result = gen.generate({ ...baseInput, reportType: ReportType.BUHOTCH });
    assertRepresentativeSigner(result.xml);
  });

  it('содержит <Пояснения> с НаимФайлПЗ ≥1 символа (XSD minLength=1)', () => {
    const result = gen.generate({ ...baseInput, reportType: ReportType.BUHOTCH });
    expect(result.xml).toContain('<Пояснения');
    expect(result.xml).toMatch(/НаимФайлПЗ="[^"]+"/);
  });

  it('проходит XSD-валидацию по NO_BOUPR_1_159_00_05_04_01.xsd', () => {
    const result = gen.generate({ ...baseInput, reportType: ReportType.BUHOTCH });
    const v = validateAgainstXsd(result.xml, REPORT_CONFIG[ReportType.BUHOTCH].xsdFile);
    if (!v.isValid) console.error('BUHOTCH XSD errors:', v.errors.slice(0, 10));
    expect(v.isValid).toBe(true);
  });
});

describe('6-НДФЛ (Ndfl6Generator)', () => {
  const gen = new Ndfl6Generator();

  it('reportType = NDFL6', () => {
    expect(gen.reportType).toBe(ReportType.NDFL6);
  });

  it('генерирует нулевой отчёт (КНД 1151100, ВерсФорм 5.05)', () => {
    const result = gen.generate({ ...baseInput, reportType: ReportType.NDFL6, period: 1 });
    expect(result.isValid).toBe(true);
    assertFnsWellFormed(result.xml);
    expect(result.xml).toContain('КНД="1151100"');
    expect(result.xml).toContain('ВерсФорм="5.05"');
    expect(result.xml).toContain('Период="21"');
    expect(result.xml).toContain('КодНО="7701"');
    expect(result.xml).toContain('ПоМесту="214"');
  });

  it('ОКТМО на уровне СвНП', () => {
    const result = gen.generate({ ...baseInput, reportType: ReportType.NDFL6, period: 1 });
    expect(result.xml).toContain('ОКТМО="45000000"');
  });

  it('ОбязНА с КБК и двумя дочерними блоками', () => {
    const result = gen.generate({ ...baseInput, reportType: ReportType.NDFL6, period: 1 });
    expect(result.xml).toContain('<НДФЛ6.2');
    expect(result.xml).toContain('<ОбязНА');
    expect(result.xml).toContain('КБК="18210102010011000110"');
    expect(result.xml).toContain('<СведСумНалУд');
    expect(result.xml).toContain('<СведСумНалВоз');
    expect(result.xml).toContain('СумНал6Срок="0"');
    expect(result.xml).toContain('СумНалВоз6Срок="0"');
  });

  it('РасчСумНал со Ставка=13 и 27 нулевыми атрибутами', () => {
    const result = gen.generate({ ...baseInput, reportType: ReportType.NDFL6, period: 1 });
    expect(result.xml).toContain('<РасчСумНал');
    expect(result.xml).toContain('Ставка="13"');
    expect(result.xml).toContain('КолФЛ="0"');
    expect(result.xml).toContain('НалБаза="0"');
    expect(result.xml).toContain('СумНалВозвр23_3Мес="0"');
  });

  it('коды периодов по кварталам (21/31/33/34)', () => {
    expect(gen.generate({ ...baseInput, reportType: ReportType.NDFL6, period: 1 }).xml).toContain('Период="21"');
    expect(gen.generate({ ...baseInput, reportType: ReportType.NDFL6, period: 2 }).xml).toContain('Период="31"');
    expect(gen.generate({ ...baseInput, reportType: ReportType.NDFL6, period: 3 }).xml).toContain('Период="33"');
    expect(gen.generate({ ...baseInput, reportType: ReportType.NDFL6, period: 4 }).xml).toContain('Период="34"');
  });

  it('проходит XSD-валидацию по NO_NDFL6.2_1_231_00_05_05_02.xsd', () => {
    const result = gen.generate({ ...baseInput, reportType: ReportType.NDFL6, period: 1 });
    const v = validateAgainstXsd(result.xml, REPORT_CONFIG[ReportType.NDFL6].xsdFile);
    if (!v.isValid) console.error('NDFL6 XSD errors:', v.errors.slice(0, 10));
    expect(v.isValid).toBe(true);
  });
});

describe('РСВ (RsvGenerator)', () => {
  const gen = new RsvGenerator();

  it('reportType = RSV', () => {
    expect(gen.reportType).toBe(ReportType.RSV);
  });

  it('генерирует нулевой отчёт (КНД 1151111, ВерсФорм 5.08)', () => {
    const result = gen.generate({ ...baseInput, reportType: ReportType.RSV, period: 1 });
    expect(result.isValid).toBe(true);
    assertFnsWellFormed(result.xml);
    expect(result.xml).toContain('КНД="1151111"');
    expect(result.xml).toContain('ВерсФорм="5.08"');
    expect(result.xml).toContain('ПоМесту="214"');
  });

  it('<РасчетСВ/> — пустой self-closing (нулевой отчёт)', () => {
    const result = gen.generate({ ...baseInput, reportType: ReportType.RSV, period: 1 });
    expect(result.xml).toMatch(/<РасчетСВ\s*\/>/);
  });

  it('<СвПред> представителя несёт НаимОрг (особенность РСВ)', () => {
    const result = gen.generate({ ...baseInput, reportType: ReportType.RSV, period: 1 });
    // НаимОрг встречается и в НПЮЛ, и в СвПред — проверяем именно второе.
    const matches = result.xml.match(/НаимОрг="[^"]+"/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
    expect(result.xml).toContain('<СвПред');
  });

  it('проходит XSD-валидацию по NO_RASCHSV_1_162_00_05_08_02.xsd', () => {
    const result = gen.generate({ ...baseInput, reportType: ReportType.RSV, period: 1 });
    const v = validateAgainstXsd(result.xml, REPORT_CONFIG[ReportType.RSV].xsdFile);
    if (!v.isValid) console.error('RSV XSD errors:', v.errors.slice(0, 10));
    expect(v.isValid).toBe(true);
  });
});

describe('ПСВ (PsvGenerator)', () => {
  const gen = new PsvGenerator();

  it('reportType = PSV', () => {
    expect(gen.reportType).toBe(ReportType.PSV);
  });

  it('генерирует нулевой отчёт с ПерсСвФЛ', () => {
    const result = gen.generate({ ...baseInput, reportType: ReportType.PSV, period: 3 });
    expect(result.isValid).toBe(true);
    assertFnsWellFormed(result.xml);
    expect(result.xml).toContain('КНД="1151162"');
    expect(result.xml).toContain('Период="03"');
  });

  it('содержит ПерсСвФЛ с СНИЛС', () => {
    const result = gen.generate({ ...baseInput, reportType: ReportType.PSV, period: 1 });
    expect(result.xml).toContain('<ПерсСвФЛ');
    expect(result.xml).toContain('СНИЛС="123-456-789 00"');
    expect(result.xml).toContain('СумВыпл="0"');
  });

  it('имя файла NO_PERSSVFL_…', () => {
    const result = gen.generate({ ...baseInput, reportType: ReportType.PSV, period: 1 });
    expect(result.fileName).toMatch(/^NO_PERSSVFL_/);
  });

  it('проходит XSD-валидацию по NO_PERSSVFL_1_297_00_05_01_02.xsd', () => {
    const result = gen.generate({ ...baseInput, reportType: ReportType.PSV, period: 1 });
    const v = validateAgainstXsd(result.xml, REPORT_CONFIG[ReportType.PSV].xsdFile);
    if (!v.isValid) console.error('PSV XSD errors:', v.errors.slice(0, 10));
    expect(v.isValid).toBe(true);
  });
});

describe('ДУСН (DusnGenerator)', () => {
  const gen = new DusnGenerator();

  it('reportType = DUSN', () => {
    expect(gen.reportType).toBe(ReportType.DUSN);
  });

  it('генерирует нулевую декларацию (КНД 1152017, ВерсФорм 5.09)', () => {
    const result = gen.generate({ ...baseInput, reportType: ReportType.DUSN });
    expect(result.isValid).toBe(true);
    assertFnsWellFormed(result.xml);
    expect(result.xml).toContain('КНД="1152017"');
    expect(result.xml).toContain('ВерсФорм="5.09"');
    expect(result.xml).toContain('Период="34"');
    expect(result.xml).toContain('ПоМесту="210"');
  });

  it('ОтчетГод = year - 1 (декларация за прошлый год)', () => {
    const result = gen.generate({ ...baseInput, reportType: ReportType.DUSN, year: 2026 });
    expect(result.xml).toContain('ОтчетГод="2025"');
  });

  it('структура УСН → СумНалПУ_НП → РасчНал1 с ПризНП=1 и нулями', () => {
    const result = gen.generate({ ...baseInput, reportType: ReportType.DUSN });
    expect(result.xml).toContain('<УСН');
    expect(result.xml).toContain('ОбНал="1"');
    expect(result.xml).toContain('<СумНалПУ_НП');
    expect(result.xml).toContain('ОКТМО="45000000"');
    expect(result.xml).toContain('<РасчНал1');
    expect(result.xml).toContain('ПризНП="1"');
    expect(result.xml).toContain('<Доход');
    expect(result.xml).toContain('<Ставка');
    expect(result.xml).toContain('<Исчисл');
    expect(result.xml).toContain('<УменНал');
  });

  it('проходит XSD-валидацию по NO_USN_1_030_00_05_09_01.xsd', () => {
    const result = gen.generate({ ...baseInput, reportType: ReportType.DUSN });
    const v = validateAgainstXsd(result.xml, REPORT_CONFIG[ReportType.DUSN].xsdFile);
    if (!v.isValid) console.error('DUSN XSD errors:', v.errors.slice(0, 10));
    expect(v.isValid).toBe(true);
  });
});

describe('ЕФС-1 (Fss4Generator, СФР)', () => {
  const gen = new Fss4Generator();

  it('reportType = FSS4', () => {
    expect(gen.reportType).toBe(ReportType.FSS4);
  });

  it('генерирует XML при переданном sfrRegNumber', () => {
    const result = gen.generate({ ...baseInput, reportType: ReportType.FSS4, period: 1 });
    expect(result.isValid).toBe(true);
    expect(result.xml).toContain('<?xml');
    expect(result.xml).toContain('utf-8');
    expect(result.xml).toContain('<ЭДСФР');
  });

  it('возвращает ошибку без sfrRegNumber', () => {
    const { sfrRegNumber, ...noReg } = baseInput;
    const result = gen.generate({ ...(noReg as ReportInput), reportType: ReportType.FSS4, period: 1 });
    expect(result.isValid).toBe(false);
    expect(result.errors.join('|')).toContain('sfrRegNumber');
  });

  it('имя файла СФР_<рег>_ЕФС-1_…', () => {
    const result = gen.generate({ ...baseInput, reportType: ReportType.FSS4, period: 1 });
    expect(result.fileName).toMatch(/^СФР_7701234567_ЕФС-1_\d{8}_[0-9a-f-]{36}$/);
  });

  it('содержит все 7 namespace объявлений', () => {
    const result = gen.generate({ ...baseInput, reportType: ReportType.FSS4, period: 1 });
    expect(result.xml).toContain('xmlns="http://пф.рф/ЕФС-1/2026-01-01"');
    expect(result.xml).toContain('xmlns:АФ8=');
    expect(result.xml).toContain('xmlns:УТ8=');
    expect(result.xml).toContain('xmlns:ВС8=');
    expect(result.xml).toContain('xmlns:ЕФС8=');
    expect(result.xml).toContain('xmlns:ns1=');
    expect(result.xml).toContain('xmlns:sig=');
  });

  it('содержит структуру ОСС/Численность/РССВ/РПО', () => {
    const result = gen.generate({ ...baseInput, reportType: ReportType.FSS4, period: 1 });
    expect(result.xml).toContain('<Страхователь>');
    expect(result.xml).toContain('<ОСС>');
    expect(result.xml).toContain('<Численность>');
    expect(result.xml).toContain('<РССВ>');
    expect(result.xml).toContain('<РПО>');
    expect(result.xml).toContain('<Руководитель>');
    expect(result.xml).toContain('<СлужебнаяИнформация>');
  });

  it('квартальные коды СФР: 03/06/09/0', () => {
    expect(gen.generate({ ...baseInput, reportType: ReportType.FSS4, period: 1 }).xml).toContain('<Код>03</Код>');
    expect(gen.generate({ ...baseInput, reportType: ReportType.FSS4, period: 2 }).xml).toContain('<Код>06</Код>');
    expect(gen.generate({ ...baseInput, reportType: ReportType.FSS4, period: 3 }).xml).toContain('<Код>09</Код>');
    expect(gen.generate({ ...baseInput, reportType: ReportType.FSS4, period: 4 }).xml).toContain('<Код>0</Код>');
  });

  it('является well-formed XML', () => {
    const result = gen.generate({ ...baseInput, reportType: ReportType.FSS4, period: 1 });
    expect(() => parseXml(result.xml)).not.toThrow();
  });

  it('содержит ДатаЗаполнения в формате YYYY-MM-DD (требование XSD)', () => {
    const result = gen.generate({ ...baseInput, reportType: ReportType.FSS4, period: 1 });
    expect(result.xml).toMatch(/<ДатаЗаполнения>\d{4}-\d{2}-\d{2}<\/ДатаЗаполнения>/);
  });

  it('проходит XSD-валидацию по efs1/efs1.xsd (patched 2024→2026)', () => {
    const result = gen.generate({ ...baseInput, reportType: ReportType.FSS4, period: 1 });
    const v = validateAgainstXsd(result.xml, REPORT_CONFIG[ReportType.FSS4].xsdFile);
    if (!v.isValid) console.error('FSS4 XSD errors:', v.errors.slice(0, 10));
    expect(v.isValid).toBe(true);
  });
});

describe('Уведомление о взносах (UvVznosyGenerator)', () => {
  const gen = new UvVznosyGenerator();

  it('reportType = UV_VZNOSY', () => {
    expect(gen.reportType).toBe(ReportType.UV_VZNOSY);
  });

  it('генерирует нулевое уведомление (КНД 1110355)', () => {
    const result = gen.generate({ ...baseInput, reportType: ReportType.UV_VZNOSY, period: 3 });
    expect(result.isValid).toBe(true);
    assertFnsWellFormed(result.xml);
    expect(result.xml).toContain('КНД="1110355"');
  });

  it('содержит УвИсчСумНалог', () => {
    const result = gen.generate({ ...baseInput, reportType: ReportType.UV_VZNOSY, period: 5 });
    expect(result.xml).toContain('<УвИсчСумНалог');
    expect(result.xml).toContain('ОКТМО="45000000"');
    expect(result.xml).toContain('СумНалогАванс="0"');
    expect(result.xml).toContain('Год="2026"');
  });

  it('проходит XSD-валидацию по UT_UVISCHSUMNAL_1_263_00_05_03_01.xsd', () => {
    const result = gen.generate({ ...baseInput, reportType: ReportType.UV_VZNOSY, period: 3 });
    const v = validateAgainstXsd(result.xml, REPORT_CONFIG[ReportType.UV_VZNOSY].xsdFile);
    if (!v.isValid) console.error('UV_VZNOSY XSD errors:', v.errors.slice(0, 10));
    expect(v.isValid).toBe(true);
  });
});

describe('Уведомление по УСН (UusnGenerator)', () => {
  const gen = new UusnGenerator();

  it('reportType = UUSN', () => {
    expect(gen.reportType).toBe(ReportType.UUSN);
  });

  it('КБК УСН (18210501021011000110)', () => {
    const result = gen.generate({ ...baseInput, reportType: ReportType.UUSN, period: 1 });
    expect(result.isValid).toBe(true);
    expect(result.xml).toContain('КБК="18210501021011000110"');
  });

  it('проходит XSD-валидацию', () => {
    const result = gen.generate({ ...baseInput, reportType: ReportType.UUSN, period: 1 });
    const v = validateAgainstXsd(result.xml, REPORT_CONFIG[ReportType.UUSN].xsdFile);
    if (!v.isValid) console.error('UUSN XSD errors:', v.errors.slice(0, 10));
    expect(v.isValid).toBe(true);
  });
});

describe('Сверка с эталонами (ПК "Ромашка", санитизированные фикстуры)', () => {
  async function readReference(fileName: string): Promise<string> {
    return (await readFile(join(REFERENCES_DIR, fileName))).toString('utf-8');
  }

  it('BUHOTCH: тот же КНД/ВерсФорм/Период что в эталоне', async () => {
    const ref = await readReference('NO_BOUPR_romashka.xml');
    const ours = new BuhotchGenerator().generate({ ...baseInput, reportType: ReportType.BUHOTCH });
    for (const attr of ['КНД="0710096"', 'Период="91"', 'ВерсФорм="5.04"', 'ОКЕИ="384"']) {
      expect(ref).toContain(attr);
      expect(ours.xml).toContain(attr);
    }
  });

  it('NDFL6: тот же КНД/ВерсФорм/ПоМесту', async () => {
    const ref = await readReference('NO_NDFL6.2_romashka.xml');
    const ours = new Ndfl6Generator().generate({ ...baseInput, reportType: ReportType.NDFL6, period: 1 });
    for (const attr of ['КНД="1151100"', 'ВерсФорм="5.05"', 'ПоМесту="214"', 'Ставка="13"']) {
      expect(ref).toContain(attr);
      expect(ours.xml).toContain(attr);
    }
  });

  it('RSV: тот же КНД/ВерсФорм и <РасчетСВ/>', async () => {
    const ref = await readReference('NO_RASCHSV_romashka.xml');
    const ours = new RsvGenerator().generate({ ...baseInput, reportType: ReportType.RSV, period: 1 });
    for (const attr of ['КНД="1151111"', 'ВерсФорм="5.08"']) {
      expect(ref).toContain(attr);
      expect(ours.xml).toContain(attr);
    }
    expect(ref).toMatch(/<РасчетСВ\s*\/>/);
    expect(ours.xml).toMatch(/<РасчетСВ\s*\/>/);
  });

  it('DUSN: тот же КНД/ВерсФорм/ПоМесту и структура РасчНал1', async () => {
    const ref = await readReference('NO_USN_romashka.xml');
    const ours = new DusnGenerator().generate({ ...baseInput, reportType: ReportType.DUSN });
    for (const attr of ['КНД="1152017"', 'ВерсФорм="5.09"', 'ПоМесту="210"', 'ПризНП="1"']) {
      expect(ref).toContain(attr);
      expect(ours.xml).toContain(attr);
    }
  });

  it('EFS1: тот же корень ЭДСФР и набор namespace объявлений', async () => {
    const ref = await readReference('EFS1_romashka.xml');
    const ours = new Fss4Generator().generate({ ...baseInput, reportType: ReportType.FSS4, period: 1 });
    for (const ns of [
      'xmlns="http://пф.рф/ЕФС-1/2026-01-01"',
      'xmlns:АФ8=',
      'xmlns:УТ8=',
      'xmlns:ВС8=',
      'xmlns:ЕФС8=',
      'xmlns:ns1=',
      'xmlns:sig=',
    ]) {
      expect(ref).toContain(ns);
      expect(ours.xml).toContain(ns);
    }
  });

  it('EFS1: та же вложенная структура ОСС (Численность/РССВ/РПО) что в эталоне', async () => {
    const ref = await readReference('EFS1_romashka.xml');
    const ours = new Fss4Generator().generate({ ...baseInput, reportType: ReportType.FSS4, period: 1 });
    for (const el of [
      '<ОСС>',
      '<НомерКорректировки>',
      '<Период>',
      '<Численность>',
      '<РССВ>',
      '<СуммаВыплИн>',
      '<БазаИсч>',
      '<СтраховойТариф>',
      '<ИсчислСтрахВзн>',
      '<РПО>',
      '<ОбщЧисл>',
      '<Результат>',
      '<Классы>',
      '<Подкласс3.1>',
      '<Руководитель>',
      '<СлужебнаяИнформация>',
    ]) {
      expect(ref).toContain(el);
      expect(ours.xml).toContain(el);
    }
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

  it('генерирует отчёт по типу через registry', () => {
    const result = registry.generate({ ...baseInput, reportType: ReportType.BUHOTCH });
    expect(result.isValid).toBe(true);
    expect(result.xml).toContain('<Баланс');
  });

  it('бросает исключение для незарегистрированного типа', () => {
    expect(() => registry.generate({ ...baseInput, reportType: 'unknown' as any })).toThrow();
  });
});
