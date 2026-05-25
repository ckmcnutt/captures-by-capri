import { useState } from "react";
import { Link, useParams } from "wouter";
import { motion } from "framer-motion";
import {
  useGetBooking,
  useApproveBooking,
  useDeclineBooking,
  getGetBookingQueryKey,
  getListBookingsQueryKey,
  getGetBookingStatsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, CheckCircle, XCircle, Phone, Mail, Calendar, Clock, MessageSquare, Camera } from "lucide-react";

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    approved: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    declined: "bg-red-500/20 text-red-400 border-red-500/30",
  };
  return (
    <span className={`inline-flex items-center px-3 py-1 text-xs tracking-wider uppercase border ${colors[status] ?? "bg-muted text-muted-foreground border-border"}`}>
      {status}
    </span>
  );
}

function DetailRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-4 py-4 border-b border-border last:border-0">
      <Icon className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
      <div>
        <p className="text-xs tracking-widest uppercase text-muted-foreground mb-0.5">{label}</p>
        <p className="text-foreground">{value}</p>
      </div>
    </div>
  );
}

export default function AdminBookingDetail() {
  const { id } = useParams<{ id: string }>();
  const bookingId = parseInt(id ?? "0", 10);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState("");

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: booking, isLoading } = useGetBooking(bookingId, {
    query: { enabled: !!bookingId, queryKey: getGetBookingQueryKey(bookingId) },
  });

  const approveBooking = useApproveBooking();
  const declineBooking = useDeclineBooking();

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: getGetBookingQueryKey(bookingId) });
    queryClient.invalidateQueries({ queryKey: getListBookingsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetBookingStatsQueryKey() });
  };

  const handleApprove = () => {
    approveBooking.mutate(
      { id: bookingId },
      {
        onSuccess: () => {
          toast({ title: "Booking approved", description: "Client has been notified via SMS." });
          invalidateAll();
        },
        onError: () => {
          toast({ title: "Error", description: "Could not approve booking.", variant: "destructive" });
        },
      }
    );
  };

  const handleDeclineConfirm = () => {
    declineBooking.mutate(
      { id: bookingId, data: { reason: declineReason || undefined } },
      {
        onSuccess: () => {
          toast({ title: "Booking declined", description: "Client has been notified via SMS." });
          setDeclineOpen(false);
          setDeclineReason("");
          invalidateAll();
        },
        onError: () => {
          toast({ title: "Error", description: "Could not decline booking.", variant: "destructive" });
        },
      }
    );
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Admin Header */}
      <header className="border-b border-border px-8 py-5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-muted-foreground text-xs tracking-widest uppercase hover:text-foreground transition-colors">
            Captures By Capri
          </Link>
          <span className="text-border">/</span>
          <Link href="/admin" className="text-muted-foreground text-xs tracking-widest uppercase hover:text-foreground transition-colors">
            Admin
          </Link>
          <span className="text-border">/</span>
          <span className="text-xs tracking-widest uppercase">Booking #{id}</span>
        </div>
      </header>

      <main className="px-8 py-12 max-w-4xl mx-auto">
        <Link href="/admin" className="inline-flex items-center gap-2 text-muted-foreground text-xs tracking-widest uppercase hover:text-foreground transition-colors mb-8" data-testid="link-back-admin">
          <ArrowLeft className="w-3 h-3" />
          Back to Dashboard
        </Link>

        {isLoading ? (
          <div className="space-y-4 animate-pulse">
            <div className="h-12 bg-card border border-border rounded" />
            <div className="h-64 bg-card border border-border rounded" />
          </div>
        ) : !booking ? (
          <div className="border border-border p-16 text-center">
            <Camera className="w-8 h-8 mx-auto text-muted-foreground mb-4 opacity-40" />
            <p className="text-muted-foreground">Booking not found.</p>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="space-y-8"
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-4xl font-serif mb-2">{booking.clientName}</h1>
                <p className="text-muted-foreground text-sm">
                  Request received {new Date(booking.createdAt).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
                </p>
              </div>
              <StatusBadge status={booking.status} />
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Client Info */}
              <div className="border border-border bg-card p-6">
                <h2 className="text-xs tracking-[0.3em] uppercase text-muted-foreground mb-4">Client Information</h2>
                <DetailRow icon={Mail} label="Email" value={booking.clientEmail} />
                <DetailRow icon={Phone} label="Phone" value={booking.clientPhone} />
              </div>

              {/* Session Details */}
              <div className="border border-border bg-card p-6">
                <h2 className="text-xs tracking-[0.3em] uppercase text-muted-foreground mb-4">Session Details</h2>
                <DetailRow icon={Camera} label="Session Type" value={booking.sessionType} />
                <DetailRow icon={Calendar} label="Preferred Date" value={booking.preferredDate} />
                <DetailRow icon={Clock} label="Preferred Time" value={booking.preferredTime} />
              </div>
            </div>

            {/* Message */}
            {booking.message && (
              <div className="border border-border bg-card p-6">
                <h2 className="text-xs tracking-[0.3em] uppercase text-muted-foreground mb-4">Client Message</h2>
                <div className="flex gap-4">
                  <MessageSquare className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                  <p className="text-foreground leading-relaxed">{booking.message}</p>
                </div>
              </div>
            )}

            {/* SMS Status */}
            <div className="border border-border bg-card p-6">
              <h2 className="text-xs tracking-[0.3em] uppercase text-muted-foreground mb-4">Notifications</h2>
              <div className="flex gap-8">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Admin Notified</p>
                  <p className={`text-sm font-medium ${booking.adminNotified ? "text-emerald-400" : "text-amber-400"}`}>
                    {booking.adminNotified ? "SMS Sent" : "Not Sent"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Client Notified</p>
                  <p className={`text-sm font-medium ${booking.smsSent ? "text-emerald-400" : "text-muted-foreground"}`}>
                    {booking.smsSent ? "SMS Sent" : "Pending"}
                  </p>
                </div>
                {booking.calBookingId && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Cal.com ID</p>
                    <p className="text-sm font-mono text-foreground">{booking.calBookingId}</p>
                  </div>
                )}
              </div>
              {booking.declineReason && (
                <div className="mt-4 pt-4 border-t border-border">
                  <p className="text-xs text-muted-foreground mb-1">Decline Reason</p>
                  <p className="text-sm text-red-400">{booking.declineReason}</p>
                </div>
              )}
            </div>

            {/* Actions */}
            {booking.status === "pending" && (
              <div className="flex gap-4 pt-4">
                <button
                  onClick={handleApprove}
                  disabled={approveBooking.isPending}
                  className="flex items-center gap-2 px-8 py-3.5 text-sm tracking-widest uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
                  data-testid="button-approve-booking"
                >
                  <CheckCircle className="w-4 h-4" />
                  {approveBooking.isPending ? "Approving..." : "Approve Booking"}
                </button>
                <button
                  onClick={() => { setDeclineOpen(true); setDeclineReason(""); }}
                  className="flex items-center gap-2 px-8 py-3.5 text-sm tracking-widest uppercase bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 transition-colors"
                  data-testid="button-decline-booking"
                >
                  <XCircle className="w-4 h-4" />
                  Decline Booking
                </button>
              </div>
            )}
          </motion.div>
        )}
      </main>

      {/* Decline Modal */}
      <Dialog open={declineOpen} onOpenChange={setDeclineOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl">Decline Booking</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">
            The client will receive an SMS notification. You can optionally include a reason.
          </p>
          <Textarea
            placeholder="Optional: reason for declining..."
            value={declineReason}
            onChange={(e) => setDeclineReason(e.target.value)}
            rows={3}
            className="bg-transparent border-border resize-none"
            data-testid="textarea-decline-reason-detail"
          />
          <DialogFooter className="gap-2">
            <button
              onClick={() => setDeclineOpen(false)}
              className="px-6 py-2.5 text-xs tracking-widest uppercase border border-border hover:bg-secondary transition-colors"
              data-testid="button-cancel-decline-detail"
            >
              Cancel
            </button>
            <button
              onClick={handleDeclineConfirm}
              disabled={declineBooking.isPending}
              className="px-6 py-2.5 text-xs tracking-widest uppercase bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 transition-colors disabled:opacity-50"
              data-testid="button-confirm-decline-detail"
            >
              {declineBooking.isPending ? "Declining..." : "Confirm Decline"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
