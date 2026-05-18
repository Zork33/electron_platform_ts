export interface BaseRecord {
  id: number
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface Person extends BaseRecord {
  first_name: string
  last_name: string | null
  middle_name: string | null
  birth_date: string | null
  description: string | null
  gender_id: number | null
  vector_db_record_id: number | null
  is_vector_synced: boolean
}

export interface User extends BaseRecord {
  person_id: number | null
  auth_email: string | null
  has_access: boolean
  is_admin: boolean
  session_expires_at: string | null
  auth_session_expires_at?: string | null
  avatar_id: number | null
  auth_telegram_id: string | null
}

export interface ContactInfo extends BaseRecord {
  person_id: number | null
  phone_number_id: number | null
  tg_acc_id: number | null
  email_id: number | null
  web_link_id: number | null
  description: string | null
  is_primary: boolean
}

export interface PhoneNumber extends BaseRecord {
  phone_pattern_id: number | null
  number: string | null
  full_number: string | null
}

export interface Email extends BaseRecord {
  address: string
}

export interface TgAcc extends BaseRecord {
  user_id: number | null
  username: string | null
  first_name: string | null
  last_name: string | null
  phone_number_id: number | null
}

export interface WebLink extends BaseRecord {
  title: string | null
  type_id: number
  custom_type_name: string | null
  url: string
  description: string | null
}

export interface LoungeEvent extends BaseRecord {
  title: string
  description: string | null
  event_type_id: number
  location_id: number
  starts_at: string | null
  ends_at: string | null
  report_gallery_ids: number[]
}

export interface FilePart {
  name: string
  is_public: boolean
}

export interface StoredFileMetadata extends BaseRecord {
  object_key: string
  file_storage_part_id: number
  storage_part_name: string
  path: string
  filename: string
  ext: string
  size_bytes: number
  content_type: string | null
  last_modified: string | null
  etag: string | null
}

export interface StoredFileRecord extends StoredFileMetadata {
  content: Buffer
}

export interface ConfirmationTokenRecord {
  token: string
  kind: 'login' | 'register'
  auth_email: string
  user_id?: number | null
  first_name?: string | null
  last_name?: string | null
  middle_name?: string | null
  reason_id?: number | null
  confirm_code: string
  expires_at: string
  sending_at?: string | null
  is_sent: boolean
  sending_attempts_count: number
  sending_error: string | null
  verification_at?: string | null
  is_verified: boolean
  verification_attempts_count: number
  verification_error: string | null
  user_creation_at?: string | null
  is_user_created?: boolean
  user_creation_error?: string | null
  access_token_created_at?: string | null
  is_access_token_created?: boolean
  access_token_error?: string | null
  history: ConfirmationHistoryEntry[]
}

export interface ConfirmationHistoryEntry {
  action: 'create' | 'send' | 'verify' | 'user_creation' | 'access_token_creation'
  timestamp: string
  ok: boolean
  error_message: string | null
}

export interface AccessTokenRecord {
  token: string
  user_id: number
  expires_at: string
}

export interface WsConnectionInfo {
  conn_id: number
  user_id: number
  connected_at: string | null
  client_ip: string | null
  user_agent: string | null
  last_ping_at: string | null
  last_pong_at: string | null
}

export interface PersistedWsConnectionInfo extends WsConnectionInfo {}

export interface CurrentUserResponse {
  user_id: number
  auth_email: string | null
  auth_telegram_id?: string | null
  has_access: boolean
  auth_session_expires_at: string | null
  is_admin: boolean
  person: {
    person_id: number
    first_name: string
    last_name?: string | null
    middle_name?: string | null
    birth_date?: string | null
  } | null
}

export interface AuthStartResponse {
  confirmation_token: string
  expires_at: string
}

export interface AuthFinishResponse {
  access_token: string
  expires_at: string
  session_expires_days: number
  user_id: number
  person_id: number | null
}
