import { motion } from "framer-motion";

export default function Book() {
  return (
    <div className="min-h-screen pt-24">
      <section className="py-20 px-6 text-center border-b border-border">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="max-w-2xl mx-auto space-y-4"
        >
          <p className="text-xs tracking-[0.3em] text-muted-foreground uppercase">Book a Session</p>
          <h1 className="text-5xl md:text-6xl font-serif">Let's Create Together</h1>
          <p className="text-muted-foreground text-lg leading-relaxed">
            Scroll down to choose a time that works for you. Sessions are booked through Cal.com.
          </p>
        </motion.div>
      </section>

      <div className="container mx-auto px-6 max-w-6xl py-24">
        <div className="grid lg:grid-cols-2 gap-16 items-start">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="space-y-10"
          >
            <div className="space-y-4">
              <p className="text-xs tracking-[0.3em] text-muted-foreground uppercase">What to Expect</p>
              <ul className="space-y-4 text-sm text-muted-foreground">
                {[
                  "Pick any available slot - no back and forth",
                  "$20 deposit required at booking - refundable if canceled at least 1 week prior",
                  "Remainder of balance due 1 day prior to appointment",
                  "A followup email or text with additional questions",
                  "10-15 edited photos for a 30 minute session - $75",
                  "20-30 edited photos for a 1 hour session - $150",
                  "For sessions located over 45 minutes away from Cullman AL, a travel fee may be applied",
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="text-primary mt-0.5 shrink-0">—</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="border-t border-border pt-8 space-y-3">
              <p className="text-xs tracking-[0.3em] text-muted-foreground uppercase">Sessions</p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {["Brand", "Couples", "Engagement", "Family", "Maternity", "Portrait", "Other"].map((type) => (
                  <li key={type} className="flex items-center gap-2">
                    <span className="w-1 h-1 rounded-full bg-primary/60 shrink-0" />
                    {type}
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
          >
            <div className="border border-border overflow-hidden bg-card" data-testid="calcom-embed">
              <iframe
                src={__CAL_URL__}
                width="100%"
                height="700px"
                frameBorder="0"
                title="Book a session with Capri"
                className="w-full"
              />
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
