<template lang="pug">
.members-page
  //- Заголовок не дублируем (он в шапке-крошке); пояснение — на канон-поверхности.
  .banner
    q-icon.banner__icon(name='fa-solid fa-circle-info' size='18px')
    .banner__body
      | Состав членов совета должен быть утверждён общим собранием пайщиков.

  CooperativeMembers
</template>

<script lang="ts" setup>
import { onMounted } from 'vue';
import { useHeaderActions } from 'src/shared/hooks';
import { AddMemberButton } from 'src/features/Cooperative/UpdateBoard';
import { CooperativeMembers } from 'src/widgets/Cooperative/Members';

const { registerAction } = useHeaderActions();

onMounted(() => {
  registerAction({
    id: 'add-board-member',
    component: AddMemberButton,
    order: 1,
  });
});
</script>

<style scoped lang="scss">
.members-page {
  display: flex;
  flex-direction: column;
  gap: var(--p-5, 20px);
  padding: var(--p-6, 24px);
  @media (max-width: 768px) {
    padding: var(--p-4, 16px);
  }
}
</style>
