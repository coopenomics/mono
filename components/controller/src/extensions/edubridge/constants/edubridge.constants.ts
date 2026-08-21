/** Имя расширения в реестре платформы — совпадает с ключом AppRegistry и workspace'ами стола. */
export const EDUBRIDGE_EXTENSION_NAME = 'edubridge';

/** Столы расширения. Имена обязаны посимвольно совпадать с desktop `extensions/edubridge/install.ts`. */
export const EDUBRIDGE_WORKSPACES = {
  /** Владелец и администратор: курсы, реестры, очередь, площадки. */
  ADMIN: 'edubridge',
  /** Пайщик-родитель/слушатель: обучающиеся, подписки, доступ. */
  MEMBER: 'edubridge-member',
  /** Преподаватель: назначения, взносы РИД, расчёт. */
  TEACHER: 'edubridge-teacher',
} as const;
