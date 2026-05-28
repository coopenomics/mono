<template lang="pug">
AuthCard(:max-width='600', title='Пожалуйста, войдите, чтобы продолжить')
  LoginForm
</template>

<script lang="ts" setup>
import { LoginForm } from 'src/features/User/LoginUser/ui/LoginForm';
import { AuthCard } from 'src/shared/ui/domain/AuthCard';
</script>
