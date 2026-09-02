<template lang="pug">
EduOfferGate(
  :kind="Zeus.EduOfferKind.PARENT"
  hint="Чтобы записывать обучающихся на курсы, подпишите оферту родителя-слушателя по ЦПП «Образование». Это можно сделать один раз — дальше только взносы и курсы."
  offer-description="Оферта родителя-слушателя определяет условия участия в образовательной программе кооператива и включает согласие на передачу почты обучающегося образовательной площадке."
  offer-title="офертой родителя-слушателя по ЦПП «Образование»"
  target-route="edubridge-learners"
)
</template>

<script setup lang="ts">
import { Zeus } from '@coopenomics/sdk';
import { EduOfferGate } from '../../features/OfferGate';
</script>
