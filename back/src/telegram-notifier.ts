export interface TelegramNotifier {
  sendMessage(chatId: string, text: string): Promise<boolean>
}

export class NoopTelegramNotifier implements TelegramNotifier {
  async sendMessage(): Promise<boolean> {
    return true
  }
}

export interface TelegramBotApiConfig {
  botToken: string
  apiUrl?: string
}

export class TelegramBotApiNotifier implements TelegramNotifier {
  private readonly apiUrl: string

  constructor(private readonly config: TelegramBotApiConfig) {
    this.apiUrl = config.apiUrl ?? 'https://api.telegram.org'
  }

  async sendMessage(chatId: string, text: string): Promise<boolean> {
    const response = await fetch(`${this.apiUrl}/bot${this.config.botToken}/sendMessage`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text,
      }),
    })
    return response.ok
  }
}
