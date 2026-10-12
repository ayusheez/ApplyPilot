import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ExternalLink, Pencil, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { FollowUpDraft } from "@/components/FollowUpDraft";
import { ApplicationFormDialog } from "@/components/ApplicationFormDialog";
import { DeleteApplicationDialog } from "@/components/DeleteApplicationDialog";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { useApplication, useUpdateApplication } from "@/lib/queries";
import { STATUSES, type Application, type ApplicationStatus } from "@/lib/types";

export const Route = createFileRoute("/applications/$id")({
  head: () => ({
    meta: [
      { title: "Application details — ApplyPilot" },
      { name: "description", content: "Dates, notes, timeline and source emails for one job application." },
      { property: "og:title", content: "Application details — ApplyPilot" },
      { property: "og:description", content: "Dates, notes, timeline and source emails for one job application." },
    ],
  }),
  component: DetailPage,
});

function DetailPage() {
  const { id } = Route.useParams();
  const { data: app, isLoading, isError, error, refetch } = useApplication(id);
  const navigate = useNavigate();
  const [editOpen, setEditOpen] = useState(false);
  const [deleting, setDeleting] = useState<Application | null>(null);

  const back = (
    <Link to="/" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeft className="h-4 w-4" /> Applications
    </Link>
  );

  if (isLoading) return <>{back}<Skeleton className="h-8 w-64" /><Skeleton className="mt-6 h-64 w-full" /></>;
  if (isError) return <>{back}<div role="alert" className="surface p-6"><p>{error.message}</p><Button variant="outline" onClick={() => void refetch()}>Retry</Button></div></>;
  if (!app) return (
    <>{back}<div className="surface p-10 text-center"><p className="font-medium">Application not found</p><p className="mt-1 text-sm text-muted-foreground">It may have been deleted, or the link is incorrect.</p></div></>
  );

  return (
    <>
      {back}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3"><h1 className="text-xl font-semibold tracking-tight">{app.company}</h1><StatusBadge status={app.status} /></div>
          <p className="mt-0.5 text-muted-foreground">{app.role}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setEditOpen(true)}><Pencil className="h-4 w-4" />Edit</Button>
          <Button variant="outline" onClick={() => setDeleting(app)}><Trash2 className="h-4 w-4" />Delete</Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <section className="surface p-5">
            <h2 className="section-title">Details</h2>
            <dl className="grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
              <Item label="Status"><StatusSelect app={app} /></Item>
              <Item label="Applied on">{fmtDate(app.appliedOn)}</Item>
              <Item label="Interview date">{fmtDate(app.interviewDate)}</Item>
              <Item label="Follow-up date">{fmtDate(app.followUpDate)}</Item>
              <Item label="Next action">{app.nextAction || "—"}</Item>
              <Item label="Job link">
                {app.jobUrl ? <a href={app.jobUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">Open posting <ExternalLink className="h-3 w-3" /></a> : "—"}
              </Item>
            </dl>
          </section>
          <FollowUpDraft key={app.id} app={app} />
          <Notes app={app} />
          <section className="surface p-5">
            <h2 className="section-title">Source emails</h2>
            {app.sourceEmails.length === 0 ? (
              <p className="text-sm text-muted-foreground">No imported emails for this application.</p>
            ) : (
              <div className="space-y-4">
                {app.sourceEmails.map((e) => (
                  <article key={e.id} className="rounded-md border border-border bg-muted/30 p-4">
                    <p className="text-sm font-medium">{e.subject}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{e.sender || "Unknown sender"} · {e.receivedAt ? fmtDate(e.receivedAt) : `imported ${fmtDate(e.importedAt)}`}</p>
                    <pre className="mt-3 font-sans text-sm leading-relaxed whitespace-pre-wrap">{e.body}</pre>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
        <section className="surface h-fit p-5">
          <h2 className="section-title">Timeline</h2>
          <ol className="relative space-y-4 border-l border-border pl-4">
            {[...app.timeline].sort((a, b) => a.date.localeCompare(b.date)).map((t) => (
              <li key={t.id} className="relative">
                <span className="absolute top-1.5 -left-[21px] h-2 w-2 rounded-full bg-primary/70 ring-2 ring-card" aria-hidden />
                <p className="text-sm">{t.description}</p>
                <p className="text-xs text-muted-foreground">{fmtDateTime(t.date)}</p>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <ApplicationFormDialog open={editOpen} onOpenChange={setEditOpen} application={app} />
      <DeleteApplicationDialog application={deleting} onOpenChange={(o) => !o && setDeleting(null)} onDeleted={() => navigate({ to: "/" })} />
    </>
  );
}

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><dt className="mb-1 text-xs text-muted-foreground">{label}</dt><dd>{children}</dd></div>;
}

function StatusSelect({ app }: { app: Application }) {
  const update = useUpdateApplication();
  return (
    <Select value={app.status} disabled={update.isPending}
      onValueChange={async (v) => {
        try { await update.mutateAsync({ id: app.id, patch: { status: v as ApplicationStatus } }); toast.success(`Status set to ${v}`); }
        catch { toast.error("Couldn't change status."); }
      }}>
      <SelectTrigger aria-label="Change status" className="h-8 w-40"><SelectValue /></SelectTrigger>
      <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
    </Select>
  );
}

function Notes({ app }: { app: Application }) {
  const [text, setText] = useState(app.notes);
  const update = useUpdateApplication();
  useEffect(() => setText(app.notes), [app.notes]);
  const dirty = text !== app.notes;
  return (
    <section className="surface p-5">
      <Label htmlFor="notes" className="section-title block">Notes</Label>
      <Textarea id="notes" rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder="Interview prep, contacts, salary notes…" />
      <div className="mt-3 flex gap-2">
        <Button size="sm" disabled={!dirty || update.isPending}
          onClick={async () => {
            try { await update.mutateAsync({ id: app.id, patch: { notes: text } }); toast.success("Notes saved"); }
            catch { toast.error("Couldn't save notes. Your text is kept."); }
          }}>{update.isPending ? "Saving…" : "Save notes"}</Button>
        {dirty && <Button size="sm" variant="ghost" onClick={() => setText(app.notes)}>Discard</Button>}
      </div>
    </section>
  );
}
