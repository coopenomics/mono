<template lang="pug">
BaseButton(variant='ghost', :block='block', @click='cancel') {{ $t('extension.cancelButton.label') }}
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';
import { BaseButton } from 'src/shared/ui/base';

/** На всю ширину колонки — в левой колонке настроек; в строке действий — по содержимому */
withDefaults(defineProps<{ block?: boolean }>(), { block: true });

const router = useRouter();

const cancel = () => {
  router.push({ name: 'one-extension' });
};
</script>
