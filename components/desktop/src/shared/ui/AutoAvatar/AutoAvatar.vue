<template lang="pug">
.auto-avatar(
  v-if='ready',
  :style='rootStyle',
  :class='{ "auto-avatar--animated": animated }'
)
  //- Анимированный режим: инлайн-SVG (его внутренние сегменты можно крутить).
  .auto-avatar__svg(v-if='animated', v-html='svgMarkup')
  //- Обычный режим: картинка из blob (как было) — для CoopCard и т.п.
  q-img.auto-avatar__img(v-else, :src='ava')
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { createAvatar } from '@dicebear/core'
import { rings } from '@dicebear/collection'

const ava = ref<string>()
const svgMarkup = ref<string>('')
const ready = ref(false)

const props = withDefaults(
  defineProps<{
    username: string
    /** Размер плитки в пикселях. */
    size?: number
    /** Скругление углов (CSS-значение). */
    radius?: string
    /** Фон плитки под аватаром. */
    background?: string
    /** Палитра цветов колец — DiceBear выбирает детерминированно по seed. */
    ringColor?: string[]
    /** Инлайн-SVG + анимация сегментов по hover. */
    animated?: boolean
  }>(),
  {
    size: 100,
    radius: '50%',
    background: 'black',
    ringColor: () => ['4db6ac'],
    animated: false,
  },
)

const username = computed(() => props.username)

const rootStyle = computed(() => ({
  width: `${props.size}px`,
  background: props.background,
  borderRadius: props.radius,
}))

// Оборачиваем каждый сегмент-дугу (parent у <path>) в группу .ring-seg
// без собственного transform, чтобы CSS-вращение складывалось с базовым
// поворотом дуги вокруг центра 50 50, не затирая его.
function wrapSegments(svgStr: string): string {
  const ns = 'http://www.w3.org/2000/svg'
  const doc = new DOMParser().parseFromString(svgStr, 'image/svg+xml')
  const svg = doc.documentElement
  Array.from(svg.querySelectorAll('path')).forEach((path, i) => {
    const seg = path.parentNode as Element | null
    if (!seg || !seg.parentNode) return
    const wrapper = doc.createElementNS(ns, 'g')
    wrapper.setAttribute('class', 'ring-seg')
    wrapper.setAttribute('style', `--seg:${i}`)
    seg.parentNode.insertBefore(wrapper, seg)
    wrapper.appendChild(seg)
  })
  return new XMLSerializer().serializeToString(svg)
}

function render() {
  if (!username.value) return
  const avatar = createAvatar(rings, {
    seed: username.value,
    ringColor: props.ringColor,
  })
  const svgStr = avatar.toString()
  if (props.animated) {
    svgMarkup.value = wrapSegments(svgStr)
  } else {
    const blob = new Blob([svgStr], { type: 'image/svg+xml' })
    ava.value = URL.createObjectURL(blob)
  }
  ready.value = true
}

onMounted(render)
watch(username, render)
</script>

<style scoped lang="scss">
.auto-avatar {
  overflow: hidden;
  line-height: 0;
}
.auto-avatar__img {
  width: 100%;
  border-radius: inherit;
}
</style>
