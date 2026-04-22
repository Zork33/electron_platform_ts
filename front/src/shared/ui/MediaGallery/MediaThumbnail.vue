<template>
  <div class="media-thumb" @click="$emit('click')">

    <!-- Загрузка URL -->
    <div v-if="loading" class="media-thumb__placeholder">
      <q-spinner color="grey-5" size="1.5rem" />
    </div>

    <!-- Изображение -->
    <img
      v-else-if="url && item.type === 'image'"
      :src="url"
      :alt="item.filename"
      class="media-thumb__img"
    />

    <!-- Видео -->
    <div v-else-if="url && item.type === 'video'" class="media-thumb__video-wrap">
      <video :src="url" class="media-thumb__img" preload="metadata" muted />
      <div class="media-thumb__play-icon">
        <q-icon name="play_circle" size="2rem" color="white" />
      </div>
    </div>

    <!-- Аудио -->
    <div v-else-if="item.type === 'audio'" class="media-thumb__placeholder">
      <q-icon name="audiotrack" size="2rem" color="grey-5" />
    </div>

    <!-- Текст -->
    <div v-else-if="item.type === 'text'" class="media-thumb__placeholder">
      <q-icon name="description" size="2rem" color="grey-5" />
    </div>

    <!-- Без URL / ошибка / неизвестный тип -->
    <div v-else class="media-thumb__placeholder media-thumb__placeholder--error">
      <q-icon name="broken_image" size="2rem" color="grey-4" />
    </div>

    <!-- Оверлей при наведении -->
    <div class="media-thumb__overlay">
      <q-icon name="zoom_in" size="1.5rem" color="white" />
    </div>

    <!-- Кнопки управления -->
    <div v-if="editable" class="media-thumb__actions">
      <q-btn
        round unelevated
        icon="drive_file_rename_outline"
        size="xs"
        color="white"
        text-color="grey-7"
        class="media-thumb__action-btn"
        @click.stop="$emit('rename')"
      >
        <q-tooltip>Переименовать</q-tooltip>
      </q-btn>
      <q-btn
        round unelevated
        icon="close"
        size="xs"
        color="white"
        text-color="negative"
        class="media-thumb__action-btn"
        :loading="deleting"
        @click.stop="$emit('delete')"
      >
        <q-tooltip>Удалить</q-tooltip>
      </q-btn>
    </div>

    <!-- Нижняя подпись -->
    <div class="media-thumb__footer">
      <span class="media-thumb__name">{{ item.filename }}.{{ item.ext }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { MediaItem } from './types'

defineProps<{
  item: MediaItem
  url?: string | undefined
  loading?: boolean | undefined
  deleting?: boolean | undefined
  editable?: boolean | undefined
}>()

defineEmits<{
  click: []
  delete: []
  rename: []
}>()
</script>

<style scoped lang="scss">
.media-thumb {
  position: relative;
  width: 140px;
  height: 140px;
  border-radius: 8px;
  overflow: hidden;
  flex-shrink: 0;
  cursor: pointer;
  background: rgba(128, 128, 128, 0.08);
  border: 1px solid rgba(0, 0, 0, 0.08);
  transition: box-shadow 0.2s;

  .body--dark & {
    border-color: rgba(255, 255, 255, 0.1);
  }

  &:hover {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);

    .media-thumb__overlay {
      opacity: 1;
    }

    .media-thumb__actions {
      opacity: 1;
    }
  }

  &__img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  &__placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;

    &--error {
      opacity: 0.5;
    }
  }

  &__video-wrap {
    position: relative;
    width: 100%;
    height: 100%;
  }

  &__play-icon {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.25);
    pointer-events: none;
  }

  &__overlay {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.28);
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transition: opacity 0.2s;
    pointer-events: none;
  }

  &__actions {
    position: absolute;
    top: 4px;
    right: 4px;
    display: flex;
    gap: 3px;
    opacity: 0;
    transition: opacity 0.2s;
  }

  &__action-btn {
    width: 22px;
    height: 22px;
    min-width: 22px;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
  }

  &__footer {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    padding: 3px 6px;
    background: rgba(0, 0, 0, 0.45);
    pointer-events: none;
  }

  &__name {
    display: block;
    font-size: 0.65rem;
    color: rgba(255, 255, 255, 0.85);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}
</style>
