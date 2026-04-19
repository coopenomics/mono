import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { existsSync } from 'fs';
import { readFile, readdir } from 'fs/promises';
import { join, resolve } from 'path';
import iconv from 'iconv-lite';
import { parseXml, type Document } from 'libxmljs2';
import { ReportType, REPORT_CONFIG } from '../../domain/enums/report-type.enum';

export interface XsdValidationError {
  message: string;
  line?: number;
  column?: number;
}

export interface XsdValidationResult {
  isValid: boolean;
  errors: XsdValidationError[];
}

/**
 * Резолвим путь к schemas/ устойчиво: проверяем несколько кандидатов, чтобы
 * работало и под ts-node (из src/), и из скомпилированного dist/ в prod-контейнере.
 * Приоритет: env override > __dirname/../../schemas > cwd()/src/extensions/reports/schemas.
 */
function resolveSchemasDir(): string {
  const envOverride = process.env.REPORTS_SCHEMAS_DIR;
  if (envOverride && existsSync(envOverride)) return resolve(envOverride);

  const candidates = [
    join(__dirname, '..', '..', 'schemas'),                                    // src/ → ../../schemas
    join(__dirname, '..', '..', '..', 'src', 'extensions', 'reports', 'schemas'), // dist/ → src/
    join(process.cwd(), 'src', 'extensions', 'reports', 'schemas'),
    join(process.cwd(), 'components', 'controller', 'src', 'extensions', 'reports', 'schemas'),
  ];
  for (const c of candidates) if (existsSync(c)) return resolve(c);

  // Fallback: первый кандидат — дадим упасть с осмысленной ошибкой при readdir.
  return candidates[0];
}

const SCHEMAS_DIR = resolveSchemasDir();
const EFS1_SUBDIR = 'efs1';
const EFS1_MAIN_XSD = 'efs1.xsd';

// Для ЕФС-1: подменяем кириллические namespace'ы в XML на ASCII-safe перед
// валидацией. Зеркально тому, что сделано в schemas/efs1/efs1.xsd.
// Порядок важен: от более длинных к коротким, чтобы не было частичных замен.
const EFS1_XML_NS_MAP: [string, string][] = [
  ['http://пф.рф/ВС/ЕФС/2026-01-01', 'http://ns.efs.ru/VS/EFS/2026-01-01'],
  ['http://пф.рф/ЕФС-1/2026-01-01',  'http://ns.efs.ru/EFS-1/2026-01-01'],
  ['http://пф.рф/ВС/типы/2025-01-01','http://ns.efs.ru/VS/types/2025-01-01'],
  ['http://пф.рф/АФ/2025-01-01',     'http://ns.efs.ru/AF/2025-01-01'],
  ['http://пф.рф/УТ/2025-01-01',     'http://ns.efs.ru/UT/2025-01-01'],
];

/**
 * Валидатор XML по XSD-схемам ФНС/ФСС.
 *
 * XSD-файлы ФНС лежат в `extensions/reports/schemas/` и объявлены в cp1251.
 * XSD ЕФС-1 лежит в `schemas/efs1/` и объявлена в utf-8 (+ с подменой
 * кириллических namespace URI на ASCII — см. `schemas/efs1/README.md`).
 *
 * На старте модуль читает все `*.xsd`, определяет кодировку по XML-заголовку
 * и парсит в libxmljs2.Document, кэшируя по имени файла. Далее
 * `validate(xml, xsdFile)` и `validateByReportType(xml, reportType)`
 * возвращают `{ isValid, errors[] }`.
 */
// Регекс, покрывающий варианты XML-декларации кодировки cp1251:
// double/single quotes, case-insensitive, опциональные пробелы.
const CP1251_ENCODING_RE = /encoding\s*=\s*(['"])\s*(windows-1251|cp1251|cp-1251)\s*\1/i;
function rewriteEncodingToUtf8(xml: string): string {
  return xml.replace(CP1251_ENCODING_RE, 'encoding="utf-8"');
}

@Injectable()
export class XsdValidatorService implements OnModuleInit {
  private readonly logger = new Logger(XsdValidatorService.name);
  private readonly xsdCache = new Map<string, Document>();
  // Mutex для ЕФС-1: load+validate используют process.chdir (глобальное
  // состояние). Параллельные валидации могут перемешать cwd. Используем
  // простую очередь Promise'ов — одновременно только одна операция с chdir.
  private efs1ChdirLock: Promise<unknown> = Promise.resolve();

  async onModuleInit(): Promise<void> {
    // 1. ФНС-схемы в корне schemas/
    const files = await readdir(SCHEMAS_DIR);
    for (const file of files.filter((f) => f.toLowerCase().endsWith('.xsd'))) {
      try {
        const doc = await this.loadSchema(join(SCHEMAS_DIR, file));
        this.xsdCache.set(file, doc);
      } catch (e) {
        this.logger.error(`Ошибка загрузки XSD ${file}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    // 2. ЕФС-1 — имеет imports, требует chdir при парсинге
    const efs1Dir = join(SCHEMAS_DIR, EFS1_SUBDIR);
    try {
      const efs1Doc = await this.loadEfs1Schema(efs1Dir);
      this.xsdCache.set(`${EFS1_SUBDIR}/${EFS1_MAIN_XSD}`, efs1Doc);
    } catch (e) {
      this.logger.error(`Ошибка загрузки XSD ЕФС-1: ${e instanceof Error ? e.message : String(e)}`);
    }

    this.logger.log(`Загружено XSD-схем: ${this.xsdCache.size} (${[...this.xsdCache.keys()].join(', ')})`);
  }

  async validate(xml: string, xsdFileName: string): Promise<XsdValidationResult> {
    const xsdDoc = this.xsdCache.get(xsdFileName);
    if (!xsdDoc) {
      return {
        isValid: false,
        errors: [{ message: `XSD-схема не найдена: ${xsdFileName}. Доступны: ${[...this.xsdCache.keys()].join(', ')}` }],
      };
    }
    // Для ЕФС-1: подменяем namespace'ы в XML + chdir в efs1/ на время validate
    // (libxml2 резолвит schema imports относительно process.cwd()).
    if (xsdFileName === `${EFS1_SUBDIR}/${EFS1_MAIN_XSD}`) {
      return this.validateEfs1(xml, xsdDoc);
    }
    return this.validateAgainst(xml, xsdDoc);
  }

  async validateByReportType(xml: string, reportType: ReportType): Promise<XsdValidationResult> {
    const cfg = REPORT_CONFIG[reportType];
    if (!cfg || !cfg.xsdFile) {
      // Раньше возвращали isValid:true с error в массиве — downstream
      // (finalIsValid = generated.isValid && xsdResult.isValid) считал отчёт
      // валидным и сохранял с is_valid=true ПРИ наличии ошибки. Теперь
      // явно isValid:false, чтобы нельзя было «случайно» пропустить форму.
      return {
        isValid: false,
        errors: [{ message: `XSD для отчёта ${reportType} не определена — валидация невозможна` }],
      };
    }
    return this.validate(xml, cfg.xsdFile);
  }

  getLoadedSchemas(): string[] {
    return [...this.xsdCache.keys()].sort();
  }

  private async loadSchema(absPath: string): Promise<Document> {
    const buf = await readFile(absPath);
    // Определяем кодировку по XML-заголовку. Регекс устойчив к вариациям:
    // double/single quotes, case-insensitive, пробелы.
    const headUtf8 = buf.slice(0, 200).toString('utf-8');
    const isCp1251 = CP1251_ENCODING_RE.test(headUtf8);
    const decoded = isCp1251 ? iconv.decode(buf, 'win1251') : buf.toString('utf-8');
    return parseXml(rewriteEncodingToUtf8(decoded));
  }

  private async loadEfs1Schema(efs1Dir: string): Promise<Document> {
    // chdir — глобальное состояние процесса. Сериализуем через mutex.
    return this.withEfs1Chdir(efs1Dir, async () => {
      const buf = await readFile(EFS1_MAIN_XSD);
      return parseXml(buf.toString('utf-8'));
    });
  }

  private async validateEfs1(xml: string, xsdDoc: Document): Promise<XsdValidationResult> {
    let patched = xml;
    for (const [cyr, ascii] of EFS1_XML_NS_MAP) {
      patched = patched.split(cyr).join(ascii);
    }
    return this.withEfs1Chdir(join(SCHEMAS_DIR, EFS1_SUBDIR), () =>
      this.validateAgainst(patched, xsdDoc),
    );
  }

  /**
   * Сериализованный доступ к chdir для ЕФС-1. Пока одна операция в процессе,
   * следующие ждут. Это критично: libxml2 резолвит xs:import через cwd,
   * а chdir — глобальная мутация.
   */
  private async withEfs1Chdir<T>(targetDir: string, fn: () => Promise<T> | T): Promise<T> {
    const prev = this.efs1ChdirLock;
    let release!: () => void;
    this.efs1ChdirLock = new Promise<void>((res) => {
      release = res;
    });
    await prev;
    const origCwd = process.cwd();
    try {
      process.chdir(targetDir);
      return await fn();
    } finally {
      process.chdir(origCwd);
      release();
    }
  }

  private validateAgainst(xml: string, xsdDoc: Document): XsdValidationResult {
    let xmlDoc: Document | null = null;
    try {
      xmlDoc = parseXml(rewriteEncodingToUtf8(xml));
    } catch (e) {
      return {
        isValid: false,
        errors: [{ message: `Ошибка парсинга XML: ${e instanceof Error ? e.message : String(e)}` }],
      };
    }

    try {
      const isValid = xmlDoc.validate(xsdDoc);
      if (isValid) {
        return { isValid: true, errors: [] };
      }

      const rawErrors = xmlDoc.validationErrors ?? [];
      const errors: XsdValidationError[] = rawErrors.map((err) => ({
        message: (err as { message?: string }).message ?? String(err),
        line: (err as { line?: number }).line,
        column: (err as { column?: number }).column,
      }));
      return { isValid: false, errors };
    } finally {
      // libxmljs2 хранит native-память libxml2; без explicit release
      // каждая валидация протекает. На длительном проде копится OOM.
      const maybeFree = (xmlDoc as unknown as { free?: () => void }).free;
      if (typeof maybeFree === 'function') {
        try {
          maybeFree.call(xmlDoc);
        } catch {
          /* лучше утечка, чем падение процесса */
        }
      }
    }
  }
}
