import { motion } from "framer-motion";

const EFFECTIVE_DATE = "June 21, 2025";
const BUSINESS_NAME = "Captures By Capri";
const CONTACT_EMAIL = "madison@capturesbycapri.com";

export default function Terms() {
  return (
    <div className="min-h-screen pt-24">
      <section className="py-20 px-6 text-center border-b border-border">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="max-w-2xl mx-auto space-y-4"
        >
          <p className="text-xs tracking-[0.3em] text-muted-foreground uppercase">Legal</p>
          <h1 className="text-5xl md:text-6xl font-serif">Terms of Service</h1>
          <p className="text-muted-foreground text-sm">Effective Date: {EFFECTIVE_DATE}</p>
        </motion.div>
      </section>

      <div className="container mx-auto px-6 max-w-3xl py-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="space-y-10 text-muted-foreground"
        >
          <Section title="1. Acceptance of Terms">
            <p>
              By booking a photography session with {BUSINESS_NAME} ("we," "us," or "our"), you agree to these Terms
              of Service. Please read them carefully before completing your booking.
            </p>
          </Section>

          <Section title="2. Services">
            <p>
              {BUSINESS_NAME} provides professional photography services including portrait, couples, engagement,
              family, maternity, brand, and other session types. All sessions are subject to availability and
              must be booked through our scheduling system.
            </p>
          </Section>

          <Section title="3. Booking &amp; Deposits">
            <ul>
              <li>A <strong>$20 non-refundable deposit</strong> is required to secure your booking. This deposit is applied toward your total session fee.</li>
              <li>The deposit is <strong>refundable only if you cancel at least 7 days (1 week) before</strong> your scheduled session.</li>
              <li>Cancellations made within 7 days of the session forfeit the deposit.</li>
              <li>The remaining session balance is due <strong>1 day prior to your appointment</strong>.</li>
            </ul>
          </Section>

          <Section title="4. Session Pricing">
            <ul>
              <li><strong>30-minute session — $75</strong>: includes 10–15 professionally edited photos.</li>
              <li><strong>60-minute session — $150</strong>: includes 20–30 professionally edited photos.</li>
              <li>Sessions located more than 45 minutes from Cullman, AL may be subject to a <strong>travel fee</strong>, communicated prior to booking confirmation.</li>
            </ul>
          </Section>

          <Section title="5. Rescheduling">
            <p>
              Rescheduling requests must be made at least 48 hours before your session. We will make reasonable
              efforts to accommodate rescheduling based on availability. Rescheduling does not forfeit your deposit.
            </p>
          </Section>

          <Section title="6. SMS Communications">
            <p>
              By providing your phone number during booking and selecting SMS as your preferred contact method,
              you expressly consent to receive text messages from {BUSINESS_NAME} related to your appointment.
              These messages include appointment confirmations, deposit and payment requests, reminders,
              and photo delivery notifications.
            </p>
            <ul>
              <li><strong>Message frequency:</strong> Transactional messages only, sent in relation to your active appointment.</li>
              <li><strong>Message &amp; data rates may apply.</strong></li>
              <li><strong>To opt out:</strong> Reply <strong>STOP</strong> at any time. You will receive one confirmation message, after which no further SMS messages will be sent.</li>
              <li><strong>To get help:</strong> Reply <strong>HELP</strong> or email {CONTACT_EMAIL}.</li>
              <li>We do not send promotional or marketing text messages.</li>
              <li>We will never sell or share your phone number with third parties for marketing purposes.</li>
            </ul>
          </Section>

          <Section title="7. Payments">
            <p>
              Payments are processed securely through Stripe. By submitting a payment, you authorize {BUSINESS_NAME}
              to charge the amount due for your deposit or session fee. All prices are in USD.
            </p>
          </Section>

          <Section title="8. Photo Delivery">
            <p>
              Edited photos are delivered digitally via a link shared by email or SMS after your session.
              Typical turnaround time will be communicated at the time of booking. {BUSINESS_NAME} retains the
              right to use session photographs for portfolio and promotional purposes unless you explicitly
              request otherwise in writing before your session.
            </p>
          </Section>

          <Section title="9. Intellectual Property">
            <p>
              All photographs taken by {BUSINESS_NAME} remain the intellectual property of {BUSINESS_NAME}.
              You are granted a personal-use license to print, share, and display the delivered images.
              Commercial use requires written permission and may be subject to additional fees.
            </p>
          </Section>

          <Section title="10. Limitation of Liability">
            <p>
              {BUSINESS_NAME} is not liable for circumstances beyond our control (weather, illness, equipment
              failure) that require rescheduling. In the unlikely event we must cancel a session, your deposit
              will be fully refunded or applied to a rescheduled date at your preference.
            </p>
          </Section>

          <Section title="11. Changes to These Terms">
            <p>
              We may update these Terms of Service from time to time. The effective date above reflects the
              most recent revision. Continued use of our services after any changes constitutes your acceptance
              of the updated terms.
            </p>
          </Section>

          <Section title="12. Contact Us">
            <p>
              Questions about these terms? Reach us at:
            </p>
            <p>
              <strong>{BUSINESS_NAME}</strong><br />
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-foreground underline underline-offset-4 hover:text-primary transition-colors">{CONTACT_EMAIL}</a>
            </p>
          </Section>
        </motion.div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h2 className="text-foreground text-base font-medium tracking-wide">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed [&_ul]:space-y-2 [&_ul]:list-none [&_ul]:pl-0 [&_li]:flex [&_li]:gap-2 [&_li]:before:content-['—'] [&_li]:before:text-primary/60 [&_li]:before:shrink-0">
        {children}
      </div>
    </div>
  );
}
