import { motion } from "framer-motion";

const EFFECTIVE_DATE = "June 21, 2025";
const BUSINESS_NAME = "Captures By Capri";
const CONTACT_EMAIL = "madison@capturesbycapri.com";
const WEBSITE = "capturesbycapri.com";

export default function Privacy() {
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
          <h1 className="text-5xl md:text-6xl font-serif">Privacy Policy</h1>
          <p className="text-muted-foreground text-sm">Effective Date: {EFFECTIVE_DATE}</p>
        </motion.div>
      </section>

      <div className="container mx-auto px-6 max-w-3xl py-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="prose prose-invert prose-sm max-w-none space-y-10 text-muted-foreground"
        >
          <Section title="1. Who We Are">
            <p>
              {BUSINESS_NAME} ("we," "us," or "our") is a photography business operating at{" "}
              <a href={`https://${WEBSITE}`} className="text-foreground underline underline-offset-4 hover:text-primary transition-colors">{WEBSITE}</a>.
              We are committed to protecting the personal information you share with us when booking a session or contacting us.
            </p>
          </Section>

          <Section title="2. Information We Collect">
            <p>When you book a session or contact us, we may collect:</p>
            <ul>
              <li><strong>Contact information</strong> — your name, email address, and phone number.</li>
              <li><strong>Appointment details</strong> — your preferred session date, time, location, and session type.</li>
              <li><strong>Payment information</strong> — processed securely through Stripe. We do not store full card numbers.</li>
              <li><strong>Communications</strong> — messages you send us via email, SMS, or our booking form.</li>
            </ul>
          </Section>

          <Section title="3. How We Use Your Information">
            <p>We use your information to:</p>
            <ul>
              <li>Schedule, confirm, and manage your photography sessions.</li>
              <li>Send appointment reminders, deposit requests, and invoices.</li>
              <li>Communicate with you about your session via your preferred contact method (email or SMS).</li>
              <li>Deliver your edited photos and related links.</li>
              <li>Process payments for deposits and session fees.</li>
              <li>Respond to questions and support requests.</li>
            </ul>
          </Section>

          <Section title="4. SMS Messaging">
            <p>
              By providing your phone number and selecting SMS as your preferred contact method, you consent to receive
              text messages from {BUSINESS_NAME} related to your booking. These messages may include appointment
              confirmations, deposit requests, payment reminders, and photo delivery notifications.
            </p>
            <ul>
              <li><strong>Message frequency:</strong> Messages are sent only in relation to your active appointment. You will not receive promotional or marketing texts.</li>
              <li><strong>Message &amp; data rates may apply.</strong></li>
              <li><strong>To opt out:</strong> Reply <strong>STOP</strong> to any SMS message at any time. You will receive one confirmation message and no further texts will be sent.</li>
              <li><strong>To get help:</strong> Reply <strong>HELP</strong> for assistance or email us at {CONTACT_EMAIL}.</li>
              <li>We will never sell or share your phone number with third parties for marketing purposes.</li>
            </ul>
          </Section>

          <Section title="5. How We Share Your Information">
            <p>We do not sell your personal information. We may share it only with:</p>
            <ul>
              <li><strong>Stripe</strong> — to process deposits and payments securely.</li>
              <li><strong>Cal.com</strong> — to manage appointment scheduling.</li>
              <li><strong>Your mobile carrier</strong> — SMS notifications you have consented to receive are delivered via your carrier's email-to-text gateway using the phone number you provide.</li>
              <li><strong>Abstract API</strong> — to identify your mobile carrier so text notifications can be routed correctly.</li>
              <li><strong>Resend</strong> — to deliver transactional emails.</li>
              <li><strong>Supabase</strong> — our secure database provider for storing appointment records.</li>
            </ul>
            <p>
              Each of these service providers is bound by their own privacy policies and industry-standard data protection
              practices. We do not authorize them to use your data for any purpose other than providing services to us.
            </p>
          </Section>

          <Section title="6. Data Retention">
            <p>
              We retain your information for as long as necessary to fulfill the purposes described in this policy
              or as required by law. If you would like your data deleted, please contact us at {CONTACT_EMAIL}.
            </p>
          </Section>

          <Section title="7. Security">
            <p>
              We take reasonable technical and organizational measures to protect your information from unauthorized
              access, disclosure, or loss. However, no transmission over the internet is completely secure.
            </p>
          </Section>

          <Section title="8. Your Rights">
            <p>You may contact us at any time to:</p>
            <ul>
              <li>Request access to the personal information we hold about you.</li>
              <li>Request correction or deletion of your information.</li>
              <li>Withdraw consent for SMS communications.</li>
            </ul>
            <p>To exercise any of these rights, email us at {CONTACT_EMAIL}.</p>
          </Section>

          <Section title="9. Children's Privacy">
            <p>
              Our services are not directed to children under the age of 13. We do not knowingly collect personal
              information from children. If you believe we have inadvertently collected such information, please
              contact us immediately.
            </p>
          </Section>

          <Section title="10. Changes to This Policy">
            <p>
              We may update this Privacy Policy from time to time. The effective date at the top of this page
              will reflect the most recent revision. Continued use of our services after any changes constitutes
              your acceptance of the updated policy.
            </p>
          </Section>

          <Section title="11. Contact Us">
            <p>
              If you have questions about this Privacy Policy or how we handle your data, please contact us at:
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
