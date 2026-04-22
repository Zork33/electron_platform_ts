<template>
  <q-dialog v-model="isOpen" persistent>
    <q-card style="min-width: 400px">
      <q-card-section>
        <div class="text-h6">{{ title }}</div>
      </q-card-section>

      <q-card-section class="q-pt-none">
        <q-form ref="formRef" @submit="handleSubmit">
          <q-input
            v-model="formData.url"
            label="URL"
            filled
            lazy-rules
            :rules="[
              (v) => !!v || 'Обязательное поле',
              (v) => /^https?:\/\/.+/.test(v) || 'Введите корректный URL (http:// или https://)'
            ]"
          >
            <template #prepend>
              <q-icon name="link" />
            </template>
          </q-input>

          <q-input
            v-model="formData.title"
            label="Название"
            filled
            placeholder="Например: Личный сайт, LinkedIn"
            class="q-mt-md"
          />

          <q-input
            v-model="formData.description"
            label="Описание"
            filled
            placeholder="Дополнительная информация"
            class="q-mt-md"
          />

          <q-checkbox
            v-model="formData.is_primary"
            label="Основная ссылка"
            class="q-mt-md"
          />
        </q-form>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat label="Отмена" color="grey" @click="handleCancel" />
        <q-btn
          flat
          label="Сохранить"
          color="primary"
          :loading="saving"
          @click="() => formRef?.submit()"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, watch } from 'vue'

interface WebLinkFormData {
  url: string
  title: string
  description: string
  is_primary: boolean
}

const props = defineProps<{
  modelValue: boolean
  title?: string
  initialData?: WebLinkFormData | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'save': [data: WebLinkFormData]
}>()

const isOpen = ref(props.modelValue)
const saving = ref(false)
const formRef = ref<{ submit: () => void } | null>(null)

const formData = reactive<WebLinkFormData>({
  url: '',
  title: '',
  description: '',
  is_primary: false
})

watch(() => props.modelValue, (val) => {
  isOpen.value = val
  if (val) {
    if (props.initialData) {
      formData.url = props.initialData.url
      formData.title = props.initialData.title
      formData.description = props.initialData.description
      formData.is_primary = props.initialData.is_primary
    } else {
      formData.url = ''
      formData.title = ''
      formData.description = ''
      formData.is_primary = false
    }
  }
})

watch(isOpen, (val) => {
  emit('update:modelValue', val)
})

const handleSubmit = () => {
  emit('save', { ...formData })
}

const handleCancel = () => {
  isOpen.value = false
}

defineExpose({
  setSaving: (value: boolean) => {
    saving.value = value
  },
  close: () => {
    isOpen.value = false
  }
})
</script>
