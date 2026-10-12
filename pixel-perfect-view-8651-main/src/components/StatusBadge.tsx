import type { ApplicationStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const styles: Record<ApplicationStatus, string> = {
  Applied: "bg-status-applied/12 text-status-applied border-status-applied/25",
  Assessment: "bg-status-assessment/12 text-status-assessment border-status-assessment/25",
  Interview: "bg-status-interview/12 text-status-interview border-status-interview/25",
  Offer: "bg-status-offer/12 text-status-offer border-status-offer/25",
  Rejected: "bg-status-rejected/12 text-status-rejected border-status-rejected/25",
  Withdrawn: "bg-status-withdrawn/12 text-status-withdrawn border-status-withdrawn/25",
};

export function StatusBadge({ status, className }: { status: ApplicationStatus; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap", styles[status], className)}>
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />{status}
    </span>
  );
}
