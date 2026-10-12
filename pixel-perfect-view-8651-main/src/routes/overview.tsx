import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { daysUntil, fmtDate, fmtDateTime, relDays } from "@/lib/format";
import { useApplications } from "@/lib/queries";
import { STATUSES } from "@/lib/types";

export const Route = createFileRoute("/overview")({
  head: () => ({
    meta: [
      { title: "Overview — ApplyPilot" },
      { name: "description", content: "Status counts, upcoming interviews, follow-ups due and recent activity." },
      { property: "og:title", content: "Overview — ApplyPilot" },
      { property: "og:description", content: "Status counts, upcoming interviews, follow-ups due and recent activity." },
    ],
  }),
  component: OverviewPage,
});

function OverviewPage() {
  const { data, isLoading, isError, refetch } = useApplications();
  if (isError) return <><PageHeader title="Overview" /><div role="alert">Could not load your overview. <button className="text-primary underline" onClick={() => void refetch()}>Try again</button></div></>;
  if (isLoading || !data) return <><PageHeader title="Overview" /><Skeleton className="h-20 w-full" /><Skeleton className="mt-6 h-64 w-full" /></>;

  const interviews = data.filter((a) => a.status === "Interview" && a.interviewDate && daysUntil(a.interviewDate) >= 0).sort((a, b) => a.interviewDate!.localeCompare(b.interviewDate!));
  const followUps = data
    .filter((a) => a.followUpDate && daysUntil(a.followUpDate) <= 7 && !["Rejected", "Withdrawn"].includes(a.status))
    .sort((a, b) => a.followUpDate!.localeCompare(b.followUpDate!));
  const activity = data.flatMap((a) => a.timeline.map((t) => ({ ...t, app: a }))).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);

  return (
    <>
      <PageHeader title="Overview" meta={`${data.length} applications`} />
      <div className="surface mb-6 grid grid-cols-3 divide-border sm:grid-cols-6 sm:divide-x">
        {STATUSES.map((s) => (
          <div key={s} className="p-4">
            <p className="text-2xl font-semibold tabular-nums">{data.filter((a) => a.status === s).length}</p>
            <StatusBadge status={s} className="mt-1" />
          </div>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Upcoming interviews" empty="No interviews scheduled.">
          {interviews.map((a) => (
            <Row key={a.id} id={a.id} title={a.company} sub={a.role} right={<><p>{fmtDate(a.interviewDate)}</p><p className="text-xs text-muted-foreground">{relDays(a.interviewDate!)}</p></>} />
          ))}
        </Panel>
        <Panel title="Follow-ups due" empty="Nothing due in the next 7 days.">
          {followUps.map((a) => {
            const overdue = daysUntil(a.followUpDate!) < 0;
            return <Row key={a.id} id={a.id} title={a.company} sub={a.nextAction || a.role}
              right={<><p>{fmtDate(a.followUpDate)}</p><p className={overdue ? "text-xs font-medium text-destructive" : "text-xs text-muted-foreground"}>{relDays(a.followUpDate!)}</p></>} />;
          })}
        </Panel>
        <div className="lg:col-span-2">
          <Panel title="Recent activity" empty="No activity yet.">
            {activity.map((t) => (
              <Row key={t.id} id={t.app.id} title={t.app.company} sub={t.description} right={<p className="text-xs text-muted-foreground">{fmtDateTime(t.date)}</p>} />
            ))}
          </Panel>
        </div>
      </div>
    </>
  );
}

function Panel({ title, empty, children }: { title: string; empty: string; children: React.ReactNode[] }) {
  return (
    <section className="surface">
      <h2 className="section-title border-b border-border px-5 py-3 !mb-0">{title}</h2>
      {children.length ? <ul className="divide-y divide-border">{children}</ul> : <p className="px-5 py-6 text-sm text-muted-foreground">{empty}</p>}
    </section>
  );
}

function Row({ id, title, sub, right }: { id: string; title: string; sub: string; right: React.ReactNode }) {
  return (
    <li>
      <Link to="/applications/$id" params={{ id }} className="flex items-center justify-between gap-4 px-5 py-3 text-sm hover:bg-muted/40 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring">
        <div className="min-w-0"><p className="font-medium">{title}</p><p className="truncate text-muted-foreground">{sub}</p></div>
        <div className="shrink-0 text-right tabular-nums">{right}</div>
      </Link>
    </li>
  );
}
