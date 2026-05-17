export interface EmailSender {
  sendHtmlEmail(to: string[], subject: string, htmlBody: string): Promise<boolean>
}

export class NoopEmailSender implements EmailSender {
  async sendHtmlEmail(): Promise<boolean> {
    return true
  }
}

export interface SmtpEmailSenderConfig {
  host: string
  port: number
  secure: boolean
  authUser?: string
  authPass?: string
  fromEmail: string
}

export class SmtpEmailSender implements EmailSender {
  constructor(private readonly config: SmtpEmailSenderConfig) {}

  async sendHtmlEmail(to: string[], subject: string, htmlBody: string): Promise<boolean> {
    const nodemailer = await import('nodemailer')
    const transport = nodemailer.createTransport({
      host: this.config.host,
      port: this.config.port,
      secure: this.config.secure,
      auth: this.config.authUser && this.config.authPass ? { user: this.config.authUser, pass: this.config.authPass } : undefined,
    })
    await transport.sendMail({
      from: this.config.fromEmail,
      to: to.join(', '),
      subject,
      html: htmlBody,
    })
    return true
  }
}
