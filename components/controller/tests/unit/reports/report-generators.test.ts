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
import type { BuhotchEditsShape } from '../../../src/extensions/reports/domain/edits-shapes/buhotch-edits.shape';
import type { ZeroReportEditsShape } from '../../../src/extensions/reports/domain/edits-shapes/zero-report-edits.shape';
import { EFS1_XML_NS_MAP } from '../../../src/extensions/reports/infrastructure/services/xsd-validator.service';
import { ReportRegistryService } from '../../../src/extensions/reports/domain/services/report-registry.service';

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
 * Контракт: generator.generate(edits: BuhotchEditsShape | ZeroReportEditsShape).
 * Билд edits'ов — ответственность ReportEditsBuilderService (отдельный юнит,
 * своим тестам которого — своё место). Здесь мы проверяем только то, что
 * генератор:
 *   1) принимает корректный edits-shape и выплёвывает well-formed XML,
 *      совпадающий по атрибутам и структуре с эталонами ФНС/СФР;
 *   2) эхо-возвращает edits.header.idFile в result.fileName и атрибут ИдФайл;
 *   3) для ЕФС-1 — требует signer.sfrRegNumber, иначе isValid=false;
 *   4) проходит XSD-валидацию: для ФНС (cp1251) — прямо из `schemas/*.xsd`,
 *      для ЕФС-1 (utf-8 + multi-file imports) — из `schemas/efs1/` с chdir
 *      в эту директорию на время validate (libxml2 резолвит
 *      `xs:import schemaLocation` относительно CWD) + подменой кириллических
 *      namespace'ов в XML на ASCII-safe (см. `schemas/efs1/README.md`).
 */

const EFS1_DIR = join(SCHEMAS_DIR, 'efs1');
const EFS1_MAIN_XSD = 'efs1.xsd';
const EFS1_XSD_KEY = 'efs1/efs1.xsd';

// EFS1_XML_NS_MAP импортирован из xsd-validator.service — single source of
// truth, чтобы таблица namespace'ов не расходилась между прод и тестом.

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
    // libxmljs2 держит native-память libxml2 — без free() на длинных прогонах
    // (jest --watch) наберём OOM. Прод делает то же в XsdValidatorService.
    const maybeFree = (doc as unknown as { free?: () => void }).free;
    if (typeof maybeFree === 'function') {
      try { maybeFree.call(doc); } catch { /* лучше утечка, чем падение */ }
    }
  }
}

// ---------------------------------------------------------------------------
// Фикстуры edits-shapes для ПК "Ромашка".
//
// Обе фикстуры совпадают по реквизитам с санитизированными XML в
// `tests/fixtures/reports-references/` — это важно для «сверка с эталонами».
// Реальные (не санитизированные) данные ВОСХОДа в .gitignore.
//
// `idFile` в edits — уникальный per-отчёт, нормально его строит
// `ReportEditsBuilderService` в проде. Здесь в фикстурах даём читаемую
// подставу конкретного формата, чтобы тест «fileName == idFile» не зависел
// от runtime-значений (uuid, дата).
// ---------------------------------------------------------------------------

const buhotchBaseEdits: BuhotchEditsShape = {
  header: {
    idFile: 'NO_BOUPR_7701_7701_7701234567770101001_20260401_test-uuid',
    programVersion: 'Test@1.0.0',
    docDate: '01.04.2026',
    reportYear: 2026,
    correctionNumber: 0,
    audit: false,
    approved: false,
  },
  organization: {
    orgName: 'Потребительский Кооператив "Ромашка"',
    inn: '7701234567',
    kpp: '770101001',
    address: '101000, Москва г, ул. Тестовая, д. 1',
    okpo: '12345678',
    okfs: '16',
    okopf: '20100',
  },
  signer: {
    type: 'representative',
    lastName: 'Петров',
    firstName: 'Пётр',
    middleName: 'Петрович',
    repDoc: 'Доверенность №1 от 01.01.2024',
  },
  // Балансы — в тыс. рублей. Нулевой кооператив: активов и пассивов по 0.
  // Тесты, которые проверяют выплёвывание конкретных чисел, переопределяют
  // balance в spread { ...buhotchBaseEdits, balance: {...} }.
  balance: {
    assetsTotal: { otch: 0, prev: 0, prePrev: 0 },
    nonMaterialAndLongFin: null,
    cash: null,
    shortTermFin: null,
    passivesTotal: { otch: 0, prev: 0, prePrev: 0 },
    targetFunds: null,
  },
  notes: {
    explanationFileName: '-',
  },
};

/** Базовый edits для нулёвок (NDFL6/RSV/PSV/DUSN/UUSN/UV_VZNOSY/FSS4). */
const zeroBaseEdits: ZeroReportEditsShape = {
  header: {
    idFile: 'TEST_REPORT_ID',
    versProgram: 'Test@1.0.0',
    docDate: '01.04.2026',
    reportYear: 2026,
    period: 1,
    correctionNumber: 0,
  },
  organization: {
    orgName: 'Потребительский Кооператив "Ромашка"',
    inn: '7701234567',
    kpp: '770101001',
    oktmo: '45000000',
    okved: '94.99',
    okfs: '16',
    okopf: '20100',
    okpo: '12345678',
    ogrn: '1237700000001',
    address: '101000, Москва г, ул. Тестовая, д. 1',
  },
  signer: {
    type: 'representative',
    lastName: 'Петров',
    firstName: 'Пётр',
    middleName: 'Петрович',
    repDoc: 'Доверенность №1 от 01.01.2024',
    snils: '123-456-789 00',
    sfrRegNumber: '7701234567',
    pfrRegNumber: '087-701-579643',
    chairmanPosition: 'Председатель Совета',
  },
};

/** Перекрыть period в zeroBaseEdits (не мутируя исходник). */
function withPeriod(period: number): ZeroReportEditsShape {
  return { ...zeroBaseEdits, header: { ...zeroBaseEdits.header, period } };
}

/** Перекрыть reportYear в zeroBaseEdits. */
function withYear(year: number): ZeroReportEditsShape {
  return { ...zeroBaseEdits, header: { ...zeroBaseEdits.header, reportYear: year } };
}

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
  // Если хоть одна схема не загрузилась — фэйлим весь suite с явной причиной,
  // иначе каждый XSD-тест падает с невнятным "XSD не загружена: ..." и root
  // cause теряется в куче одинаковых сообщений.
  if (xsdLoadError) throw new Error(`loadAllSchemas failed: ${xsdLoadError}`);
});

describe('XSD-схемы', () => {
  it('все XSD из schemas/ загружены без ошибок', () => {
    expect(xsdLoadError).toBeNull();
    expect(xsdCache.size).toBeGreaterThan(0);
  });

  it('все xsdFile из REPORT_CONFIG присутствуют в cache', () => {
    for (const [, cfg] of Object.entries(REPORT_CONFIG)) {
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
    const result = gen.generate(buhotchBaseEdits);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
    assertFnsWellFormed(result.xml);
  });

  it('содержит атрибуты Документ как в эталоне', () => {
    const result = gen.generate(buhotchBaseEdits);
    expect(result.xml).toContain('КНД="0710096"');
    expect(result.xml).toContain('Период="91"');
    expect(result.xml).toContain('ОтчетГод="2026"');
    expect(result.xml).toContain('ВерсФорм="5.04"');
    expect(result.xml).toContain('ОКЕИ="384"');
  });

  it('содержит блок СвНП с ОКПО/ОКФС/ОКОПФ и ИНН/КПП', () => {
    const result = gen.generate(buhotchBaseEdits);
    expect(result.xml).toContain('ОКПО="12345678"');
    expect(result.xml).toContain('ОКФС="16"');
    expect(result.xml).toContain('ОКОПФ="20100"');
    expect(result.xml).toContain('ИННЮЛ="7701234567"');
    expect(result.xml).toContain('КПП="770101001"');
  });

  it('содержит НКО-структуру Баланса (без ВнеОбА/ОбА)', () => {
    const result = gen.generate(buhotchBaseEdits);
    expect(result.xml).toContain('<Баланс');
    expect(result.xml).toContain('ОКУД="0710001"');
    expect(result.xml).toContain('<Актив');
    expect(result.xml).toContain('<Пассив');
    // НКО-форма 0710096 структурно не содержит этих блоков обычного Баланса.
    expect(result.xml).not.toContain('<ВнеОбА');
    expect(result.xml).not.toContain('<ОбА');
    expect(result.xml).not.toContain('<ДолгосрОбяз');
    expect(result.xml).not.toContain('<КраткосрОбяз');
  });

  it('выплёвывает суммы из edits.balance в атрибуты СумОтч/СумПрдщ/СумПрдшв', () => {
    // Генератор не считает баланс — он получает готовые тыс.₽ из edits
    // (расчёт делает ReportEditsBuilderService). Проверяем дословную передачу.
    const result = gen.generate({
      ...buhotchBaseEdits,
      balance: {
        assetsTotal: { otch: 150, prev: 120, prePrev: 80 },
        nonMaterialAndLongFin: null,
        cash: { otch: 150, prev: 120, prePrev: 80 },
        shortTermFin: null,
        passivesTotal: { otch: 150, prev: 100, prePrev: 60 },
        targetFunds: { otch: 150, prev: 100, prePrev: 60 },
      },
    });
    expect(result.xml).toMatch(/<ДенежнСр[^>]*СумОтч="150"/);
    expect(result.xml).toMatch(/<ЦелевСредства[^>]*СумОтч="150"/);
    expect(result.xml).toMatch(/<Актив[^>]*СумОтч="150"[^>]*СумПрдщ="120"[^>]*СумПрдшв="80"/);
    expect(result.xml).toMatch(/<Пассив[^>]*СумОтч="150"[^>]*СумПрдщ="100"[^>]*СумПрдшв="60"/);
  });

  it('эхом возвращает header.idFile в result.fileName и <Файл ИдФайл>', () => {
    // Имя файла строит ReportEditsBuilderService (контракт idFile =
    // `NO_BOUPR_<ИФНС>_<ИФНС>_<ИНН><КПП>_<DDMMYYYY>_<uuid>`). Генератор
    // обязан отдать это имя без модификаций — и в fileName, и в XML-атрибут.
    const result = gen.generate(buhotchBaseEdits);
    expect(result.fileName).toBe(buhotchBaseEdits.header.idFile);
    expect(result.xml).toContain(`ИдФайл="${buhotchBaseEdits.header.idFile}"`);
  });

  it('подписант — представитель по доверенности', () => {
    assertRepresentativeSigner(gen.generate(buhotchBaseEdits).xml);
  });

  it('содержит <Пояснения> с НаимФайлПЗ ≥1 символа (XSD minLength=1)', () => {
    const result = gen.generate(buhotchBaseEdits);
    expect(result.xml).toContain('<Пояснения');
    expect(result.xml).toMatch(/НаимФайлПЗ="[^"]+"/);
  });

  it('проходит XSD-валидацию по NO_BOUPR_1_159_00_05_04_01.xsd', () => {
    const result = gen.generate(buhotchBaseEdits);
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
    const result = gen.generate(withPeriod(1));
    expect(result.isValid).toBe(true);
    assertFnsWellFormed(result.xml);
    expect(result.xml).toContain('КНД="1151100"');
    expect(result.xml).toContain('ВерсФорм="5.05"');
    expect(result.xml).toContain('Период="21"');
    expect(result.xml).toContain('КодНО="7701"');
    expect(result.xml).toContain('ПоМесту="214"');
  });

  it('ОКТМО на уровне СвНП', () => {
    expect(gen.generate(withPeriod(1)).xml).toContain('ОКТМО="45000000"');
  });

  it('ОбязНА с КБК и двумя дочерними блоками', () => {
    const result = gen.generate(withPeriod(1));
    expect(result.xml).toContain('<НДФЛ6.2');
    expect(result.xml).toContain('<ОбязНА');
    expect(result.xml).toContain('КБК="18210102010011000110"');
    expect(result.xml).toContain('<СведСумНалУд');
    expect(result.xml).toContain('<СведСумНалВоз');
    expect(result.xml).toContain('СумНал6Срок="0"');
    expect(result.xml).toContain('СумНалВоз6Срок="0"');
  });

  it('РасчСумНал со Ставка=13 и 27 нулевыми атрибутами', () => {
    const result = gen.generate(withPeriod(1));
    // Ловим открывающий тег целиком — считаем нули именно в нём, а не в
    // соседних блоках (СведСумНалУд/Воз тоже нулевые).
    const tagMatch = result.xml.match(/<РасчСумНал[^>]*\/?>/);
    expect(tagMatch).not.toBeNull();
    const tag = tagMatch![0];
    expect(tag).toContain('Ставка="13"');
    expect(tag).toContain('КБК="18210102010011000110"');
    const zeroAttrs = tag.match(/[А-Яа-я_\d]+="0"/g) ?? [];
    expect(zeroAttrs.length).toBe(27);
  });

  it('коды периодов по кварталам (21/31/33/34)', () => {
    expect(gen.generate(withPeriod(1)).xml).toContain('Период="21"');
    expect(gen.generate(withPeriod(2)).xml).toContain('Период="31"');
    expect(gen.generate(withPeriod(3)).xml).toContain('Период="33"');
    expect(gen.generate(withPeriod(4)).xml).toContain('Период="34"');
  });

  it.each([1, 2, 3, 4])(
    'проходит XSD-валидацию по NO_NDFL6.2_1_231_00_05_05_02.xsd для Q%d',
    (quarter) => {
      const result = gen.generate(withPeriod(quarter));
      const v = validateAgainstXsd(result.xml, REPORT_CONFIG[ReportType.NDFL6].xsdFile);
      if (!v.isValid) console.error(`NDFL6 Q${quarter} XSD errors:`, v.errors.slice(0, 10));
      expect(v.isValid).toBe(true);
    },
  );

  it('подписант — представитель по доверенности', () => {
    assertRepresentativeSigner(gen.generate(withPeriod(1)).xml);
  });
});

describe('РСВ (RsvGenerator)', () => {
  const gen = new RsvGenerator();

  it('reportType = RSV', () => {
    expect(gen.reportType).toBe(ReportType.RSV);
  });

  it('генерирует нулевой отчёт (КНД 1151111, ВерсФорм 5.08)', () => {
    const result = gen.generate(withPeriod(1));
    expect(result.isValid).toBe(true);
    assertFnsWellFormed(result.xml);
    expect(result.xml).toContain('КНД="1151111"');
    expect(result.xml).toContain('ВерсФорм="5.08"');
    expect(result.xml).toContain('ПоМесту="214"');
  });

  it('<РасчетСВ/> — пустой self-closing (нулевой отчёт)', () => {
    expect(gen.generate(withPeriod(1)).xml).toMatch(/<РасчетСВ\s*\/>/);
  });

  it('<СвПред> представителя несёт НаимОрг (особенность РСВ)', () => {
    // Якорим НаимОрг именно к <СвПред ...>, иначе regex матчит и НПЮЛ,
    // и тест проходит даже если СвПред лишилось НаимОрг.
    expect(gen.generate(withPeriod(1)).xml).toMatch(/<СвПред[^>]*НаимОрг="[^"]+"/);
  });

  it.each([1, 2, 3, 4])(
    'проходит XSD-валидацию по NO_RASCHSV_1_162_00_05_08_02.xsd для Q%d',
    (quarter) => {
      const result = gen.generate(withPeriod(quarter));
      const v = validateAgainstXsd(result.xml, REPORT_CONFIG[ReportType.RSV].xsdFile);
      if (!v.isValid) console.error(`RSV Q${quarter} XSD errors:`, v.errors.slice(0, 10));
      expect(v.isValid).toBe(true);
    },
  );

  it('подписант — представитель по доверенности', () => {
    assertRepresentativeSigner(gen.generate(withPeriod(1)).xml);
  });
});

describe('ПСВ (PsvGenerator)', () => {
  const gen = new PsvGenerator();

  it('reportType = PSV', () => {
    expect(gen.reportType).toBe(ReportType.PSV);
  });

  it('генерирует нулевой отчёт с ПерсСвФЛ', () => {
    const result = gen.generate(withPeriod(3));
    expect(result.isValid).toBe(true);
    assertFnsWellFormed(result.xml);
    expect(result.xml).toContain('КНД="1151162"');
    expect(result.xml).toContain('Период="03"');
  });

  it('содержит ПерсСвФЛ с СНИЛС', () => {
    const result = gen.generate(withPeriod(1));
    expect(result.xml).toContain('<ПерсСвФЛ');
    expect(result.xml).toContain('СНИЛС="123-456-789 00"');
    expect(result.xml).toContain('СумВыпл="0"');
  });

  it('эхом возвращает header.idFile в result.fileName', () => {
    const result = gen.generate({
      ...withPeriod(1),
      header: { ...withPeriod(1).header, idFile: 'NO_PERSSVFL_my-test-id' },
    });
    expect(result.fileName).toBe('NO_PERSSVFL_my-test-id');
  });

  it.each([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])(
    'проходит XSD-валидацию по NO_PERSSVFL_1_297_00_05_01_02.xsd для месяца %d',
    (month) => {
      const result = gen.generate(withPeriod(month));
      const v = validateAgainstXsd(result.xml, REPORT_CONFIG[ReportType.PSV].xsdFile);
      if (!v.isValid) console.error(`PSV month ${month} XSD errors:`, v.errors.slice(0, 10));
      expect(v.isValid).toBe(true);
    },
  );
});

describe('ДУСН (DusnGenerator)', () => {
  const gen = new DusnGenerator();

  it('reportType = DUSN', () => {
    expect(gen.reportType).toBe(ReportType.DUSN);
  });

  it('генерирует нулевую декларацию (КНД 1152017, ВерсФорм 5.09)', () => {
    const result = gen.generate(zeroBaseEdits);
    expect(result.isValid).toBe(true);
    assertFnsWellFormed(result.xml);
    expect(result.xml).toContain('КНД="1152017"');
    expect(result.xml).toContain('ВерсФорм="5.09"');
    expect(result.xml).toContain('Период="34"');
    expect(result.xml).toContain('ПоМесту="210"');
  });

  it('ОтчетГод берётся из header.reportYear как есть', () => {
    // ДУСН внутри не вычитает year-1; caller (builder/UI) передаёт «год за
    // который отчитываемся» напрямую. UI по умолчанию подставляет
    // `new Date().getFullYear() - 1` → декларация за 2025 подаётся с
    // header.reportYear=2025.
    expect(gen.generate(withYear(2025)).xml).toContain('ОтчетГод="2025"');
  });

  it('структура УСН → СумНалПУ_НП → РасчНал1 с ПризНП=1 и нулями', () => {
    const result = gen.generate(zeroBaseEdits);
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
    const result = gen.generate(zeroBaseEdits);
    const v = validateAgainstXsd(result.xml, REPORT_CONFIG[ReportType.DUSN].xsdFile);
    if (!v.isValid) console.error('DUSN XSD errors:', v.errors.slice(0, 10));
    expect(v.isValid).toBe(true);
  });

  it('подписант — представитель по доверенности', () => {
    assertRepresentativeSigner(gen.generate(zeroBaseEdits).xml);
  });
});

describe('ЕФС-1 (Fss4Generator, СФР)', () => {
  const gen = new Fss4Generator();

  it('reportType = FSS4', () => {
    expect(gen.reportType).toBe(ReportType.FSS4);
  });

  it('генерирует XML при переданном pfrRegNumber', () => {
    const result = gen.generate(withPeriod(1));
    expect(result.isValid).toBe(true);
    expect(result.xml).toContain('<?xml');
    expect(result.xml).toContain('utf-8');
    expect(result.xml).toContain('<ЭДСФР');
  });

  it('генерируется без sfrRegNumber — ЕФС-1 его не использует', () => {
    const result = gen.generate({
      ...withPeriod(1),
      signer: { ...zeroBaseEdits.signer, sfrRegNumber: null },
    });
    expect(result.isValid).toBe(true);
  });

  it('возвращает ошибку без pfrRegNumber', () => {
    const result = gen.generate({
      ...withPeriod(1),
      signer: { ...zeroBaseEdits.signer, pfrRegNumber: null },
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.join('|')).toContain('pfrRegNumber');
  });

  it('использует pfrRegNumber (не sfrRegNumber) в <ЕФС8:РегНомер> — сторонние бухгалтерские системы сверяют именно рег. номер ПФР', () => {
    const result = gen.generate(withPeriod(1));
    expect(result.xml).toContain('<ЕФС8:РегНомер>087-701-579643</ЕФС8:РегНомер>');
    expect(result.xml).not.toContain('<ЕФС8:РегНомер>7701234567</ЕФС8:РегНомер>');
  });

  it('эхом возвращает header.idFile в result.fileName', () => {
    const result = gen.generate({
      ...withPeriod(1),
      header: { ...withPeriod(1).header, idFile: 'СФР_7701234567_ЕФС-1_20260401_uuid' },
    });
    expect(result.fileName).toBe('СФР_7701234567_ЕФС-1_20260401_uuid');
  });

  it('содержит все 7 namespace объявлений', () => {
    const result = gen.generate(withPeriod(1));
    expect(result.xml).toContain('xmlns="http://пф.рф/ЕФС-1/2026-01-01"');
    expect(result.xml).toContain('xmlns:АФ8=');
    expect(result.xml).toContain('xmlns:УТ8=');
    expect(result.xml).toContain('xmlns:ВС8=');
    expect(result.xml).toContain('xmlns:ЕФС8=');
    expect(result.xml).toContain('xmlns:ns1=');
    expect(result.xml).toContain('xmlns:sig=');
  });

  it('содержит структуру ОСС/Численность/РССВ/РПО', () => {
    const result = gen.generate(withPeriod(1));
    expect(result.xml).toContain('<Страхователь>');
    expect(result.xml).toContain('<ОСС>');
    expect(result.xml).toContain('<Численность>');
    expect(result.xml).toContain('<РССВ>');
    expect(result.xml).toContain('<РПО>');
    expect(result.xml).toContain('<Руководитель>');
    expect(result.xml).toContain('<СлужебнаяИнформация>');
  });

  it('квартальные коды СФР (месяц окончания квартала): 03/06/09/12', () => {
    // XSD efs1.xsd ограничивает <Период><Код> enum'ом {03, 06, 09, 12} —
    // код = последний месяц квартала. Q4 = декабрь = "12" (а не "0").
    expect(gen.generate(withPeriod(1)).xml).toContain('<Код>03</Код>');
    expect(gen.generate(withPeriod(2)).xml).toContain('<Код>06</Код>');
    expect(gen.generate(withPeriod(3)).xml).toContain('<Код>09</Код>');
    expect(gen.generate(withPeriod(4)).xml).toContain('<Код>12</Код>');
  });

  it('является well-formed XML', () => {
    expect(() => parseXml(gen.generate(withPeriod(1)).xml)).not.toThrow();
  });

  it('содержит ДатаЗаполнения в формате YYYY-MM-DD (требование XSD)', () => {
    expect(gen.generate(withPeriod(1)).xml).toMatch(/<ДатаЗаполнения>\d{4}-\d{2}-\d{2}<\/ДатаЗаполнения>/);
  });

  it.each([1, 2, 3, 4])(
    'проходит XSD-валидацию по efs1/efs1.xsd для Q%d',
    (quarter) => {
      const result = gen.generate(withPeriod(quarter));
      const v = validateAgainstXsd(result.xml, REPORT_CONFIG[ReportType.FSS4].xsdFile);
      if (!v.isValid) console.error(`FSS4 Q${quarter} XSD errors:`, v.errors.slice(0, 10));
      expect(v.isValid).toBe(true);
    },
  );
});

describe('Уведомление о взносах (UvVznosyGenerator)', () => {
  const gen = new UvVznosyGenerator();

  it('reportType = UV_VZNOSY', () => {
    expect(gen.reportType).toBe(ReportType.UV_VZNOSY);
  });

  it('генерирует нулевое уведомление (КНД 1110355)', () => {
    const result = gen.generate(withPeriod(3));
    expect(result.isValid).toBe(true);
    assertFnsWellFormed(result.xml);
    expect(result.xml).toContain('КНД="1110355"');
  });

  it('содержит УвИсчСумНалог', () => {
    const result = gen.generate(withPeriod(5));
    expect(result.xml).toContain('<УвИсчСумНалог');
    expect(result.xml).toContain('ОКТМО="45000000"');
    expect(result.xml).toContain('СумНалогАванс="0"');
    expect(result.xml).toContain('Год="2026"');
  });

  it.each([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])(
    'проходит XSD-валидацию по UT_UVISCHSUMNAL_1_263_00_05_03_01.xsd для месяца %d',
    (month) => {
      const result = gen.generate(withPeriod(month));
      const v = validateAgainstXsd(result.xml, REPORT_CONFIG[ReportType.UV_VZNOSY].xsdFile);
      if (!v.isValid) console.error(`UV_VZNOSY month ${month} XSD errors:`, v.errors.slice(0, 10));
      expect(v.isValid).toBe(true);
    },
  );
});

describe('Уведомление по УСН (UusnGenerator)', () => {
  const gen = new UusnGenerator();

  it('reportType = UUSN', () => {
    expect(gen.reportType).toBe(ReportType.UUSN);
  });

  it('генерирует нулевое уведомление (КНД 1110355, ВерсФорм 5.03)', () => {
    const result = gen.generate(withPeriod(1));
    expect(result.isValid).toBe(true);
    assertFnsWellFormed(result.xml);
    expect(result.xml).toContain('КНД="1110355"');
    expect(result.xml).toContain('ВерсФорм="5.03"');
  });

  it('КБК УСН (18210501021011000110) и нулевой СумНалогАванс', () => {
    const result = gen.generate(withPeriod(1));
    expect(result.xml).toContain('КБК="18210501021011000110"');
    expect(result.xml).toContain('ОКТМО="45000000"');
    expect(result.xml).toContain('СумНалогАванс="0"');
    expect(result.xml).toContain('Год="2026"');
  });

  it('коды кварталов (21/31/33/34) + НомерМесКварт 01..04', () => {
    for (const [q, periodCode] of [[1, '21'], [2, '31'], [3, '33'], [4, '34']] as const) {
      const xml = gen.generate(withPeriod(q)).xml;
      expect(xml).toContain(`Период="${periodCode}"`);
      expect(xml).toContain(`НомерМесКварт="${String(q).padStart(2, '0')}"`);
    }
  });

  it('бросает ошибку при period вне 1..4', () => {
    const result = gen.generate(withPeriod(5));
    expect(result.isValid).toBe(false);
    expect(result.errors.join('|')).toContain('1 до 4');
  });

  it('эхом возвращает header.idFile в result.fileName', () => {
    const result = gen.generate({
      ...withPeriod(1),
      header: { ...withPeriod(1).header, idFile: 'UT_UVISCHSUMNAL_my-uusn-id' },
    });
    expect(result.fileName).toBe('UT_UVISCHSUMNAL_my-uusn-id');
  });

  it.each([1, 2, 3, 4])(
    'проходит XSD-валидацию для Q%d',
    (quarter) => {
      const result = gen.generate(withPeriod(quarter));
      const v = validateAgainstXsd(result.xml, REPORT_CONFIG[ReportType.UUSN].xsdFile);
      if (!v.isValid) console.error(`UUSN Q${quarter} XSD errors:`, v.errors.slice(0, 10));
      expect(v.isValid).toBe(true);
    },
  );
});

describe('Сверка с эталонами (ПК "Ромашка", санитизированные фикстуры)', () => {
  async function readReference(fileName: string): Promise<string> {
    return (await readFile(join(REFERENCES_DIR, fileName))).toString('utf-8');
  }

  it('BUHOTCH: тот же КНД/ВерсФорм/Период что в эталоне', async () => {
    const ref = await readReference('NO_BOUPR_romashka.xml');
    const ours = new BuhotchGenerator().generate(buhotchBaseEdits);
    for (const attr of ['КНД="0710096"', 'Период="91"', 'ВерсФорм="5.04"', 'ОКЕИ="384"']) {
      expect(ref).toContain(attr);
      expect(ours.xml).toContain(attr);
    }
  });

  it('NDFL6: тот же КНД/ВерсФорм/ПоМесту', async () => {
    const ref = await readReference('NO_NDFL6.2_romashka.xml');
    const ours = new Ndfl6Generator().generate(withPeriod(1));
    for (const attr of ['КНД="1151100"', 'ВерсФорм="5.05"', 'ПоМесту="214"', 'Ставка="13"']) {
      expect(ref).toContain(attr);
      expect(ours.xml).toContain(attr);
    }
  });

  it('RSV: тот же КНД/ВерсФорм и <РасчетСВ/>', async () => {
    const ref = await readReference('NO_RASCHSV_romashka.xml');
    const ours = new RsvGenerator().generate(withPeriod(1));
    for (const attr of ['КНД="1151111"', 'ВерсФорм="5.08"']) {
      expect(ref).toContain(attr);
      expect(ours.xml).toContain(attr);
    }
    expect(ref).toMatch(/<РасчетСВ\s*\/>/);
    expect(ours.xml).toMatch(/<РасчетСВ\s*\/>/);
  });

  it('DUSN: тот же КНД/ВерсФорм/ПоМесту и структура РасчНал1', async () => {
    const ref = await readReference('NO_USN_romashka.xml');
    const ours = new DusnGenerator().generate(zeroBaseEdits);
    for (const attr of ['КНД="1152017"', 'ВерсФорм="5.09"', 'ПоМесту="210"', 'ПризНП="1"']) {
      expect(ref).toContain(attr);
      expect(ours.xml).toContain(attr);
    }
  });

  it('EFS1: тот же корень ЭДСФР и набор namespace объявлений', async () => {
    const ref = await readReference('EFS1_romashka.xml');
    const ours = new Fss4Generator().generate(withPeriod(1));
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
    const ours = new Fss4Generator().generate(withPeriod(1));
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

  it('регистрирует все 8 генераторов (через getAvailableReports)', () => {
    expect(registry.getAvailableReports()).toHaveLength(8);
  });

  it('бросает исключение для незарегистрированного типа', () => {
    const empty = new ReportRegistryService();
    expect(() => empty.generate(ReportType.BUHOTCH, buhotchBaseEdits)).toThrow();
  });

  it('генерирует отчёт по типу через registry', () => {
    // Прогон через registry — контракт DI'шного layer'а в проде.
    const result = registry.generate(ReportType.BUHOTCH, buhotchBaseEdits);
    expect(result.isValid).toBe(true);
    expect(result.reportType).toBe(ReportType.BUHOTCH);
  });
});
