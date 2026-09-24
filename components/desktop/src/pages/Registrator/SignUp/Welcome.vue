<template lang="pug">
div(v-show='store.isStep("Welcome")')

    p {{ $t('registrator.welcome.text', { coopName: coopTitle }) }}

    div.q-mt-lg
      BaseButton(variant='primary', @click='next') {{ $t('registrator.welcome.submit') }}
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router';
import { useRegistratorStore } from 'src/entities/Registrator';
import { env } from 'src/shared/config';
import { BaseButton } from 'src/shared/ui/base/BaseButton';

const router = useRouter()
const store = useRegistratorStore()
const coopTitle = computed(() => env.COOP_SHORT_NAME)

const next = () => {
  router.push({ name: 'index' })
}

</script>
