export const DOC_WIZARD_STEP_GENERATOR = 'doc_generator';
export const DOC_WIZARD_STEP_BLAGOROST = 'doc_blagorost';

export const DOC_WIZARD_REGISTRY: Record<string, number> = {
  [DOC_WIZARD_STEP_GENERATOR]: 994,
  [DOC_WIZARD_STEP_BLAGOROST]: 998,
};

export const DOC_WIZARD_STEP_ORDER = [DOC_WIZARD_STEP_GENERATOR, DOC_WIZARD_STEP_BLAGOROST] as const;

export type DocWizardStepKey = (typeof DOC_WIZARD_STEP_ORDER)[number];

export function isDocWizardStep(key: string): key is DocWizardStepKey {
  return (DOC_WIZARD_STEP_ORDER as readonly string[]).includes(key);
}

/** Группа 1: положение ГЕНЕРАТОР, шаблон договора, положение БЛАГОРОСТ — объявляются параллельно. */
export const COUNCIL_GROUP_FOUNDATION = 'council_foundation';
/** Группа 2: оферты ГЕНЕРАТОР и БЛАГОРОСТ — объявляются параллельно, каждая после своего положения. */
export const COUNCIL_GROUP_OFFERS = 'council_offers';

/** @deprecated Миграция черновиков stepper → COUNCIL_GROUP_OFFERS */
export const COUNCIL_GROUP_GENERATOR_OFFER = 'council_generator_offer';
/** @deprecated Миграция черновиков stepper → COUNCIL_GROUP_OFFERS */
export const COUNCIL_GROUP_BLAGOROST_OFFER = 'council_blagorost_offer';

export const COUNCIL_STEP_GROUP_ORDER = [
  COUNCIL_GROUP_FOUNDATION,
  COUNCIL_GROUP_OFFERS,
] as const;

export type CouncilGroupStepKey = (typeof COUNCIL_STEP_GROUP_ORDER)[number];

export const COUNCIL_STEP_IDS_BY_GROUP: Record<CouncilGroupStepKey, readonly string[]> = {
  [COUNCIL_GROUP_FOUNDATION]: [
    'generator_program_template',
    'generation_contract_template',
    'blagorost_program',
  ],
  [COUNCIL_GROUP_OFFERS]: ['generator_offer_template', 'blagorost_offer_template'],
};

export const COUNCIL_WIZARD_STEP_META: Record<CouncilGroupStepKey, { label: string; description: string }> = {
  [COUNCIL_GROUP_FOUNDATION]: {
    label: 'Утверждение положений и шаблонов ЦПП',
    description:
      'Положение «ГЕНЕРАТОР», шаблон договора участия в хозяйственной деятельности и положение «БЛАГОРОСТ»',
  },
  [COUNCIL_GROUP_OFFERS]: {
    label: 'Утверждение оферт ЦПП',
    description: 'Оферты «ГЕНЕРАТОР» и «БЛАГОРОСТ» для пайщиков',
  },
};

export function isCouncilGroupStep(key: string): key is CouncilGroupStepKey {
  return (COUNCIL_STEP_GROUP_ORDER as readonly string[]).includes(key);
}

export function resolveCouncilGroupForStepId(stepId: string): CouncilGroupStepKey | null {
  for (const groupKey of COUNCIL_STEP_GROUP_ORDER) {
    if (COUNCIL_STEP_IDS_BY_GROUP[groupKey].includes(stepId)) {
      return groupKey;
    }
  }
  return null;
}

export function normalizeWizardStepKey(key: string): string {
  if (isDocWizardStep(key)) {
    return key;
  }
  if (key === COUNCIL_GROUP_GENERATOR_OFFER || key === COUNCIL_GROUP_BLAGOROST_OFFER) {
    return COUNCIL_GROUP_OFFERS;
  }
  if (isCouncilGroupStep(key)) {
    return key;
  }
  return resolveCouncilGroupForStepId(key) ?? key;
}

export function getCouncilStepIdsForGroup(groupKey: CouncilGroupStepKey): readonly string[] {
  return COUNCIL_STEP_IDS_BY_GROUP[groupKey];
}
