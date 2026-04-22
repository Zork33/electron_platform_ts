<template>
  <div class="media-gallery">

    <!-- Пусто -->
    <div v-if="!items.length && !uploading" class="media-gallery__empty">
      <q-icon name="photo_library" size="3rem" color="grey-5" />
      <div class="text-grey-6 text-caption q-mt-xs">Нет файлов</div>
    </div>

    <!-- Сетка с draggable -->
    <draggable
      v-else
      v-model="localItems"
      item-key="id"
      class="media-gallery__grid"
      :disabled="!onReorder"
      handle=".media-thumb"
      @end="onDragEnd"
    >
      <template #item="{ element: item }">
        <MediaThumbnail
          :item="item"
          :url="urls[item.id]"
          :loading="loadingIds.has(item.id)"
          :deleting="removingId === item.id"
          :editable="editable"
          @click="openViewer(item)"
          @delete="confirmRemove(item)"
          @rename="openRename(item)"
        />
      </template>
    </draggable>

    <!-- Кнопка добавления — только если onUpload передан извне -->
    <template v-if="onUpload">
      <q-btn
        round
        unelevated
        :loading="uploading"
        color="grey-3"
        text-color="grey-7"
        class="q-mt-sm"
        @click="!uploading && fileInputRef?.click()"
      >
        <q-icon name="add" size="1.4rem" />
        <q-tooltip>Добавить файл</q-tooltip>
      </q-btn>
      <input
        ref="fileInputRef"
        type="file"
        :accept="acceptAttr"
        style="display: none"
        @change="handleFileSelected"
      />
    </template>

    <!-- Viewer -->
    <MediaViewer
      v-model="viewerOpen"
      :items="localItems"
      :index="viewerIndex"
      :urls="urls"
      :loading-ids="loadingIds"
      @update:index="onViewerIndexChange"
    />

    <!-- Rename dialog -->
    <q-dialog v-model="renameOpen" persistent>
      <q-card style="min-width: 320px">
        <q-card-section class="text-subtitle1">Переименовать</q-card-section>
        <q-card-section class="q-pt-none">
          <q-input
            v-model="renameValue"
            filled
            dense
            autofocus
            label="Название"
            @keyup.enter="submitRename"
          />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Отмена" @click="renameOpen = false" />
          <q-btn
            flat
            label="Сохранить"
            color="primary"
            :loading="renaming"
            @click="submitRename"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, onUnmounted } from 'vue'
import { useQuasar } from 'quasar'
import draggable from 'vuedraggable'
import MediaThumbnail from './MediaThumbnail.vue'
import MediaViewer from './MediaViewer.vue'
import { fileManagerApi } from '@/shared/api'
import type { MediaItem, MediaFileSettings } from './types'

const props = withDefaults(
  defineProps<{
    items: MediaItem[]
    fileSettings?: MediaFileSettings | undefined
    editable?: boolean | undefined
    onUpload?: ((file: File) => Promise<void>) | undefined
    onRemove?: ((id: number) => Promise<void>) | undefined
    onReorder?: ((orderedIds: number[]) => Promise<void>) | undefined
    onRename?: ((id: number, filename: string) => Promise<void>) | undefined
  }>(),
  {
    editable: false,
  }
)

const $q = useQuasar()
const fileInputRef = ref<HTMLInputElement | null>(null)

// ─── Локальная копия для draggable ────────────────────────────────────────────

const localItems = ref<MediaItem[]>([...props.items])

watch(() => props.items, (newItems) => {
  const newItemsMap = new Map(newItems.map(i => [i.id, i]))
  const existingIds = new Set(localItems.value.map(i => i.id))

  // Сохраняем порядок существующих, обновляем их данные, удаляем исчезнувшие
  const kept = localItems.value
    .filter(i => newItemsMap.has(i.id))
    .map(i => newItemsMap.get(i.id)!)

  // Добавляем новые в конец
  const added = newItems.filter(i => !existingIds.has(i.id))

  localItems.value = [...kept, ...added]
}, { deep: true })

// ─── URL-кэш (blob → object URL, чтобы не зависеть от presigned-URL MinIO) ────

const urls = reactive<Record<number, string>>({})
const loadingIds = ref<Set<number>>(new Set())
const objectUrls = new Map<number, string>()

const fetchUrl = async (id: number) => {
  if (urls[id] || loadingIds.value.has(id)) return
  loadingIds.value = new Set([...loadingIds.value, id])
  try {
    const blob = await fileManagerApi.download(id)
    const objectUrl = URL.createObjectURL(blob)
    objectUrls.set(id, objectUrl)
    urls[id] = objectUrl
  } catch {
    // оставляем без URL — покажется иконка ошибки
  } finally {
    const next = new Set(loadingIds.value)
    next.delete(id)
    loadingIds.value = next
  }
}

const fetchUrls = (items: MediaItem[]) => {
  items
    .filter(item => item.type === 'image' || item.type === 'video')
    .filter(item => !urls[item.id])
    .forEach(item => void fetchUrl(item.id))
}

watch(() => props.items, (items) => fetchUrls(items), { immediate: true })

onUnmounted(() => {
  objectUrls.forEach(url => URL.revokeObjectURL(url))
  objectUrls.clear()
})

// ─── Файловый input ───────────────────────────────────────────────────────────

const acceptAttr = computed(() => {
  const s = props.fileSettings
  if (!s) return 'image/*,video/*'
  const parts: string[] = []
  if (s.image) parts.push('image/*')
  if (s.video) parts.push('video/*')
  if (s.audio) parts.push('audio/*')
  if (s.any) return '*/*'
  return parts.join(',') || '*/*'
})

const uploading = ref(false)

const handleFileSelected = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  input.value = ''

  if (!props.onUpload) return
  uploading.value = true
  try {
    await props.onUpload(file)
    $q.notify({ type: 'positive', message: 'Файл добавлен' })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Ошибка при загрузке'
    $q.notify({ type: 'negative', message: msg })
  } finally {
    uploading.value = false
  }
}

// ─── Удаление ─────────────────────────────────────────────────────────────────

const removingId = ref<number | null>(null)

const confirmRemove = (item: MediaItem) => {
  $q.dialog({
    title: 'Удалить файл?',
    message: `${item.filename}.${item.ext}`,
    cancel: true,
    persistent: true,
  }).onOk(() => {
    void doRemove(item.id)
  })
}

const doRemove = async (id: number) => {
  if (!props.onRemove) return
  removingId.value = id
  try {
    await props.onRemove(id)
    $q.notify({ type: 'positive', message: 'Файл удалён' })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Ошибка при удалении'
    $q.notify({ type: 'negative', message: msg })
  } finally {
    removingId.value = null
  }
}

// ─── Переименование ───────────────────────────────────────────────────────────

const renameOpen = ref(false)
const renameValue = ref('')
const renameTarget = ref<MediaItem | null>(null)
const renaming = ref(false)

const openRename = (item: MediaItem) => {
  renameTarget.value = item
  renameValue.value = item.filename
  renameOpen.value = true
}

const submitRename = async () => {
  if (!renameTarget.value || !props.onRename) return
  const newName = renameValue.value.trim()
  if (!newName) return
  renaming.value = true
  try {
    await props.onRename(renameTarget.value.id, newName)
    renameOpen.value = false
    $q.notify({ type: 'positive', message: 'Файл переименован' })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Ошибка при переименовании'
    $q.notify({ type: 'negative', message: msg })
  } finally {
    renaming.value = false
  }
}

// ─── Сортировка ───────────────────────────────────────────────────────────────

const onDragEnd = async () => {
  if (!props.onReorder) return
  try {
    await props.onReorder(localItems.value.map(i => i.id))
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Ошибка при сортировке'
    $q.notify({ type: 'negative', message: msg })
    localItems.value = [...props.items]
  }
}

// ─── Viewer ───────────────────────────────────────────────────────────────────

const viewerOpen = ref(false)
const viewerIndex = ref(0)

const openViewer = (item: MediaItem) => {
  const idx = localItems.value.findIndex(i => i.id === item.id)
  if (idx === -1) return
  viewerIndex.value = idx
  viewerOpen.value = true
  prefetchAround(idx)
}

const onViewerIndexChange = (idx: number) => {
  viewerIndex.value = idx
  prefetchAround(idx)
}

const prefetchAround = (idx: number) => {
  const neighbors = [idx - 1, idx, idx + 1].filter(i => i >= 0 && i < localItems.value.length)
  neighbors.forEach(i => {
    const item = localItems.value[i]
    if (item) void fetchUrl(item.id)
  })
}
</script>

<style scoped lang="scss">
.media-gallery {
  &__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 2rem 0;
  }

  &__grid {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    min-height: 10px;
  }
}
</style>
