export type EditableFieldKey =
  | 'generator_program_purpose'
  | 'eoap_definition'
  | 'generator_task_goal'
  | 'idea_unit_cost'
  | 'idea_unit_cost_words'
  | 'blagorost_goal_expansion'
  | 'blagorost_goal_reason'
  | 'blagorost_task_expansion'
  | 'blagorost_task_development'
  | 'return_source_description'
  | 'return_additional_source';

export const PREVIEW_PLACEHOLDER = '______';

export const FIELD_LABELS: Record<EditableFieldKey, string> = {
  generator_program_purpose:
    'Направление ЦПП: какую экосистему или сферу деятельности развивают пайщики (название, правовая основа, цель интеграции в экономику)',
  eoap_definition:
    'Определение Платформы: что это, из чего состоит, кто участники, на какой технологии и принципах работает',
  generator_task_goal:
    'Главная задача ЦПП: чем Платформа должна стать для участников (центр привлечения чего и для чего)',
  idea_unit_cost: 'Стоимость одной Идеи в рублях — только число',
  idea_unit_cost_words: 'Та же стоимость Идеи прописью',
  blagorost_goal_expansion:
    'Зачем расширять участие в Платформе: какая потребность участников закрывается при росте сообщества',
  blagorost_goal_reason:
    'Причина роста числа участников: за счёт чего расширяется сообщество и на что это влияет',
  blagorost_task_expansion:
    'Задача расширения: как описывается рост числа участников Платформы и их взаимодействия',
  blagorost_task_development:
    'Задача развития: как описывается привлечение инноваций, разработок и решений в Платформу',
  return_source_description:
    'Основной источник возврата взносов: что создаёт экономический эффект (инфраструктура, продукт, механизм)',
  return_additional_source:
    'Дополнительные источники возврата: взносы пользователей, продукты и приложения, передаваемые или создаваемые в Обществе',
};

export const GENERATOR_DOC_FIELDS: EditableFieldKey[] = [
  'generator_program_purpose',
  'eoap_definition',
  'generator_task_goal',
  'idea_unit_cost',
  'idea_unit_cost_words',
];

export const BLAGOROST_DOC_FIELDS: EditableFieldKey[] = [
  'blagorost_goal_expansion',
  'blagorost_goal_reason',
  'blagorost_task_expansion',
  'blagorost_task_development',
  'return_source_description',
  'return_additional_source',
  'eoap_definition',
];

export const ALL_DOC_FIELDS: EditableFieldKey[] = [
  ...GENERATOR_DOC_FIELDS,
  ...BLAGOROST_DOC_FIELDS.filter((key) => !GENERATOR_DOC_FIELDS.includes(key)),
];

export const DOCUMENT_SECTIONS = [
  {
    registryId: 994,
    tabLabel: 'Положение ГЕНЕРАТОР',
  },
  {
    registryId: 998,
    tabLabel: 'Положение БЛАГОРОСТ',
  },
] as const;
