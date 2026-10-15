import { BLAGOROST_PROGRAM_REGISTRY_ID, GENERATOR_PROGRAM_REGISTRY_ID } from './capitalOnboardingWizard';
import { t } from '../../../i18n';
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
    t('capital.capitalProgramDocFields.directionHint'),
  eoap_definition:
    t('capital.capitalProgramDocFields.platformDefinitionHint'),
  generator_task_goal:
    t('capital.capitalProgramDocFields.mainGoalHint'),
  idea_unit_cost: t('capital.capitalProgramDocFields.ideaCostNumberHint'),
  idea_unit_cost_words: t('capital.capitalProgramDocFields.ideaCostWordsHint'),
  blagorost_goal_expansion:
    t('capital.capitalProgramDocFields.expandReasonHint'),
  blagorost_goal_reason:
    t('capital.capitalProgramDocFields.growthCauseHint'),
  blagorost_task_expansion:
    t('capital.capitalProgramDocFields.expansionTaskHint'),
  blagorost_task_development:
    t('capital.capitalProgramDocFields.developmentTaskHint'),
  return_source_description:
    t('capital.capitalProgramDocFields.mainReturnSourceHint'),
  return_additional_source:
    t('capital.capitalProgramDocFields.extraReturnSourcesHint'),
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
    registryId: GENERATOR_PROGRAM_REGISTRY_ID,
    tabLabel: t('capital.capitalProgramDocFields.generatorRegulationLabel'),
  },
  {
    registryId: BLAGOROST_PROGRAM_REGISTRY_ID,
    tabLabel: t('capital.capitalProgramDocFields.blagorostRegulationLabel'),
  },
] as const;
