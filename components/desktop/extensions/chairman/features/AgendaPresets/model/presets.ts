import { useSessionStore } from 'src/entities/Session'
import { Cooperative } from 'cooptypes'
import type { IDocumentPreset } from './types'
import { useSystemStore } from 'src/entities/System/model'
import { t } from '../../../i18n';

export const useBlagorostPresets = (): IDocumentPreset[] => {
  const systemStore = useSystemStore()
  const sessionStore = useSessionStore()

  return [
    {
      id: 'blagorost_program',
      registry_id: Cooperative.Registry.BlagorostProgramTemplate.registry_id,
      title: t('chairman.blagorostPreset.title'),
      description: t('chairman.blagorostPreset.description'),
      // i18n-ignore: текст вопроса повестки — дословно уходит в протокол решения совета, юридический документ
      question: 'О утверждении Положения о целевой потребительской программе «БЛАГОРОСТ»',
      // i18n-ignore: текст решения — дословно уходит в протокол решения совета, юридический документ
      decisionPrefix: 'Утвердить Положение о целевой потребительской программе «БЛАГОРОСТ»:',
      getData: () => ({
        coopname: systemStore.info?.coopname || '',
        username: sessionStore.username,
        registry_id: Cooperative.Registry.BlagorostProgramTemplate.registry_id,
      }),
    },
    // Пресета оферты «Благорост» здесь больше нет: шаблон-двойник 999 выведен из
    // реестра (16.09.2026). Совет утверждает саму оферту 1000 в виде бланка — через
    // карточку подключения Капитала и реестр документов, а не свободным решением.
  ]
}
