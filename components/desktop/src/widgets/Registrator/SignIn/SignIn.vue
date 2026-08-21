<template>
  <AuthCard :title="title" :subtitle="subtitle">
    <LoginForm @step-change="step = $event" />
    <template v-if="$slots.footer" #footer>
      <slot name="footer" />
    </template>
  </AuthCard>
</template>

<script lang="ts" setup>
import { LoginForm } from 'src/features/User/LoginUser/ui/LoginForm';
import { useLoginStepHeading } from 'src/features/User/LoginUser';
import { AuthCard } from 'src/shared/ui/domain/AuthCard';

const { step, title, subtitle } = useLoginStepHeading({
  title: 'Вход для пайщиков',
  subtitle: 'Цифровой Кооператив',
});
</script>
