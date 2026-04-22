<template>
  <q-page padding>
    <div class="q-pa-md">
      <h4 class="q-mt-none q-mb-md">File Manager</h4>

      <!-- Загрузка файла -->
      <q-card class="q-mb-md">
        <q-card-section>
          <div class="text-h6">Загрузка файла</div>
        </q-card-section>
        <q-card-section>
          <div class="row q-gutter-md">
            <q-select
              v-model="uploadStoragePart"
              :options="['private', 'public']"
              label="Раздел"
              outlined
              dense
              style="min-width: 120px"
            />
            <q-input
              v-model="uploadPath"
              label="Путь"
              outlined
              dense
              style="min-width: 250px"
              hint="Например: test/document"
            />
            <q-input
              v-model="uploadFilename"
              label="Имя файла"
              outlined
              dense
              style="min-width: 200px"
            />
            <q-input
              v-model="uploadExt"
              label="Расширение"
              outlined
              dense
              style="min-width: 80px"
            />
            <q-file
              v-model="uploadFile"
              label="Файл"
              outlined
              dense
              style="min-width: 200px"
              @update:model-value="onUploadFileSelected"
            >
              <template v-slot:prepend>
                <q-icon name="attach_file" />
              </template>
            </q-file>
            <q-checkbox v-model="uploadWithReplace" label="Перезаписать при наличии" />
            <q-btn
              color="primary"
              label="Загрузить"
              icon="cloud_upload"
              @click="upload"
              :loading="uploadLoading"
              :disable="!uploadFile || !uploadPath || !uploadFilename || !uploadExt"
            />
          </div>
          <q-banner v-if="uploadMessage" class="q-mt-md" :class="uploadSuccess ? 'bg-positive' : 'bg-negative'" text-color="white">
            {{ uploadMessage }}
          </q-banner>
        </q-card-section>
      </q-card>

      <!-- Список файлов -->
      <q-card>
        <q-card-section>
          <div class="row q-gutter-md q-mb-md">
            <q-checkbox v-model="includeDeleted" label="Показать удалённые" @update:model-value="loadList" />
            <q-btn color="primary" label="Обновить" icon="refresh" @click="loadList" :loading="listLoading" />
          </div>

          <q-table
            :rows="items"
            :columns="columns"
            row-key="id"
            flat
            bordered
            :loading="listLoading"
          >
            <template v-slot:body-cell-actions="props">
              <q-td :props="props">
                <div class="q-gutter-xs">
                  <q-btn
                    flat dense round
                    color="primary"
                    icon="info"
                    @click="showMetadata(props.row)"
                  >
                    <q-tooltip>Информация</q-tooltip>
                  </q-btn>
                  <q-btn
                    v-if="!props.row.deleted_at"
                    flat dense round
                    color="primary"
                    icon="download"
                    @click="downloadFile(props.row.id)"
                  >
                    <q-tooltip>Скачать</q-tooltip>
                  </q-btn>
                  <q-btn
                    v-if="!props.row.deleted_at"
                    flat dense round
                    color="info"
                    icon="link"
                    @click="getUrl(props.row.id)"
                  >
                    <q-tooltip>Ссылка</q-tooltip>
                  </q-btn>
                  <q-btn
                    v-if="props.row.deleted_at"
                    flat dense round
                    color="secondary"
                    icon="restore"
                    @click="restoreFile(props.row.id)"
                  >
                    <q-tooltip>Восстановить</q-tooltip>
                  </q-btn>
                  <q-btn
                    v-if="!props.row.deleted_at"
                    flat dense round
                    color="orange"
                    icon="swap_horiz"
                    @click="selectForReplace(props.row)"
                  >
                    <q-tooltip>Заменить</q-tooltip>
                  </q-btn>
                  <q-btn
                    flat dense round
                    color="negative"
                    icon="delete"
                    @click="confirmDelete(props.row)"
                  >
                    <q-tooltip>{{ props.row.deleted_at ? 'Удалить навсегда' : 'В корзину' }}</q-tooltip>
                  </q-btn>
                </div>
              </q-td>
            </template>
          </q-table>
        </q-card-section>
      </q-card>

      <q-dialog v-model="metadataDialog" persistent>
        <q-card style="min-width: 400px">
          <q-card-section>
            <div class="text-h6">Метаданные файла</div>
          </q-card-section>
          <q-card-section v-if="selectedMetadata">
            <div class="q-gutter-sm">
              <div><strong>ID:</strong> {{ selectedMetadata.id }}</div>
              <div><strong>Путь:</strong> {{ selectedMetadata.path }}</div>
              <div><strong>Имя:</strong> {{ selectedMetadata.filename }}.{{ selectedMetadata.ext }}</div>
              <div><strong>Размер:</strong> {{ formatBytes(selectedMetadata.size_bytes) }}</div>
              <div><strong>Создан:</strong> {{ formatDate(selectedMetadata.created_at) }}</div>
              <div v-if="selectedMetadata.deleted_at"><strong>Удалён:</strong> {{ formatDate(selectedMetadata.deleted_at) }}</div>
            </div>
          </q-card-section>
          <q-card-actions align="right">
            <q-btn flat label="Закрыть" color="primary" v-close-popup />
          </q-card-actions>
        </q-card>
      </q-dialog>

      <q-dialog v-model="replaceDialog" persistent>
        <q-card style="min-width: 400px">
          <q-card-section>
            <div class="text-h6">Заменить файл #{{ replaceFileId }}</div>
          </q-card-section>
          <q-card-section>
            <q-file v-model="replaceFile" label="Новый файл" outlined dense>
              <template v-slot:prepend>
                <q-icon name="attach_file" />
              </template>
            </q-file>
          </q-card-section>
          <q-card-actions align="right">
            <q-btn flat label="Отмена" color="grey" v-close-popup />
            <q-btn flat label="Заменить" color="primary" @click="doReplace" :loading="replaceLoading" :disable="!replaceFile" v-close-popup />
          </q-card-actions>
        </q-card>
      </q-dialog>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import { fileManagerApi } from '@/shared/api'
import type { StoredFileMetadata } from '@/shared/api'

const $q = useQuasar()

const items = ref<StoredFileMetadata[]>([])
const listLoading = ref(false)
const includeDeleted = ref(false)

const uploadStoragePart = ref('private')
const uploadPath = ref('')
const uploadFilename = ref('')
const uploadExt = ref('')
const uploadFile = ref<File | null>(null)
const uploadWithReplace = ref(false)
const uploadLoading = ref(false)
const uploadMessage = ref('')
const uploadSuccess = ref(false)

const metadataDialog = ref(false)
const selectedMetadata = ref<StoredFileMetadata | null>(null)

const replaceDialog = ref(false)
const replaceFileId = ref<number | null>(null)
const replaceFile = ref<File | null>(null)
const replaceLoading = ref(false)

const columns = [
  { name: 'id', label: 'ID', field: 'id', align: 'left' as const },
  { name: 'filename', label: 'Имя', field: (row: StoredFileMetadata) => `${row.filename}.${row.ext}`, align: 'left' as const },
  { name: 'path', label: 'Путь', field: 'path', align: 'left' as const },
  { name: 'size', label: 'Размер', field: (row: StoredFileMetadata) => formatBytes(row.size_bytes), align: 'left' as const },
  { name: 'created', label: 'Создан', field: (row: StoredFileMetadata) => formatDate(row.created_at), align: 'left' as const },
  { name: 'deleted', label: 'Удалён', field: (row: StoredFileMetadata) => row.deleted_at ? formatDate(row.deleted_at) : '-', align: 'left' as const },
  { name: 'actions', label: 'Действия', field: 'id', align: 'left' as const }
]

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
}

function formatDate(val: string | null): string {
  if (!val) return '-'
  return new Date(val).toLocaleString()
}

async function loadList() {
  listLoading.value = true
  try {
    const res = await fileManagerApi.list(includeDeleted.value)
    items.value = res.items || []
  } catch (e) {
    console.error(e)
    $q.notify({ type: 'negative', message: 'Ошибка загрузки списка' })
  } finally {
    listLoading.value = false
  }
}

function getFilenameParts(file: File): { name: string; ext: string } {
  const name = file.name
  const lastDot = name.lastIndexOf('.')
  if (lastDot > 0 && lastDot < name.length - 1) {
    return {
      name: name.slice(0, lastDot),
      ext: name.slice(lastDot + 1).toLowerCase()
    }
  }
  return { name, ext: '' }
}

function onUploadFileSelected(file: File | null) {
  if (file) {
    const { name, ext } = getFilenameParts(file)
    if (name) uploadFilename.value = name
    if (ext) uploadExt.value = ext
  }
}

async function upload() {
  if (!uploadFile.value || !uploadPath.value || !uploadFilename.value || !uploadExt.value) return
  const fullPath = `${uploadPath.value.replace(/\/$/, '')}/${uploadFilename.value}.${uploadExt.value}`
  uploadLoading.value = true
  uploadMessage.value = ''
  try {
    await fileManagerApi.upload(
      uploadFile.value,
      fullPath,
      uploadFilename.value,
      uploadExt.value,
      uploadStoragePart.value,
      uploadWithReplace.value
    )
    uploadSuccess.value = true
    uploadMessage.value = 'Файл загружен'
    uploadFile.value = null
    uploadFilename.value = ''
    uploadExt.value = ''
    await loadList()
  } catch (e) {
    uploadSuccess.value = false
    uploadMessage.value = e instanceof Error ? e.message : 'Ошибка загрузки'
    $q.notify({ type: 'negative', message: uploadMessage.value })
  } finally {
    uploadLoading.value = false
  }
}

function showMetadata(row: StoredFileMetadata) {
  selectedMetadata.value = row
  metadataDialog.value = true
}

async function downloadFile(id: number) {
  try {
    const blob = await fileManagerApi.download(id)
    const meta = items.value.find(i => i.id === id)
    const name = meta ? `${meta.filename}.${meta.ext}` : 'download'
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = name
    link.click()
    window.URL.revokeObjectURL(url)
    $q.notify({ type: 'positive', message: 'Файл скачан' })
  } catch {
    $q.notify({ type: 'negative', message: 'Ошибка скачивания' })
  }
}

async function getUrl(id: number) {
  try {
    const res = await fileManagerApi.getUrl(id)
    if (res.url) {
      await navigator.clipboard.writeText(res.url)
      $q.notify({ type: 'positive', message: 'Ссылка скопирована' })
    }
  } catch {
    $q.notify({ type: 'negative', message: 'Ошибка получения ссылки' })
  }
}

async function restoreFile(id: number) {
  try {
    await fileManagerApi.restore(id)
    $q.notify({ type: 'positive', message: 'Файл восстановлен' })
    await loadList()
  } catch {
    $q.notify({ type: 'negative', message: 'Ошибка восстановления' })
  }
}

function selectForReplace(row: StoredFileMetadata) {
  replaceFileId.value = row.id
  replaceFile.value = null
  replaceDialog.value = true
}

async function doReplace() {
  if (!replaceFileId.value || !replaceFile.value) return
  replaceLoading.value = true
  try {
    await fileManagerApi.replace(replaceFileId.value, replaceFile.value)
    $q.notify({ type: 'positive', message: 'Файл заменён' })
    replaceDialog.value = false
    await loadList()
  } catch {
    $q.notify({ type: 'negative', message: 'Ошибка замены' })
  } finally {
    replaceLoading.value = false
  }
}

function confirmDelete(row: StoredFileMetadata) {
  const hard = !!row.deleted_at
  $q.dialog({
    title: 'Подтверждение',
    message: hard
      ? `Удалить файл #${row.id} навсегда?`
      : `Переместить файл #${row.id} в корзину?`,
    cancel: true,
    persistent: true
  }).onOk(() => {
    void (async () => {
      try {
        await fileManagerApi.delete(row.id, hard)
        $q.notify({ type: 'positive', message: hard ? 'Удалено' : 'В корзину' })
        await loadList()
      } catch {
        $q.notify({ type: 'negative', message: 'Ошибка' })
      }
    })()
  })
}

onMounted(() => {
  void loadList()
})
</script>
