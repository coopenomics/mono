import { z } from 'zod';
import { type DeserializedDescriptionOfExtension } from '@coopenomics/extension-kit';
import { t } from './i18n';

// Определение интерфейса для хранения данных об обрабатываемых собраниях
export interface TrackedMeet {
  id: number; // № собрания
  hash: string;
  coopname: string;
  open_at: string;
  close_at: string;
  status: string;
  extendedStatus?: string;
  notifications: {
    initialNotification: boolean; // Уведомление при статусе WAITING_FOR_OPENING (первый раз)
    threeDaysBeforeStart: boolean; // Уведомление за 3 дня до начала
    startNotification: boolean; // Уведомление о начале собрания (VOTING_IN_PROGRESS)
    oneDayBeforeEnd: boolean; // Уведомление за 1 день до конца
    restartNotification: boolean; // Уведомление о новой дате для повторного собрания
    endNotification: boolean; // Уведомление о завершении собрания
  };
}

// Тип для логов действий расширения
export interface ILog {
  type: 'notification';
  meetHash: string;
  notificationType: string;
  recipients: number;
  timestamp: string;
}

// Константы для типов уведомлений
export const NotificationTypes = {
  INITIAL: 'initialNotification', // При появлении в статусе WAITING_FOR_OPENING
  THREE_DAYS_BEFORE_START: 'threeDaysBeforeStartNotification',
  START: 'startNotification', // При переходе в VOTING_IN_PROGRESS
  ONE_DAY_BEFORE_END: 'oneDayBeforeEndNotification',
  RESTART: 'restartNotification', // При рестарте собрания
  END: 'endNotification', // При завершении собрания
};

// Дефолтные параметры конфигурации
export const defaultConfig = {
  checkIntervalMinutes: 1,
  lastCheckTimestamp: '',
  trackedMeets: [] as TrackedMeet[],
  minutesBeforeStartNotification: 4320, // 3 дня в минутах (по умолчанию)
  minutesBeforeEndNotification: 1440, // 1 день в минутах (по умолчанию)
  closedMeetIds: [] as number[], // Добавлено для хранения id закрытых собраний
};

// Функция для проверки и сериализации FieldDescription
export function describeField(description: DeserializedDescriptionOfExtension): string {
  return JSON.stringify(description);
}

// Определение Zod-схемы
export const Schema = z.object({
  checkIntervalMinutes: z
    .number()
    .default(defaultConfig.checkIntervalMinutes)
    .describe(
      describeField({
        label: t('participant.settings.meetCheckIntervalLabel'),
        note: t('participant.settings.meetCheckIntervalNote'),
        rules: ['val >= 1'],
      })
    ),
  lastCheckTimestamp: z
    .string()
    .default(defaultConfig.lastCheckTimestamp)
    // i18n-ignore: поле конфигурации visible:false — не отображается пайщику/админу
    .describe(describeField({ label: 'Временная метка последней проверки', visible: false })),
  trackedMeets: z
    .array(
      z.object({
        id: z.number(),
        hash: z.string(),
        coopname: z.string(),
        open_at: z.string(),
        close_at: z.string(),
        status: z.string(),
        extendedStatus: z.string().optional(),
        notifications: z.object({
          initialNotification: z.boolean(),
          threeDaysBeforeStart: z.boolean(),
          startNotification: z.boolean(),
          oneDayBeforeEnd: z.boolean(),
          restartNotification: z.boolean(),
          endNotification: z.boolean(),
        }),
      })
    )
    .default(defaultConfig.trackedMeets)
    // i18n-ignore: поле конфигурации visible:false — не отображается пайщику/админу
    .describe(describeField({ label: 'Отслеживаемые собрания', visible: false })),
  minutesBeforeStartNotification: z
    .number()
    .default(defaultConfig.minutesBeforeStartNotification)
    .describe(
      describeField({
        label: t('participant.settings.beforeStartMinutesLabel'),
        note: t('participant.settings.beforeStartMinutesNote'),
        rules: ['val >= 1'],
      })
    ),
  minutesBeforeEndNotification: z
    .number()
    .default(defaultConfig.minutesBeforeEndNotification)
    .describe(
      describeField({
        label: t('participant.settings.beforeEndMinutesLabel'),
        note: t('participant.settings.beforeEndMinutesNote'),
        rules: ['val >= 1'],
      })
    ),
  closedMeetIds: z
    .array(z.number())
    .default(defaultConfig.closedMeetIds)
    // i18n-ignore: поле конфигурации visible:false — не отображается пайщику/админу
    .describe(describeField({ label: 'ID закрытых собраний', visible: false })),
});

// Автоматическое создание типа IConfig на основе Zod-схемы
export type IConfig = z.infer<typeof Schema>;
