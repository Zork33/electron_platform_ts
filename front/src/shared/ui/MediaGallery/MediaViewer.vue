<template>
  <q-dialog
    :model-value="modelValue"
    maximized
    transition-show="fade"
    transition-hide="fade"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <div class="viewer" @click.self="$emit('update:modelValue', false)">

      <!-- Шапка -->
      <div class="viewer__bar">
        <span class="viewer__filename text-caption text-grey-4">
          {{ currentItem?.filename }}.{{ currentItem?.ext }}
        </span>
        <q-space />
        <span class="viewer__counter text-caption text-grey-5 q-mr-md">
          {{ index + 1 }} / {{ items.length }}
        </span>
        <q-btn flat round dense icon="close" color="white" @click="$emit('update:modelValue', false)" />
      </div>

      <!-- Контент -->
      <div class="viewer__body">
        <!-- Стрелка влево -->
        <q-btn
          v-if="index > 0"
          flat round icon="chevron_left" color="white" size="lg"
          class="viewer__nav viewer__nav--left"
          @click.stop="prev"
        />

        <!-- Медиа -->
        <div class="viewer__media">
          <q-spinner v-if="loadingUrl" size="3rem" color="primary" />

          <img
            v-else-if="currentUrl && currentItem?.type === 'image'"
            :src="currentUrl"
            :alt="currentItem.filename"
            class="viewer__img"
          />

          <video
            v-else-if="currentUrl && currentItem?.type === 'video'"
            :src="currentUrl"
            class="viewer__video"
            controls
            autoplay
          />

          <div v-else class="viewer__placeholder">
            <q-icon
              :name="mediaIcon(currentItem?.type)"
              size="5rem"
              color="grey-6"
            />
            <div class="text-grey-6 q-mt-sm text-caption">
              Предпросмотр недоступен
            </div>
          </div>
        </div>

        <!-- Стрелка вправо -->
        <q-btn
          v-if="index < items.length - 1"
          flat round icon="chevron_right" color="white" size="lg"
          class="viewer__nav viewer__nav--right"
          @click.stop="next"
        />
      </div>

    </div>
  </q-dialog>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue'
import type { MediaItem, MediaType } from './types'

const props = defineProps<{
  modelValue: boolean
  items: MediaItem[]
  index: number
  urls: Record<number, string>
  loadingIds: Set<number>
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'update:index': [index: number]
}>()

const currentItem = computed(() => props.items[props.index] ?? null)

const currentUrl = computed(() =>
  currentItem.value ? (props.urls[currentItem.value.id] ?? null) : null
)

const loadingUrl = computed(() =>
  currentItem.value ? props.loadingIds.has(currentItem.value.id) : false
)

const prev = () => {
  if (props.index > 0) emit('update:index', props.index - 1)
}

const next = () => {
  if (props.index < props.items.length - 1) emit('update:index', props.index + 1)
}

const mediaIcon = (type: MediaType | undefined): string => {
  if (type === 'audio') return 'audiotrack'
  if (type === 'text') return 'description'
  return 'broken_image'
}

// Навигация с клавиатуры — обрабатываем пока диалог открыт
const handleKeydown = (e: KeyboardEvent) => {
  if (!props.modelValue) return
  if (e.key === 'ArrowLeft') prev()
  if (e.key === 'ArrowRight') next()
  if (e.key === 'Escape') emit('update:modelValue', false)
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      window.addEventListener('keydown', handleKeydown)
    } else {
      window.removeEventListener('keydown', handleKeydown)
    }
  },
  { immediate: true }
)
</script>

<style scoped lang="scss">
.viewer {
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.92);
  display: flex;
  flex-direction: column;

  &__bar {
    display: flex;
    align-items: center;
    padding: 8px 16px;
    height: 48px;
    flex-shrink: 0;
  }

  &__filename {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 50%;
  }

  &__body {
    flex: 1;
    display: flex;
    align-items: center;
    position: relative;
    min-height: 0;
  }

  &__media {
    flex: 1;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 80px;
    min-height: 0;
  }

  &__img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
    border-radius: 4px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
  }

  &__video {
    max-width: 100%;
    max-height: 100%;
    border-radius: 4px;
  }

  &__placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }

  &__nav {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    z-index: 1;
    background: rgba(255, 255, 255, 0.1) !important;

    &:hover {
      background: rgba(255, 255, 255, 0.2) !important;
    }

    &--left { left: 8px; }
    &--right { right: 8px; }
  }

  &__counter {
    white-space: nowrap;
  }
}
</style>
