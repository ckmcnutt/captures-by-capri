import { useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import {
  useGetBookingStats,
  useListBookings,
  useListRecentBookings,
  useApproveBooking,
  useDeclineBooking,
  getGetBookingStatsQueryKey,
  getListBookingsQueryKey,
  getListRecentBookingsQueryKey,
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
import { Camera, Clock, CheckCircle, XCircle, CalendarDays, ArrowRight } from "lucide-react";

type BookingStatus = "pending" | "approved" | "declined";

const STATUS_TABS: { label: string; value: BookingStatus | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "Approved", value: "approved" },
  { label: "Declined", value: "declined" },
];

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    approved: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    declined: "bg-red-500/20 text-red-400 border-red-500/30",
  };
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 text-xs tracking-wider uppercase border ${colors[status] ?? "bg-muted text-muted-foreground border-border"}`}
      data-testid={`status-badge-${status}`}
    >
      {status}
    </span>
  );
}

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<BookingStatus | "all">("all");
  const [declineBookingId, setDeclineBookingId] = useState<number | null>(null);
  const [declineReason, setDeclineReason] = useState("");

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: stats, isLoading: statsLoading } = useGetBookingStats({
    query: { queryKey: getGetBookingStatsQueryKey() },
  });

  const { data: recentBookings } = useListRecentBookings({
    query: { queryKey: getListRecentBookingsQueryKey() },
  });

  const { data: bookings, isLoading: bookingsLoading } = useListBookings(
    activeTab === "all" ? {} : { status: activeTab },
    { query: { queryKey: getListBookingsQueryKey(activeTab === "all" ? {} : { status: activeTab }) } }
  );

  const approveBooking = useApproveBooking();
  const declineBooking = useDeclineBooking();

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: getGetBookingStatsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListBookingsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListRecentBookingsQueryKey() });
  };

  const handleApprove = (id: number) => {
    approveBooking.mutate(
      { id },
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
    if (!declineBookingId) return;
    declineBooking.mutate(
      { id: declineBookingId, data: { reason: declineReason || undefined } },
      {
        onSuccess: () => {
          toast({ title: "Booking declined", description: "Client has been notified via SMS." });
          setDeclineBookingId(null);
          setDeclineReason("");
          invalidateAll();
        },
        onError: () => {
          toast({ title: "Error", description: "Could not decline booking.", variant: "destructive" });
        },
      }
    );
  };

  const statCards = [
    { label: "Total Requests", value: stats?.total ?? 0, icon: Camera },
    { label: "Pending Review", value: stats?.pending ?? 0, icon: Clock },
    { label: "Approved", value: stats?.approved ?? 0, icon: CheckCircle },
    { label: "This Month", value: stats?.thisMonth ?? 0, icon: CalendarDays },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Admin Header */}
      <header className="border-b border-border px-8 py-5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-muted-foreground text-xs tracking-widest uppercase hover:text-foreground transition-colors" data-testid="link-home">
            Captures By Capri
          </Link>
          <span className="text-border">/</span>
          <span className="text-xs tracking-widest uppercase">Admin</span>
        </div>
        <div className="flex items-center gap-6">
          <Link href="/" className="text-xs tracking-widest uppercase text-muted-foreground hover:text-foreground transition-colors" data-testid="link-view-site">
            View Site
          </Link>
        </div>
      </header>

      <main className="px-8 py-12 max-w-7xl mx-auto">
        {/* Page title */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-12"
        >
          <h1 className="text-4xl font-serif mb-2">Booking Dashboard</h1>
          <p className="text-muted-foreground text-sm">Manage your photoshoot requests and client communications.</p>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
          {statCards.map((card, i) => (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className="border border-border p-6 bg-card"
              data-testid={`stat-card-${card.label.toLowerCase().replace(/\s+/g, "-")}`}
            >
              {statsLoading ? (
                <div className="space-y-2 animate-pulse">
                  <div className="h-4 bg-muted rounded w-3/4" />
                  <div className="h-8 bg-muted rounded w-1/2" />
                </div>
              ) : (
                <>
                  <card.icon className="w-4 h-4 text-muted-foreground mb-4" />
                  <p className="text-3xl font-serif">{card.value}</p>
                  <p className="text-xs tracking-wider uppercase text-muted-foreground mt-1">{card.label}</p>
                </>
              )}
            </motion.div>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Bookings Table */}
          <div className="lg:col-span-2">
            {/* Tabs */}
            <div className="flex gap-0 border-b border-border mb-6">
              {STATUS_TABS.map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => setActiveTab(tab.value)}
                  className={`px-5 py-3 text-xs tracking-widest uppercase border-b-2 transition-colors ${
                    activeTab === tab.value
                      ? "border-primary text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                  data-testid={`tab-${tab.value}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {bookingsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-20 bg-card border border-border animate-pulse" />
                ))}
              </div>
            ) : !bookings?.length ? (
              <div className="border border-border p-16 text-center">
                <Camera className="w-8 h-8 mx-auto text-muted-foreground mb-4 opacity-40" />
                <p className="text-muted-foreground text-sm">No bookings in this category.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {bookings.map((booking) => (
                  <motion.div
                    key={booking.id}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="border border-border bg-card p-5 flex items-center justify-between gap-4 group hover:border-primary/50 transition-colors"
                    data-testid={`booking-row-${booking.id}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <p className="font-medium truncate">{booking.clientName}</p>
                        <StatusBadge status={booking.status} />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {booking.sessionType} · {booking.preferredDate} · {booking.clientEmail}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {booking.status === "pending" && (
                        <>
                          <button
                            onClick={() => handleApprove(booking.id)}
                            disabled={approveBooking.isPending}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs tracking-wider uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
                            data-testid={`button-approve-${booking.id}`}
                          >
                            <CheckCircle className="w-3 h-3" />
                            Approve
                          </button>
                          <button
                            onClick={() => { setDeclineBookingId(booking.id); setDeclineReason(""); }}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs tracking-wider uppercase bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 transition-colors"
                            data-testid={`button-decline-${booking.id}`}
                          >
                            <XCircle className="w-3 h-3" />
                            Decline
                          </button>
                        </>
                      )}
                      <Link
                        href={`/admin/bookings/${booking.id}`}
                        className="p-1.5 text-muted-foreground hover:text-foreground transition-colors opacity-0 group-hover:opacity-100"
                        data-testid={`link-booking-detail-${booking.id}`}
                      >
                        <ArrowRight className="w-4 h-4" />
                      </Link>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Activity */}
          <div>
            <h3 className="text-xs tracking-[0.3em] uppercase text-muted-foreground mb-6">Recent Activity</h3>
            <div className="space-y-3">
              {recentBookings?.slice(0, 8).map((booking) => (
                <Link
                  key={booking.id}
                  href={`/admin/bookings/${booking.id}`}
                  className="block border border-border bg-card p-4 hover:border-primary/50 transition-colors"
                  data-testid={`activity-booking-${booking.id}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">{booking.clientName}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{booking.sessionType}</p>
                    </div>
                    <StatusBadge status={booking.status} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {new Date(booking.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* Decline Modal */}
      <Dialog open={declineBookingId !== null} onOpenChange={(open) => !open && setDeclineBookingId(null)}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl">Decline Booking</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">
            The client will receive an SMS notification. You can optionally include a reason below.
          </p>
          <Textarea
            placeholder="Optional: reason for declining..."
            value={declineReason}
            onChange={(e) => setDeclineReason(e.target.value)}
            rows={3}
            className="bg-transparent border-border resize-none"
            data-testid="textarea-decline-reason"
          />
          <DialogFooter className="gap-2">
            <button
              onClick={() => setDeclineBookingId(null)}
              className="px-6 py-2.5 text-xs tracking-widest uppercase border border-border hover:bg-secondary transition-colors"
              data-testid="button-cancel-decline"
            >
              Cancel
            </button>
            <button
              onClick={handleDeclineConfirm}
              disabled={declineBooking.isPending}
              className="px-6 py-2.5 text-xs tracking-widest uppercase bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 transition-colors disabled:opacity-50"
              data-testid="button-confirm-decline"
            >
              {declineBooking.isPending ? "Declining..." : "Confirm Decline"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
