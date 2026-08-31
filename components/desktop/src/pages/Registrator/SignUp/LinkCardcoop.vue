<template lang="pug">
div
  q-step(
    :name='store.steps.LinkCardcoop',
    title='У меня есть карта пайщика',
    :done='store.isStepDone("LinkCardcoop")'
  )
    p
      | Если вы уже пайщик другого кооператива и у вас есть карта пайщика — свяжите её
      | сейчас. Тогда участие в нашем кооперативе ляжет на ту же карту, а накопленное
      | не придётся начинать заново.

    p.text-caption.text-grey-7
      | Шаг необязательный: карту можно связать позже, из своего стола.

    .link-cardcoop__actions
      BaseButton(variant='primary', @click='openCardcoop')
        template(#icon-left)
          q-icon(name='badge', size='18px')
        | У меня есть карта

      BaseButton(variant='ghost', @click='store.next()') Пропустить
</template>

<script lang="ts" setup>
import { useRegistratorStore } from 'src/entities/Registrator';
import { BaseButton } from 'src/shared/ui/base/BaseButton';

/**
 * Шаг «У меня есть карта пайщика» (story 7.5 / 3B5-33, FR-E5).
 *
 * Вступающий с уже накопленным участием не должен заводить вторую карту — иначе накопленное
 * обнуляется (PRD 4.3). Связка устанавливается здесь, до приёма, а свидетельство о членстве
 * кооператив выпустит, когда совет примет решение.
 *
 * Шаг необязательный по построению: отказ ничего не ломает, связать карту можно и позже,
 * из стола пайщика.
 */
const store = useRegistratorStore();

/**
 * Уводит в сеть карт, не теряя начатое вступление.
 *
 * Новая вкладка, а не переход: человек в середине потока регистрации, и вернуть его сюда
 * из чужого домена нечем — уведя его совсем, мы заставили бы начинать заново.
 */
const openCardcoop = (): void => {
  if (store.cardcoopEnterUrl) window.open(store.cardcoopEnterUrl, '_blank', 'noopener');
};
</script>

<style lang="scss" scoped>
.link-cardcoop__actions {
  display: flex;
  gap: var(--p-3);
  align-items: center;
  margin-top: var(--p-4);
}
</style>
