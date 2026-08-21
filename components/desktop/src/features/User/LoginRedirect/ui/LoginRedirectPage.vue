<template lang="pug">
AuthCard(:max-width='600', :title='title', :subtitle='subtitle')
  LoginForm(@step-change='step = $event')
</template>

<script lang="ts" setup>
import { LoginForm } from 'src/features/User/LoginUser/ui/LoginForm';
import { useLoginStepHeading } from 'src/features/User/LoginUser';
import { AuthCard } from 'src/shared/ui/domain/AuthCard';

const { step, title, subtitle } = useLoginStepHeading({
  title: 'Пожалуйста, войдите, чтобы продолжить',
});
</script>
