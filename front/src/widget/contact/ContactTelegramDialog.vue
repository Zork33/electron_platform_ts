<template>
  <q-dialog v-model="isOpen" persistent>
    <q-card style="min-width: 400px">
      <q-card-section>
        <div class="text-h6">{{ title }}</div>
      </q-card-section>

      <q-card-section class="q-pt-none">
        <q-form ref="formRef" @submit="handleSubmit">
          <q-input
            v-model="formData.username"
            label="Username"
            filled
            lazy-rules
            :rules="[(v) => !!v || 'Обязательное поле']"
            hint="Без символа @"
          >
            <template #prepend>
              <q-icon name="alternate_email" />
            </template>
          </q-input>

          <q-input
            v-model="formData.first_name"
            label="Имя"
            filled
            class="q-mt-md"
          />

          <q-input
            v-model="formData.last_name"
            label="Фамилия"
            filled
            class="q-mt-md"
          />

          <q-input
            v-model="formData.description"
            label="Описание"
            filled
            placeholder="Например: Рабочий, Личный"
            class="q-mt-md"
          />

          <q-checkbox
            v-model="formData.is_primary"
            label="Основной аккаунт"
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

interface TelegramFormData {
  username: string
  first_name: string
  last_name: string
  description: string
  is_primary: boolean
}

const props = defineProps<{
  modelValue: boolean
  title?: string
  initialData?: TelegramFormData | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'save': [data: TelegramFormData]
}>()

const isOpen = ref(props.modelValue)
const saving = ref(false)
const formRef = ref<{ submit: () => void } | null>(null)

const formData = reactive<TelegramFormData>({
  username: '',
  first_name: '',
  last_name: '',
  description: '',
  is_primary: false
})

watch(() => props.modelValue, (val) => {
  isOpen.value = val
  if (val) {
    if (props.initialData) {
      formData.username = props.initialData.username
      formData.first_name = props.initialData.first_name
      formData.last_name = props.initialData.last_name
      formData.description = props.initialData.description
      formData.is_primary = props.initialData.is_primary
    } else {
      formData.username = ''
      formData.first_name = ''
      formData.last_name = ''
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
