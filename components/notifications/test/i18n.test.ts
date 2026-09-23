import { describe, expect, it } from 'vitest';
import { Workflows, nt, notificationTemplates, templateFor } from '../src';

/**
 * Идентификаторы сценариев закреплены строками. Раньше каждый вычислялся из
 * русского названия (`slugify(name)`), и правка или перевод названия молча
 * меняли идентификатор — а на него ссылаются подписки, настройки каналов и
 * записи входящих. Список ниже меняется только осознанно: новый сценарий —
 * новая строка; переименовать существующий идентификатор нельзя.
 */
const FROZEN_IDS = [
  'akt-priyomki-ekspeditorom-ozhidaet-podpisi-postavschika',
  'dobro-pozhalovat',
  'garantiynaya-pretenziya-postavschiku',
  'garantiyniy-vozvrat-zavershyon',
  'golosovanie-sobraniya-uchastka-nachalos',
  'kassir-otkazal-v-vyplate-postavschiku',
  'kod-podtverzhdeniya-vkhoda',
  'materialnaya-pomosch-vyplachena',
  'napominanie-o-predstoyaschem-sobranii',
  'napominanie-o-sobranii-uchastka',
  'napominanie-o-zavershenii-sobraniya',
  'napominanie-ob-otchyote-po-avansu',
  'naznachena-novaya-data-povtornogo-sobraniya',
  'novaya-novaya-zayavka-na-paevoy-vznos',
  'novaya-zadacha-kassiru-vyplata-postavschiku',
  'novaya-zayavka-doverennogo-litsa-uchastka',
  'novaya-zayavka-na-vstupitelniy-vznos',
  'novaya-zayavka-postavschika-na-dopusk',
  'noviy-vopros-na-povestke-soveta',
  'noviy-zakaz-postavschiku',
  'novoe-predlozhenie-na-moderatsii',
  'novoe-zayavlenie-na-garantiyniy-vozvrat',
  'otvet-na-zapros-odobreniya',
  'platezh-otmenen',
  'platezh-prinyat',
  'platyozh-vypolnen',
  'podtverzhdenie-vykhoda-iz-kooperativa',
  'postavschik-otmenil-priyomku-na-pvz',
  'predlozhenie-otkloneno-moderatsiey',
  'predlozhenie-proshlo-moderatsiyu',
  'priglashenie-v-kooperativ',
  'proekt-spisaniya-skoroporta-na-povestke-soveta',
  'redaktsii-dokumentov-zhdut-utverzhdeniya-soveta',
  'reshenie-po-zayavleniyu-na-garantiyniy-vozvrat',
  'reshenie-soveta-ne-prinyato-po-istecheniyu-sroka',
  'reshenie-soveta-po-materialnoy-pomoschi',
  'reshenie-soveta-prinyato',
  'sformirovan-chernovik-proekta-spisaniya-skoroporta',
  'sobranie-nachalos',
  'sobranie-zaversheno',
  'sobytie-bezopasnosti-akkaunta',
  'sovet-avtorizoval-proekt-spisaniya-skoroporta',
  'sovet-otklonil-proekt-spisaniya-skoroporta',
  'sovet-reshil-po-garantiynomu-vozvratu',
  'sovet-reshil-po-vydache-imuschestva',
  'spisanie-skoroporta-ispolneno',
  'tsifrovoy-kooperativ-razvernut',
  'utverzhdenie-redaktsii-dokumenta-ne-prinyato-sovetom',
  'uvedomlenie-o-novom-obschem-sobranii',
  'uvedomlenie-o-novom-sobytii-kalendarya-kooperativa',
  'uvedomlenie-ob-izmenenii-sobytiya-kalendarya-kooperativa',
  'verifikatsiya-email',
  'vkhods-novogo-ustroystva',
  'vkhodyaschiy-perevod',
  'vosstanovlenie-dostupa',
  'vyplata-postavschiku-podtverzhdena-kassirom',
  'vyshla-novaya-redaktsiya-dokumenta-kooperativa',
  'zakaz-gotov-k-polucheniyu',
  'zakaz-otklonyon-postavschikom',
  'zapros-na-odobrenie-predsedatelya',
  'zaverenie-kooperativa-v-tsepochke-doveriya-istekaet',
  'zayavka-doverennogo-litsa-rassmotrena',
  'zayavka-postavschika-na-dopusk-odobrena',
];

describe('сценарии уведомлений и их тексты', () => {
  it('идентификаторы не изменились', () => {
    expect(Object.keys(Workflows.workflowsById).sort()).toEqual(FROZEN_IDS);
  });

  it('у каждого сценария есть ключ словаря и его тексты', () => {
    for (const workflow of Object.values(Workflows.workflowsById)) {
      expect(workflow.i18nKey, workflow.workflowId).toBeTruthy();
      const texts = notificationTemplates.ru[workflow.i18nKey as string];
      expect(texts, workflow.workflowId).toBeTruthy();
      expect(texts.name).toBe(workflow.name);
    }
  });

  it('текст шага совпадает со словарём языка по умолчанию', () => {
    const paid = Workflows.workflowsById['platezh-prinyat'];
    const inApp = paid.steps.find((s) => s.type === 'in_app');
    expect(inApp?.controlValues.subject).toBe(nt('paymentPaid.inApp.subject'));
    expect(templateFor('paymentPaid', 'in_app', 'ru')?.body).toBe(inApp?.controlValues.body);
  });

  it('нет перевода — нет шаблона, вызывающий берёт текст шага', () => {
    expect(templateFor('paymentPaid', 'in_app', 'xx')).toBeUndefined();
    expect(templateFor('paymentPaid', 'chat', 'ru')).toBeUndefined();
    expect(() => nt('paymentPaid.nope')).toThrow();
  });
});
