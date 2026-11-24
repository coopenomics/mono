<template lang="pug">
BaseButton(variant='secondary', block, @click='openSettings')
  template(#icon-left)
    q-icon(name='tune', size='18px')
  | {{ $t('extension.settingsButton.label') }}
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';
import { BaseButton } from 'src/shared/ui/base';

const router = useRouter();

const openSettings = () => {
  router.push({ name: 'extension-settings' });
};
</script>
