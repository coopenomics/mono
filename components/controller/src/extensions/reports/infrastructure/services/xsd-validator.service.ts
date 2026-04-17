import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { readFile, readdir } from 'fs/promises';
import { join } from 'path';
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

const SCHEMAS_DIR = join(__dirname, '..', '..', 'schemas');
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
@Injectable()
export class XsdValidatorService implements OnModuleInit {
  private readonly logger = new Logger(XsdValidatorService.name);
  private readonly xsdCache = new Map<string, Document>();

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

  validate(xml: string, xsdFileName: string): XsdValidationResult {
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

  validateByReportType(xml: string, reportType: ReportType): XsdValidationResult {
    const cfg = REPORT_CONFIG[reportType];
    if (!cfg || !cfg.xsdFile) {
      return {
        isValid: true,
        errors: [{ message: `XSD для отчёта ${reportType} не определена — валидация пропущена` }],
      };
    }
    return this.validate(xml, cfg.xsdFile);
  }

  getLoadedSchemas(): string[] {
    return [...this.xsdCache.keys()].sort();
  }

  private async loadSchema(absPath: string): Promise<Document> {
    const buf = await readFile(absPath);
    // Определяем кодировку по XML-заголовку: ФНС-схемы cp1251, ЕФС-1 — utf-8
    const headUtf8 = buf.slice(0, 100).toString('utf-8');
    const isCp1251 = /encoding="windows-1251"/i.test(headUtf8);
    const decoded = isCp1251 ? iconv.decode(buf, 'win1251') : buf.toString('utf-8');
    const utf8Source = decoded.replace(/encoding="windows-1251"/i, 'encoding="utf-8"');
    return parseXml(utf8Source);
  }

  private async loadEfs1Schema(efs1Dir: string): Promise<Document> {
    const origCwd = process.cwd();
    try {
      process.chdir(efs1Dir);
      const buf = await readFile(EFS1_MAIN_XSD);
      return parseXml(buf.toString('utf-8'));
    } finally {
      process.chdir(origCwd);
    }
  }

  private validateEfs1(xml: string, xsdDoc: Document): XsdValidationResult {
    let patched = xml;
    for (const [cyr, ascii] of EFS1_XML_NS_MAP) {
      patched = patched.split(cyr).join(ascii);
    }
    const origCwd = process.cwd();
    try {
      process.chdir(join(SCHEMAS_DIR, EFS1_SUBDIR));
      return this.validateAgainst(patched, xsdDoc);
    } finally {
      process.chdir(origCwd);
    }
  }

  private validateAgainst(xml: string, xsdDoc: Document): XsdValidationResult {
    let xmlDoc: Document;
    try {
      const utf8Xml = xml.replace(/encoding="windows-1251"/i, 'encoding="utf-8"');
      xmlDoc = parseXml(utf8Xml);
    } catch (e) {
      return {
        isValid: false,
        errors: [{ message: `Ошибка парсинга XML: ${e instanceof Error ? e.message : String(e)}` }],
      };
    }

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
  }
}
