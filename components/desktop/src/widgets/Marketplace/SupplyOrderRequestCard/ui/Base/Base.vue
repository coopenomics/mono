<script setup lang="ts">
import { computed } from 'vue'
import type { IRequestData } from 'src/entities/Request/model'
import {
  FirstStep,
  SecondStep,
  ThirdStep,
  FourthStep,
  FifthStep,
  SixthStep,
  SeventhStep,
  EightStep,
} from '../Steps'
import ReqReturnStep from '../Steps/ReqReturnStep.vue'
import RetAuthorizedStep from '../Steps/RetAuthorizedStep.vue'
import { env } from 'src/shared/config'

const props = defineProps<{
  request: IRequestData
}>()

const request = computed(() => props.request)

const step = computed(() => {
  const statuses: Record<string, number> = {
    published: 1,
    active: 1,
    accepted: 2,
    authorized: 3,
    supplied1: 4,
    supplied2: 5,
    delivered: 6,
    reqreturn: 7,
    retauthorized: 8,
    recieved1: 9,
    recieved2: 10,
    completed: 11,
    canceled: 0,
    declined: 0,
  }
  return statuses[props.request.status] ?? 0
})

import { useSessionStore } from 'src/entities/Session'
const session = useSessionStore()
const username = computed(() => session.username)
const iAmSupplier = computed(() => props.request.product_contributor == username.value)
const iAmReciever = computed(() => props.request.money_contributor == username.value)
const iAmAuthorizer = computed(() => session.isChairman || session.isMember)

const src = computed(() => {
  const preview = props.request?.data?.preview
  if (!preview) return
  if (preview.startsWith('https://')) return preview
  return env.STORAGE_URL + preview
})

const isCoopstock = computed(() => props.request.type === 'coopstock')
</script>

<template lang="pug">
q-card(flat).no-select
  div.q-pa-md
    div.row
      div.col-md-3.col-xs-12
        div.row.items-center.q-mb-sm
          div.text-h6 {{ request.data?.title || 'Заявка' }}
          q-chip(v-if="isCoopstock" color="blue" text-color="white" dense).q-ml-sm Из запасов
        div.q-mb-xs
          span.text-grey-7 Заказ:
          q-badge(size="lg").q-ml-xs {{ request.remain_units || request.blocked_units || request.delivered_units }} ед.
        div.q-mb-xs
          span.text-grey-7 Цена:
          q-badge(size="lg" color="green").q-ml-xs {{ request.unit_cost }}
        div.q-mb-xs(v-if="request.membership_fee_amount")
          span.text-grey-7 Членский взнос:
          q-badge(size="lg" color="orange").q-ml-xs {{ request.membership_fee_amount }}
        div.q-mb-xs
          span.text-grey-7 Статус:
          q-chip(:color="step > 0 ? 'primary' : 'negative'" text-color="white" dense).q-ml-xs {{ request.status }}
        img(v-if="src" :src="src").full-width.q-mt-lg.rounded-borders

      div.col-md-9.col-xs-12
        q-stepper(
          v-model="step"
          flat
          vertical
          color="primary"
          animated
          done-color="green"
        )
          //- Шаги 1-6: стандартный flow (от создания до доставки)
          FirstStep(:request='request' :i-am-supplier="iAmSupplier" :i-am-authorizer="iAmAuthorizer" :i-am-reciever="iAmReciever" :username="username" :current-step="step")
          SecondStep(:request='request' :i-am-supplier="iAmSupplier" :i-am-authorizer="iAmAuthorizer" :i-am-reciever="iAmReciever" :username="username" :current-step="step")
          ThirdStep(:request='request' :i-am-supplier="iAmSupplier" :i-am-authorizer="iAmAuthorizer" :i-am-reciever="iAmReciever" :username="username" :current-step="step")
          FourthStep(:request='request' :i-am-supplier="iAmSupplier" :i-am-authorizer="iAmAuthorizer" :i-am-reciever="iAmReciever" :username="username" :current-step="step")
          FifthStep(:request='request' :i-am-supplier="iAmSupplier" :i-am-authorizer="iAmAuthorizer" :i-am-reciever="iAmReciever" :username="username" :current-step="step")
          SixthStep(:request='request' :i-am-supplier="iAmSupplier" :i-am-authorizer="iAmAuthorizer" :i-am-reciever="iAmReciever" :username="username" :current-step="step")

          //- Шаг 7: Запрос возврата (новый)
          ReqReturnStep(:request='request' :i-am-reciever="iAmReciever" :username="username" :current-step="step")

          //- Шаг 8: Авторизация возврата советом (новый)
          RetAuthorizedStep(:request='request' :i-am-authorizer="iAmAuthorizer" :current-step="step")

          //- Шаги 9-10: Получение и подтверждение
          SeventhStep(:request='request' :i-am-supplier="iAmSupplier" :i-am-authorizer="iAmAuthorizer" :i-am-reciever="iAmReciever" :username="username" :current-step="step")
          EightStep(:request='request' :i-am-supplier="iAmSupplier" :i-am-authorizer="iAmAuthorizer" :i-am-reciever="iAmReciever" :username="username" :current-step="step")
</template>
