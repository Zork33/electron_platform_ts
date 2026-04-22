<template>
  <q-page padding>
    <div class="q-pa-md">
      <h4 class="q-mt-none q-mb-md">Файловое хранилище</h4>

      <!-- Health Check -->
      <q-card class="q-mb-md">
        <q-card-section>
          <div class="text-h6">Статус хранилища</div>
        </q-card-section>
        <q-card-section>
          <q-btn
            color="primary"
            label="Проверить статус"
            icon="health_and_safety"
            @click="checkHealth"
            :loading="healthLoading"
          />
          <div v-if="healthStatus !== null" class="q-mt-md">
            <q-badge :color="healthStatus ? 'positive' : 'negative'" class="text-h6">
              {{ healthStatus ? 'Работает' : 'Недоступно' }}
            </q-badge>
          </div>
        </q-card-section>
      </q-card>

      <!-- Управление разделами -->
      <q-card class="q-mb-md">
        <q-card-section>
          <div class="text-h6">Управление разделами (buckets)</div>
        </q-card-section>

        <q-card-section>
          <div class="row q-gutter-md q-mb-md">
            <q-input
              v-model="newPartName"
              label="Имя раздела"
              outlined
              dense
              style="min-width: 250px"
              hint="Только строчные буквы, цифры и дефисы"
            />
            <q-checkbox
              v-model="newPartIsPublic"
              label="Публичный"
            />
            <q-btn
              color="secondary"
              label="Создать раздел"
              icon="add"
              @click="createPart"
              :loading="createLoading"
              :disable="!newPartName"
            />
          </div>

          <q-btn
            color="primary"
            label="Обновить список"
            icon="refresh"
            @click="loadParts"
            :loading="partsLoading"
            class="q-mb-md"
          />

          <q-list bordered separator v-if="parts.length > 0">
            <q-item v-for="part in parts" :key="part">
              <q-item-section avatar>
                <q-avatar color="primary" text-color="white" icon="folder" />
              </q-item-section>
              <q-item-section>
                <q-item-label>{{ part }}</q-item-label>
              </q-item-section>
              <q-item-section side>
                <div class="q-gutter-sm">
                  <q-btn
                    flat
                    dense
                    round
                    color="primary"
                    icon="upload"
                    @click="selectPartForUpload(part)"
                  >
                    <q-tooltip>Загрузить файл</q-tooltip>
                  </q-btn>
                  <q-btn
                    flat
                    dense
                    round
                    color="negative"
                    icon="delete"
                    @click="confirmDelete(part)"
                  >
                    <q-tooltip>Удалить раздел</q-tooltip>
                  </q-btn>
                </div>
              </q-item-section>
            </q-item>
          </q-list>
          <div v-else class="text-grey-7 q-pa-md text-center">
            Разделы не найдены. Создайте новый раздел.
          </div>
        </q-card-section>
      </q-card>

      <!-- Загрузка файлов -->
      <q-card v-if="selectedPart" class="q-mb-md">
        <q-card-section>
          <div class="text-h6">Загрузка файла в раздел: {{ selectedPart }}</div>
        </q-card-section>

        <q-card-section>
          <div class="row q-gutter-md">
            <q-input
              v-model="uploadPath"
              label="Путь к файлу"
              outlined
              dense
              style="min-width: 300px"
              hint="Например: images/photo.jpg"
            />
            <q-file
              v-model="uploadFile"
              label="Выберите файл"
              outlined
              dense
              style="min-width: 250px"
            >
              <template v-slot:prepend>
                <q-icon name="attach_file" />
              </template>
            </q-file>
            <q-btn
              color="secondary"
              label="Загрузить"
              icon="cloud_upload"
              @click="uploadFileToStorage"
              :loading="uploadLoading"
              :disable="!uploadFile || !uploadPath"
            />
          </div>
          <q-banner v-if="uploadMessage" class="q-mt-md" :class="uploadSuccess ? 'bg-positive' : 'bg-negative'" text-color="white">
            {{ uploadMessage }}
          </q-banner>
        </q-card-section>
      </q-card>

      <!-- Управление файлами -->
      <q-card class="q-mb-md">
        <q-card-section>
          <div class="text-h6">Управление файлами</div>
        </q-card-section>

        <q-card-section>
          <div class="row q-gutter-md q-mb-md">
            <q-select
              v-model="managePartName"
              :options="parts"
              label="Раздел"
              outlined
              dense
              style="min-width: 200px"
            />
            <q-input
              v-model="manageFilePath"
              label="Путь к файлу"
              outlined
              dense
              style="min-width: 300px"
              hint="Например: images/photo.jpg"
            />
          </div>

          <div class="row q-gutter-md">
            <q-btn
              color="info"
              label="Получить информацию"
              icon="info"
              @click="getFileInfoAction"
              :loading="fileInfoLoading"
              :disable="!managePartName || !manageFilePath"
            />
            <q-btn
              color="primary"
              label="Получить ссылку"
              icon="link"
              @click="getPresignedUrlAction"
              :loading="presignedUrlLoading"
              :disable="!managePartName || !manageFilePath"
            />
            <q-btn
              color="negative"
              label="Удалить файл"
              icon="delete"
              @click="confirmDeleteFile"
              :loading="deleteFileLoading"
              :disable="!managePartName || !manageFilePath"
            />
          </div>

          <!-- Информация о файле -->
          <q-card v-if="fileInfo" class="q-mt-md file-info-card">
            <q-card-section>
              <div class="text-subtitle1 text-weight-bold">Информация о файле</div>
              <div class="q-mt-sm">
                <div><strong>Раздел:</strong> {{ fileInfo.storage_part_name }}</div>
                <div><strong>Путь:</strong> {{ fileInfo.path }}</div>
                <div><strong>Размер:</strong> {{ formatBytes(fileInfo.size_bytes) }}</div>
                <div><strong>Тип:</strong> {{ fileInfo.content_type || 'Не указан' }}</div>
                <div><strong>Последнее изменение:</strong> {{ fileInfo.last_modified ? new Date(fileInfo.last_modified).toLocaleString() : 'Не указано' }}</div>
                <div v-if="fileInfo.etag"><strong>ETag:</strong> {{ fileInfo.etag }}</div>
              </div>
            </q-card-section>
          </q-card>

          <!-- Presigned URL -->
          <q-card v-if="presignedUrl" class="q-mt-md file-info-card">
            <q-card-section>
              <div class="text-subtitle1 text-weight-bold">Ссылка для скачивания</div>
              <div class="q-mt-sm">
                <div class="q-mb-sm"><strong>Действительна:</strong> {{ presignedUrlExpiresIn }} секунд</div>
                <q-input
                  v-model="presignedUrl"
                  readonly
                  outlined
                  dense
                  type="url"
                >
                  <template v-slot:append>
                    <q-btn
                      flat
                      dense
                      icon="content_copy"
                      @click="copyPresignedUrl"
                    >
                      <q-tooltip>Копировать</q-tooltip>
                    </q-btn>
                    <q-btn
                      flat
                      dense
                      icon="open_in_new"
                      @click="openPresignedUrl"
                    >
                      <q-tooltip>Открыть</q-tooltip>
                    </q-btn>
                  </template>
                </q-input>
              </div>
            </q-card-section>
          </q-card>
        </q-card-section>
      </q-card>

      <!-- Скачивание файлов -->
      <q-card>
        <q-card-section>
          <div class="text-h6">Скачать файл</div>
        </q-card-section>

        <q-card-section>
          <div class="row q-gutter-md">
            <q-select
              v-model="downloadPartName"
              :options="parts"
              label="Раздел"
              outlined
              dense
              style="min-width: 200px"
            />
            <q-input
              v-model="downloadPath"
              label="Путь к файлу"
              outlined
              dense
              style="min-width: 300px"
              hint="Например: images/photo.jpg"
            />
            <q-btn
              color="primary"
              label="Скачать"
              icon="download"
              @click="downloadFileFromStorage"
              :loading="downloadLoading"
              :disable="!downloadPartName || !downloadPath"
            />
          </div>
        </q-card-section>
      </q-card>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import { fileStorageApi } from '@/shared/api'

const $q = useQuasar()

// Health check
const healthStatus = ref<boolean | null>(null)
const healthLoading = ref(false)

// Управление разделами
const parts = ref<string[]>([])
const partsLoading = ref(false)
const newPartName = ref('')
const newPartIsPublic = ref(false)
const createLoading = ref(false)

// Загрузка файлов
const selectedPart = ref<string | null>(null)
const uploadPath = ref('')
const uploadFile = ref<File | null>(null)
const uploadLoading = ref(false)
const uploadMessage = ref('')
const uploadSuccess = ref(false)

// Управление файлами
const managePartName = ref<string | null>(null)
const manageFilePath = ref('')
const fileInfo = ref<{
  storage_part_name: string
  path: string
  size_bytes: number
  content_type: string | null
  last_modified: string | null
  etag: string | null
} | null>(null)
const fileInfoLoading = ref(false)
const deleteFileLoading = ref(false)
const presignedUrl = ref<string>('')
const presignedUrlExpiresIn = ref<number>(0)
const presignedUrlLoading = ref(false)

// Скачивание файлов
const downloadPartName = ref<string | null>(null)
const downloadPath = ref('')
const downloadLoading = ref(false)

// Health check
const checkHealth = async () => {
  healthLoading.value = true
  try {
    const response = await fileStorageApi.healthCheck()
    healthStatus.value = response.healthy
    $q.notify({
      type: response.healthy ? 'positive' : 'negative',
      message: response.healthy ? 'Хранилище работает' : 'Хранилище недоступно'
    })
  } catch (error) {
    console.error('Health check failed:', error)
    healthStatus.value = false
    $q.notify({
      type: 'negative',
      message: 'Ошибка при проверке статуса'
    })
  } finally {
    healthLoading.value = false
  }
}

// Загрузка списка разделов
const loadParts = async () => {
  partsLoading.value = true
  try {
    const response = await fileStorageApi.listParts()
    parts.value = response.parts
    $q.notify({
      type: 'positive',
      message: `Найдено разделов: ${response.count}`
    })
  } catch (error) {
    console.error('Failed to load parts:', error)
    $q.notify({
      type: 'negative',
      message: 'Ошибка при загрузке списка разделов'
    })
  } finally {
    partsLoading.value = false
  }
}

// Создание раздела
const createPart = async () => {
  createLoading.value = true
  try {
    const response = await fileStorageApi.createPart({
      name: newPartName.value,
      is_public: newPartIsPublic.value
    })
    $q.notify({
      type: 'positive',
      message: response.message || 'Раздел создан успешно'
    })
    newPartName.value = ''
    newPartIsPublic.value = false
    await loadParts()
  } catch (error) {
    console.error('Failed to create part:', error)
    $q.notify({
      type: 'negative',
      message: 'Ошибка при создании раздела'
    })
  } finally {
    createLoading.value = false
  }
}

// Подтверждение удаления
const confirmDelete = (partName: string) => {
  $q.dialog({
    title: 'Подтверждение',
    message: `Вы уверены, что хотите удалить раздел "${partName}"?`,
    cancel: true,
    persistent: true
  }).onOk(() => {
    void deletePart(partName)
  })
}

// Удаление раздела
const deletePart = async (partName: string) => {
  try {
    const response = await fileStorageApi.deletePart(partName)
    $q.notify({
      type: 'positive',
      message: response.message || 'Раздел удален успешно'
    })
    await loadParts()
    if (selectedPart.value === partName) {
      selectedPart.value = null
    }
  } catch (error) {
    console.error('Failed to delete part:', error)
    $q.notify({
      type: 'negative',
      message: 'Ошибка при удалении раздела'
    })
  }
}

// Выбор раздела для загрузки
const selectPartForUpload = (partName: string) => {
  selectedPart.value = partName
  uploadMessage.value = ''
}

// Загрузка файла
const uploadFileToStorage = async () => {
  if (!uploadFile.value || !uploadPath.value || !selectedPart.value) return

  uploadLoading.value = true
  uploadMessage.value = ''
  try {
    await fileStorageApi.uploadFile(selectedPart.value, uploadFile.value, uploadPath.value)
    uploadSuccess.value = true
    uploadMessage.value = 'Файл успешно загружен'
    $q.notify({
      type: 'positive',
      message: 'Файл успешно загружен'
    })
    uploadFile.value = null
    uploadPath.value = ''
  } catch (error) {
    console.error('Failed to upload file:', error)
    uploadSuccess.value = false
    uploadMessage.value = 'Ошибка при загрузке файла (API endpoint пока не реализован)'
    $q.notify({
      type: 'warning',
      message: 'API endpoint для загрузки файлов пока не реализован'
    })
  } finally {
    uploadLoading.value = false
  }
}

// Получение информации о файле
const getFileInfoAction = async () => {
  if (!managePartName.value || !manageFilePath.value) return

  fileInfoLoading.value = true
  fileInfo.value = null
  try {
    const response = await fileStorageApi.getFileInfo(managePartName.value, manageFilePath.value)
    const info = response.file_info
    if (response.success && info) {
      fileInfo.value = info
      $q.notify({
        type: 'positive',
        message: 'Информация о файле получена'
      })
    }
  } catch (error) {
    console.error('Failed to get file info:', error)
    $q.notify({
      type: 'negative',
      message: 'Ошибка при получении информации о файле'
    })
  } finally {
    fileInfoLoading.value = false
  }
}

// Получение presigned URL
const getPresignedUrlAction = async () => {
  if (!managePartName.value || !manageFilePath.value) return

  presignedUrlLoading.value = true
  presignedUrl.value = ''
  try {
    const response = await fileStorageApi.getPresignedUrl(managePartName.value, manageFilePath.value)
    if (response.success && response.presigned_url) {
      presignedUrl.value = response.presigned_url
      presignedUrlExpiresIn.value = response.expires_in || 3600
      $q.notify({
        type: 'positive',
        message: 'Ссылка для скачивания получена'
      })
    }
  } catch (error) {
    console.error('Failed to get presigned URL:', error)
    $q.notify({
      type: 'negative',
      message: 'Ошибка при получении ссылки'
    })
  } finally {
    presignedUrlLoading.value = false
  }
}

// Копирование presigned URL
const copyPresignedUrl = async () => {
  if (!presignedUrl.value) return

  try {
    await navigator.clipboard.writeText(presignedUrl.value)
    $q.notify({
      type: 'positive',
      message: 'Ссылка скопирована в буфер обмена'
    })
  } catch (error) {
    console.error('Failed to copy:', error)
    $q.notify({
      type: 'negative',
      message: 'Не удалось скопировать ссылку'
    })
  }
}

// Открытие presigned URL
const openPresignedUrl = () => {
  if (!presignedUrl.value) return

  window.open(presignedUrl.value, '_blank')
}

// Подтверждение удаления файла
const confirmDeleteFile = () => {
  if (!managePartName.value || !manageFilePath.value) return

  $q.dialog({
    title: 'Подтверждение',
    message: `Вы уверены, что хотите удалить файл "${manageFilePath.value}" из раздела "${managePartName.value}"?`,
    cancel: true,
    persistent: true
  }).onOk(() => {
    void deleteFileAction()
  })
}

// Удаление файла
const deleteFileAction = async () => {
  if (!managePartName.value || !manageFilePath.value) return

  deleteFileLoading.value = true
  try {
    const response = await fileStorageApi.deleteFile(managePartName.value, manageFilePath.value)
    if (response.success) {
      $q.notify({
        type: 'positive',
        message: 'Файл успешно удален'
      })
      manageFilePath.value = ''
      fileInfo.value = null
    }
  } catch (error) {
    console.error('Failed to delete file:', error)
    $q.notify({
      type: 'negative',
      message: 'Ошибка при удалении файла'
    })
  } finally {
    deleteFileLoading.value = false
  }
}

// Форматирование размера файла
const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
}

// Скачивание файла
const downloadFileFromStorage = async () => {
  if (!downloadPartName.value || !downloadPath.value) return

  downloadLoading.value = true
  try {
    const blob = await fileStorageApi.downloadFile(downloadPartName.value, downloadPath.value)
    
    // Создаем ссылку для скачивания
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = downloadPath.value.split('/').pop() || 'file'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)

    $q.notify({
      type: 'positive',
      message: 'Файл успешно скачан'
    })
  } catch (error) {
    console.error('Failed to download file:', error)
    $q.notify({
      type: 'negative',
      message: 'Ошибка при скачивании файла'
    })
  } finally {
    downloadLoading.value = false
  }
}

// Загрузка данных при монтировании
onMounted(async () => {
  await loadParts()
})
</script>

<style scoped lang="scss">
.file-info-card {
  background: rgba(33, 150, 243, 0.1);
  border: 1px solid rgba(33, 150, 243, 0.3);
  
  // Dark mode
  .body--dark & {
    background: rgba(33, 150, 243, 0.15);
    border: 1px solid rgba(33, 150, 243, 0.4);
  }
}
</style>
