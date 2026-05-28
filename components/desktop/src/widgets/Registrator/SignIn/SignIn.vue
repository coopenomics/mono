<template>
  <AuthCard
    title="Вход для пайщиков"
    subtitle="Цифровой Кооператив"
  >
    <LoginForm />
    <template v-if="$slots.footer" #footer>
      <slot name="footer" />
    </template>
  </AuthCard>
</template>

<script lang="ts" setup>
import { LoginForm } from 'src/features/User/LoginUser/ui/LoginForm';
import { AuthCard } from 'src/shared/ui/domain/AuthCard';
</script>
