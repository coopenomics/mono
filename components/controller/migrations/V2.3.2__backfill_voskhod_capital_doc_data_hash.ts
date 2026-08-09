import { createHash } from 'node:crypto';
import type { DataSource } from 'typeorm';
import mongoose from 'mongoose';
import config from '~/config/config';

type MigrationLogger = {
  info: (message: string) => void;
  error: (message: string) => void;
  warn: (message: string) => void;
};

const CAPITAL_DOC_REGISTRY_ID = 994;
const TARGET_COOPNAME = 'voskhod';
const COLLECTION_NAME = 'doc_private_data';

const capitalProgramPrivateData = {
  generator_program_purpose:
    "развитию информационной экосистемы взаимодействия физических и юридических лиц, на основе международных кооперативных принципов и законодательства Российской Федерации в отношении потребительских обществ (кооперативов) – под названием “Кооперативная Экономика”, с целью самоорганизации и интеграции в социально-экономическую среду Российской Федерации., на основе международных кооперативных принципов и законодательства Российской Федерации",
  eoap_definition:
    "информационная экосистема, интегрируемая в социально-экономическую среду Российской Федерации, состоящая из комплекса программных продуктов  на базе технологии распределенного реестра, обеспечивающих широкое экономическое и социальное взаимодействие физических и юридических лиц, включая нерезидентов различных юрисдикций и организационно-правовых форм, на основе международных кооперативных принципов и законодательства Российской Федерации в отношении потребительских кооперативов (обществ) под названием “Кооперативная Экономика”",
  generator_task_goal:
    "центра привлечения и интеграции передовых инновационных цифровых разработок, а также экономических и социальных методов и решений",
  idea_unit_cost:
    "50",
  idea_unit_cost_words:
    "пятьдесят",
  blagorost_goal_expansion:
    "развитии информационной экосистемы взаимодействия физических и юридических лиц, на основе международных кооперативных принципов и законодательства Российской Федерации в отношении потребительских обществ (кооперативов) – под названием “Кооперативная Экономика”, с целью самоорганизации и интеграции в социально-экономическую среду Российской Федерации",
  blagorost_goal_reason:
    "вследствие увеличения количества Участников информационной кооперативной экосистемы - ЕОАП - для расширения и повышения социальной эффективности их экономического взаимодействия в некоммерческом формате",
  blagorost_task_expansion:
    "расширение участников ЕОАП - информационной кооперативной экосистемы  как центра экономического взаимодействия в некоммерческом формате",
  blagorost_task_development:
    "развитие ЕОАП  как центра привлечения и интеграции инновационных цифровых разработок, а также экономических и социальных методов и решений",
  return_source_description:
    "аппаратно-программная сеть узлов распределенного реестра в формате «СМЭВ+SWIFT», построенная на принципах самоорганизации и самофинансирования деятельности технологической инфраструктуры ЕОАП, обеспечивающей консенсус ее распределенных узлов по формированию базового продукта ЕОАП  - полного цикла документооборота по синхронному взаимодействию пайщиков и кооперативов - участников экосистемы ЕАОП -  через использование цифровых контрактов, с одновременным выполнением функций нотариата и учета финансовых и юридических событий (подробнее на  Сайте)",
  return_additional_source:
    "взносы пользователей  ЕОАП, его отдельных программных продуктов и приложений, переданных Обществу или создаваемых в рамках Общества, которые интегрируются в ЕОАП"
};

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`;

  const entries = Object.keys(value as Record<string, unknown>)
    .sort()
    .map((key) => {
      const v = (value as Record<string, unknown>)[key];
      return `${JSON.stringify(key)}:${stableStringify(v)}`;
    });

  return `{${entries.join(',')}}`;
}

function calculateSha256(value: unknown): string {
  return createHash('sha256').update(Buffer.from(stableStringify(value), 'utf8')).digest('hex').toUpperCase();
}

export default {
  name: 'Backfill capital_program_doc_data_hash for voskhod',
  validUntil: new Date('2027-05-01T00:00:00Z'),

  async up({ dataSource, logger }: { dataSource: DataSource; logger: MigrationLogger }): Promise<boolean> {
    if (config.coopname !== TARGET_COOPNAME) {
      logger.info(`COOPNAME=${config.coopname}: миграция предназначена только для ${TARGET_COOPNAME}, пропускаю.`);
      return true;
    }

    const hash = calculateSha256(capitalProgramPrivateData);
    let mongo: mongoose.Connection | null = null;

    try {
      mongo = await mongoose.createConnection(config.mongoose.url).asPromise();
      const db = mongo.db;
      if (!db) {
        throw new Error('Подключение к MongoDB установлено, но db не инициализирована');
      }
      const collection = db.collection(COLLECTION_NAME);
      await collection.createIndex({ hash: 1 }, { unique: true });
      await collection.updateOne(
        { hash },
        {
          $setOnInsert: {
            hash,
            registry_id: CAPITAL_DOC_REGISTRY_ID,
            payload: capitalProgramPrivateData,
            _created_at: new Date(),
          },
        },
        { upsert: true }
      );

      const result = await dataSource.query(
        `UPDATE extensions
            SET config = jsonb_set(COALESCE(config, '{}'::jsonb), '{capital_program_doc_data_hash}', to_jsonb($1::text), true),
                updated_at = NOW()
          WHERE name = 'capital'`,
        [hash]
      );

      logger.info(`capital_program_doc_data_hash=${hash} сохранён для ${TARGET_COOPNAME}; extensions updated=${result?.[1] ?? 'unknown'}.`);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Ошибка миграции capital_program_doc_data_hash для ${TARGET_COOPNAME}: ${message}`);
      return false;
    } finally {
      await mongo?.close();
    }
  },

  async down({ dataSource, logger }: { dataSource: DataSource; logger: MigrationLogger }): Promise<boolean> {
    if (config.coopname !== TARGET_COOPNAME) {
      return true;
    }

    await dataSource.query(
      `UPDATE extensions
          SET config = COALESCE(config, '{}'::jsonb) - 'capital_program_doc_data_hash',
              updated_at = NOW()
        WHERE name = 'capital'`
    );
    logger.warn('capital_program_doc_data_hash удалён из config capital; запись doc_private_data оставлена как идемпотентный audit trail.');
    return true;
  },
};
