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

/**
 * Валидатор XML по XSD-схемам ФНС/ФСС.
 *
 * XSD-файлы лежат в `extensions/reports/schemas/` и объявлены в cp1251.
 * На старте модуль читает все `*.xsd`, перекодирует из cp1251 → utf8 и
 * парсит в libxmljs2.Document, кэшируя по имени файла. Далее
 * `validate(xml, xsdFile)` и `validateByReportType(xml, reportType)`
 * возвращают `{ isValid, errors[] }` с человекочитаемыми ошибками.
 *
 * XML на входе должен быть уже декодирован в JS-строку (utf-16 internal) —
 * `<?xml encoding="windows-1251"?>`-заголовок переписываем в `utf-8` перед
 * парсингом, чтобы libxmljs2 не пытался ещё раз интерпретировать байты.
 */
@Injectable()
export class XsdValidatorService implements OnModuleInit {
  private readonly logger = new Logger(XsdValidatorService.name);
  private readonly xsdCache = new Map<string, Document>();

  async onModuleInit(): Promise<void> {
    const files = await readdir(SCHEMAS_DIR);
    const xsdFiles = files.filter((f) => f.toLowerCase().endsWith('.xsd'));
    for (const file of xsdFiles) {
      try {
        const doc = await this.loadSchema(file);
        this.xsdCache.set(file, doc);
      } catch (e) {
        this.logger.error(`Ошибка загрузки XSD ${file}: ${e instanceof Error ? e.message : String(e)}`);
      }
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

  private async loadSchema(file: string): Promise<Document> {
    const buf = await readFile(join(SCHEMAS_DIR, file));
    const decoded = iconv.decode(buf, 'win1251');
    const utf8Source = decoded.replace(/encoding="windows-1251"/i, 'encoding="utf-8"');
    return parseXml(utf8Source);
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
