import nodemailer, { type Transporter } from 'nodemailer';

import { env } from './env';
import { logger } from './logger';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

let transporter: Transporter | null = null;

/** No SMTP_HOST configured (the default in dev) — logging the message is the dev-mode delivery
 * channel, matching the pre-Phase-6 placeholder this replaces in auth/users services. */
function isSmtpConfigured(): boolean {
  return Boolean(env.SMTP_HOST);
}

function getTransporter(): Transporter {
  transporter ??= nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
  });
  return transporter;
}

export async function sendMail(message: MailMessage): Promise<void> {
  if (!isSmtpConfigured()) {
    logger.info('SMTP not configured — logging email instead of sending', {
      to: message.to,
      subject: message.subject,
      text: message.text,
    });
    return;
  }

  await getTransporter().sendMail({
    from: env.SMTP_FROM,
    to: message.to,
    subject: message.subject,
    text: message.text,
    html: message.html,
  });
}
