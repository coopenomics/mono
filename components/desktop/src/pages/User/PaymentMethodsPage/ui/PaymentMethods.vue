<template lang="pug">
PaymentMethodsCard(:username='username')

//- Действие страницы — кнопка добавления реквизитов — через canon Teleport
//- в слот-host шапки. На мобильном — micro-вариант (иконка + tooltip).
Teleport(to='#header-actions-host', defer)
  AddPaymentButton(:username='username', :micro='isMobile')
</template>

<script lang="ts" setup>
import { PaymentMethodsCard } from 'src/widgets/User/PaymentMethods';
import { AddPaymentButton } from 'src/features/PaymentMethod/AddPaymentMethod';
import { computed } from 'vue';
import { useSessionStore } from 'src/entities/Session';
import { useWindowSize } from 'src/shared/hooks';

const session = useSessionStore();
const username = computed(() => session.username);
const { isMobile } = useWindowSize();
</script>
