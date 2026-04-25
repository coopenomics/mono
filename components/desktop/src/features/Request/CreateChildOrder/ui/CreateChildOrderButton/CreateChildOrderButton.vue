<script setup lang="ts">
  import { FailAlert, SuccessAlert } from 'src/shared/api'
  import { api } from '../../api'
  import type { ICreateChildOrderProps } from '../../model'
  import { withDefaults } from 'vue'
  import { useRouter } from 'vue-router'
  import { useSessionStore } from 'src/entities/Session'
  import { DigitalDocument } from 'src/shared/lib/document'

  const router = useRouter()
  const { username } = useSessionStore()
  const props = withDefaults(defineProps<ICreateChildOrderProps>(), {})

  const createOrder = async () => {
    try {
      //TODO: запрос должен быть корректным на основе информации из бч
      const document = await api.generateReturnByAssetStatement({
        coopname: props.coopname,
        request: {
          currency: 'RUB',
          hash: 'hash',
          program_id: 1,
          title: 'test',
          total_cost: '10.0000 RUB',
          type: '',
          unit_cost: props.offer.unit_cost,
          unit_of_measurement: '',
          units: props.units
        },
        username: props.username
      })

      // Создаем документ и подписываем его
      const digitalDocument = new DigitalDocument(document)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const signedDocument = await digitalDocument.sign(username)

      // await api.createChildOrder({
      //   coopname: props.coopname,
      //   username: props.username,
      //   parent_id: Number(props.offer.id),
      //   program_id: Number(props.offer.program_id),
      //   units: props.units,
      //   unit_cost: props.offer.unit_cost,
      //   data: '',
      //   document: {...signedDocument, meta: JSON.stringify(signedDocument.meta)},
      //   meta: '',
      //   product_lifecycle_secs: 100
      // })
      SuccessAlert('Заказ НЕ создан')
      router.push({ name: 'marketplace-user-supplies' }) //TODO роутинг
    } catch (e: any) {
      FailAlert(e)
    }
  }
</script>
<template lang="pug">
q-btn(size="lg" @click="createOrder") оплатить
</template>
