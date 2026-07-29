import nodemailer, { type Transporter } from "nodemailer";
import { env } from "../env";
import { logger } from "./logger";

/**
 * Sends client email over SMTP through an existing mailbox, rather than a
 * dedicated transactional-email API (previously Resend).
 *
 * Resend's domain verification required a domain-wide MX record, which
 * overrides whatever MX the domain's other mailboxes rely on for inbound
 * mail — that's what broke madison@capturesbycapri.com. Authenticating as an
 * existing mailbox over SMTP only sends outbound mail; it never touches the
 * MX record, so every other mailbox on the domain is unaffected.
 */
let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASSWORD) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
    });
  }
  return transporter;
}

/**
 * Swallows failures rather than throwing, same as the Resend implementation
 * it replaces — a broken mail transport shouldn't roll back whatever
 * database change already committed. This is also the transport behind
 * carrier-gateway texts (see services/notifications.ts), so it degrades the
 * same way for those too.
 */
export async function sendEmail(to: string, subject: string, text: string): Promise<void> {
  const transport = getTransporter();
  if (!transport) {
    logger.warn({ to, subject }, "SMTP is not configured — email not sent");
    return;
  }

  try {
    await transport.sendMail({
      from: env.SMTP_FROM || env.SMTP_USER,
      to,
      subject,
      text,
    });
    logger.info({ to, subject }, "Email sent via SMTP");
  } catch (err) {
    logger.warn({ to, subject, err }, "SMTP send failed — notification not delivered");
  }
}
