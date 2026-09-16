<template>
  <AuthSplit
    :eyebrow="coopTitle"
    title="С возвращением"
    lead="Личный кабинет пайщика: приложения целевых потребительских программ и общие собрания пайщиков кооператива."
    quote="Общее собрание пайщиков — высший орган управления кооперативом."
    step-eyebrow="Вход"
    :heading="title"
    :text="subtitle"
  >
    <template v-if="$slots.actions" #actions>
      <slot name="actions" />
    </template>
    <template v-if="$slots['pane-foot']" #pane-foot>
      <slot name="pane-foot" />
    </template>
    <LoginForm @step-change="step = $event" />
    <template v-if="$slots.footer" #foot>
      <slot name="footer" />
    </template>
  </AuthSplit>
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import { LoginForm } from 'src/features/User/LoginUser/ui/LoginForm';
import { useLoginStepHeading } from 'src/features/User/LoginUser';
import { useSystemStore } from 'src/entities/System/model';
import { AuthSplit } from 'src/shared/ui/layout/AuthSplit';

const systemStore = useSystemStore();
const coopTitle = computed(() => systemStore.cooperativeDisplayName);

const { step, title, subtitle } = useLoginStepHeading({
  title: 'Вход для пайщиков',
  subtitle: 'Введите почту и пароль или ключ доступа.',
});
</script>
