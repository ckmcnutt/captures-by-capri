import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import { useCreateBooking } from "@workspace/api-client-react";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { CheckCircle } from "lucide-react";

const bookingSchema = z.object({
  clientName: z.string().min(2, "Name is required"),
  clientEmail: z.string().email("Valid email required"),
  clientPhone: z.string().min(7, "Phone number required"),
  sessionType: z.string().min(1, "Session type required"),
  preferredDate: z.string().min(1, "Preferred date required"),
  preferredTime: z.string().optional(),
  message: z.string().optional(),
});

type BookingFormValues = z.infer<typeof bookingSchema>;

const SESSION_TYPES = [
  "Portrait",
  "Engagement",
  "Wedding",
  "Maternity",
  "Family",
  "Brand",
];

export default function Book() {
  const [submitted, setSubmitted] = useState(false);
  const createBooking = useCreateBooking();
  const { toast } = useToast();

  const form = useForm<BookingFormValues>({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      clientName: "",
      clientEmail: "",
      clientPhone: "",
      sessionType: "",
      preferredDate: "",
      preferredTime: "",
      message: "",
    },
  });

  const onSubmit = (values: BookingFormValues) => {
    createBooking.mutate(
      {
        data: {
          clientName: values.clientName,
          clientEmail: values.clientEmail,
          clientPhone: values.clientPhone,
          sessionType: values.sessionType,
          preferredDate: values.preferredDate,
          preferredTime: values.preferredTime,
          message: values.message,
        },
      },
      {
        onSuccess: () => {
          setSubmitted(true);
        },
        onError: () => {
          toast({
            title: "Something went wrong",
            description: "Please try again or contact us directly.",
            variant: "destructive",
          });
        },
      }
    );
  };

  return (
    <div className="min-h-screen pt-24 pb-32">
      {/* Page header */}
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
            Fill out the form below and I'll be in touch within 48 hours. You'll also receive an SMS confirmation once your session is reviewed and approved.
          </p>
        </motion.div>
      </section>

      <div className="container mx-auto px-6 max-w-7xl py-24">
        <div className="grid lg:grid-cols-2 gap-24 items-start">

          {/* Booking Form */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            {submitted ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6 }}
                className="text-center space-y-6 py-16"
              >
                <CheckCircle className="w-16 h-16 mx-auto text-primary opacity-80" />
                <h2 className="text-4xl font-serif">Request Received</h2>
                <p className="text-muted-foreground text-lg leading-relaxed max-w-md mx-auto">
                  Thank you for reaching out. I'll review your request and be in touch within 48 hours. You'll receive an SMS notification once your session is confirmed.
                </p>
                <button
                  onClick={() => { setSubmitted(false); form.reset(); }}
                  className="text-sm tracking-widest uppercase border-b border-foreground pb-1 hover:text-primary hover:border-primary transition-colors"
                  data-testid="button-submit-another"
                >
                  Submit Another Request
                </button>
              </motion.div>
            ) : (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8" data-testid="form-booking">
                  <h2 className="text-2xl font-serif mb-8">Inquiry Form</h2>

                  <div className="grid sm:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="clientName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs tracking-widest uppercase text-muted-foreground">Full Name</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Your name"
                              {...field}
                              className="border-0 border-b border-border rounded-none bg-transparent focus-visible:ring-0 focus-visible:border-primary px-0 py-3 text-foreground placeholder:text-muted-foreground/50"
                              data-testid="input-client-name"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="clientEmail"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs tracking-widest uppercase text-muted-foreground">Email</FormLabel>
                          <FormControl>
                            <Input
                              type="email"
                              placeholder="your@email.com"
                              {...field}
                              className="border-0 border-b border-border rounded-none bg-transparent focus-visible:ring-0 focus-visible:border-primary px-0 py-3 text-foreground placeholder:text-muted-foreground/50"
                              data-testid="input-client-email"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid sm:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="clientPhone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs tracking-widest uppercase text-muted-foreground">Phone Number</FormLabel>
                          <FormControl>
                            <Input
                              type="tel"
                              placeholder="+1 (555) 000-0000"
                              {...field}
                              className="border-0 border-b border-border rounded-none bg-transparent focus-visible:ring-0 focus-visible:border-primary px-0 py-3 text-foreground placeholder:text-muted-foreground/50"
                              data-testid="input-client-phone"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="sessionType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs tracking-widest uppercase text-muted-foreground">Session Type</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger
                                className="border-0 border-b border-border rounded-none bg-transparent focus:ring-0 px-0 py-3 h-auto text-foreground"
                                data-testid="select-session-type"
                              >
                                <SelectValue placeholder="Select type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {SESSION_TYPES.map((type) => (
                                <SelectItem key={type} value={type} data-testid={`select-session-${type.toLowerCase()}`}>
                                  {type}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid sm:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="preferredDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs tracking-widest uppercase text-muted-foreground">Preferred Date</FormLabel>
                          <FormControl>
                            <Input
                              type="date"
                              {...field}
                              className="border-0 border-b border-border rounded-none bg-transparent focus-visible:ring-0 focus-visible:border-primary px-0 py-3 text-foreground"
                              data-testid="input-preferred-date"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="preferredTime"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs tracking-widest uppercase text-muted-foreground">Preferred Time (optional)</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="e.g. Golden hour, Morning"
                              {...field}
                              className="border-0 border-b border-border rounded-none bg-transparent focus-visible:ring-0 focus-visible:border-primary px-0 py-3 text-foreground placeholder:text-muted-foreground/50"
                              data-testid="input-preferred-time"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="message"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs tracking-widest uppercase text-muted-foreground">Tell me about your vision (optional)</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Share your ideas, inspiration, location preferences..."
                            rows={4}
                            {...field}
                            className="border-0 border-b border-border rounded-none bg-transparent focus-visible:ring-0 focus-visible:border-primary px-0 py-3 text-foreground placeholder:text-muted-foreground/50 resize-none"
                            data-testid="textarea-message"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="pt-4">
                    <button
                      type="submit"
                      disabled={createBooking.isPending}
                      className="w-full bg-primary text-primary-foreground py-4 text-sm tracking-widest uppercase hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      data-testid="button-submit-booking"
                    >
                      {createBooking.isPending ? "Sending..." : "Send Inquiry"}
                    </button>
                  </div>
                </form>
              </Form>
            )}
          </motion.div>

          {/* Cal.com Embed */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="space-y-8"
          >
            <div>
              <p className="text-xs tracking-[0.3em] text-muted-foreground uppercase mb-4">Or Schedule Directly</p>
              <h2 className="text-2xl font-serif mb-2">Book via Cal.com</h2>
              <p className="text-muted-foreground text-sm">
                Prefer to pick a time directly? Use the scheduler below to book a discovery call or shoot.
              </p>
            </div>

            <div className="border border-border overflow-hidden bg-card" data-testid="calcom-embed">
              <iframe
                src={__CAL_URL__}
                width="100%"
                height="600"
                frameBorder="0"
                title="Book a session with Capri"
                className="w-full"
              />
            </div>

            <div className="border-t border-border pt-8 space-y-4">
              <p className="text-xs tracking-[0.3em] text-muted-foreground uppercase">What to Expect</p>
              <ul className="space-y-3 text-sm text-muted-foreground">
                {[
                  "You'll receive an SMS once your request is reviewed",
                  "Sessions are confirmed within 48 hours",
                  "A detailed questionnaire follows approval",
                  "Full gallery delivered within 2-3 weeks",
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="text-primary mt-0.5">—</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
