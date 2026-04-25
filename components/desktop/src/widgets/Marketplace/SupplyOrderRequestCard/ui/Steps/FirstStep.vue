<script setup lang="ts">
  import { AcceptButton } from 'src/features/Request/AcceptRequest'
  import { DeclineButton } from 'src/features/Request/DeclineRequest'
  import { computed, withDefaults } from 'vue'
  import type { IStepProps } from '../../model'
  import { useSessionStore } from 'src/entities/Session'
  const session = useSessionStore()
  const username = computed(() => session.username)

  const props = withDefaults(defineProps<IStepProps>(), {})
  const isActive = computed(() => props.request.status === 'published')
  const currentStep = computed(()=> props.currentStep)
</script>

<template lang="pug">
div
  template(v-if="props.iAmSupplier")
    q-step(
      :name="1"
      title="Поступил новый заказ!"
      icon="settings"
      :done="currentStep > 1"
    )
      span Пожалуйста, подтвердите свою готовность совершить поставку.

      q-stepper-navigation.q-gutter-sm
        DeclineButton(v-if="iAmSupplier && isActive" :request-id="Number(request.id)" :coopname="request.coopname" :username="username")
        //- q-btn(v-if="iAmSupplier && isActive" @click="decline") Отклонить
        AcceptButton(v-if="iAmSupplier && isActive" :request-id="Number(request.id)" :coopname="request.coopname" :username="username")
        p {{request}}
  template(v-else)
    q-step(
      :name="1"
      title="Получаем подтверждение от поставщика"
      icon="settings"
      :done="currentStep > 1"
    )
      span Ожидаем подтверждение поставщика о его готовности совершить поставку в срок.
</template>
