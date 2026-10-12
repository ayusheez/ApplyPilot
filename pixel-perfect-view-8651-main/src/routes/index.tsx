import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/AppShell";
import { ApplicationFormDialog } from "@/components/ApplicationFormDialog";
import { DeleteApplicationDialog } from "@/components/DeleteApplicationDialog";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtDate } from "@/lib/format";
import { useApplications } from "@/lib/queries";
import { STATUSES, type Application } from "@/lib/types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Applications — ApplyPilot" },
      { name: "description", content: "Track every job application, its status and next action in one place." },
      { property: "og:title", content: "Applications — ApplyPilot" },
      { property: "og:description", content: "Track every job application, its status and next action in one place." },
    ],
  }),
  component: ApplicationsPage,
});

type Sort = "applied-desc" | "applied-asc" | "updated-desc" | "updated-asc";

function ApplicationsPage() {
  const { data, isLoading, isError, refetch } = useApplications();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [sort, setSort] = useState<Sort>("updated-desc");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Application | undefined>();
  const [deleting, setDeleting] = useState<Application | null>(null);

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = (data ?? []).filter(
      (a) => (status === "all" || a.status === status) &&
        (!term || a.company.toLowerCase().includes(term) || a.role.toLowerCase().includes(term)),
    );
    const [key, dir] = sort.split("-") as ["applied" | "updated", "asc" | "desc"];
    const val = (a: Application) => (key === "applied" ? a.appliedOn : a.lastUpdated);
    return list.sort((a, b) => (dir === "asc" ? 1 : -1) * val(a).localeCompare(val(b)));
  }, [data, q, status, sort]);

  const open = (a: Application) => navigate({ to: "/applications/$id", params: { id: a.id } });
  const edit = (a: Application) => { setEditing(a); setFormOpen(true); };
  const filtered = q || status !== "all";

  return (
    <>
      <PageHeader
        title="Applications"
        meta={data ? `${data.length} total${filtered ? ` · ${rows.length} shown` : ""}` : "Loading…"}
        actions={<Button onClick={() => { setEditing(undefined); setFormOpen(true); }}><Plus className="h-4 w-4" />Add application</Button>}
      />

      {!isLoading && !isError && <div className="pipeline-strip" aria-label="Application status shortcuts">
        {[{ label: "All applications", value: "all", count: data?.length ?? 0 }, ...["Applied", "Interview", "Offer"].map(value => ({ label: value === "Applied" ? "Awaiting response" : value === "Interview" ? "Interviews" : "Offers", value, count: data?.filter(a => a.status === value).length ?? 0 }))].map(item => <button type="button" key={item.value} className="pipeline-stat" aria-pressed={status === item.value} onClick={() => setStatus(item.value)}><span className="stat-label">{item.label}</span><span className="stat-value">{item.count.toString().padStart(2, "0")}</span></button>)}
      </div>}
      <div className="application-toolbar mb-4 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input aria-label="Search by company or role" placeholder="Search company or role" className="pl-8" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger aria-label="Filter by status" className="sm:w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={(v) => setSort(v as Sort)}>
          <SelectTrigger aria-label="Sort" className="sm:w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="updated-desc">Last updated (newest)</SelectItem>
            <SelectItem value="updated-asc">Last updated (oldest)</SelectItem>
            <SelectItem value="applied-desc">Applied on (newest)</SelectItem>
            <SelectItem value="applied-asc">Applied on (oldest)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-11 w-full" />)}</div>
      ) : isError ? (
        <div className="surface p-6 text-sm">Couldn't load applications. <Button variant="link" className="px-1" onClick={() => refetch()}>Retry</Button></div>
      ) : rows.length === 0 ? (
        <div className="surface p-10 text-center">
          <p className="font-medium">{filtered ? "No applications match" : "No applications yet"}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {filtered ? "Try a different search or status." : <>Add one manually or <Link to="/import" className="text-primary underline-offset-2 hover:underline">import an email</Link>.</>}
          </p>
          {filtered && <Button variant="outline" size="sm" className="mt-4" onClick={() => { setQ(""); setStatus("all"); }}>Clear filters</Button>}
        </div>
      ) : (
        <>
          <div className="surface application-table hidden md:block">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  {["Company & role", "Status", "Applied on", "Next action"].map((h) => <th key={h} className="px-4 py-2.5 font-medium">{h}</th>)}
                  <th className="w-20 px-4 py-2.5"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((a, rowIndex) => (
                  <tr key={a.id} tabIndex={0} onClick={() => open(a)} onKeyDown={(e) => e.key === "Enter" && open(a)}
                    className="cursor-pointer border-b border-border last:border-0 hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring">
                    <td className="px-4 py-3 font-medium"><div className="company-cell"><span aria-hidden className={`company-avatar tone-${rowIndex % 4}`}>{a.company.split(" ").filter(w => w !== "&").slice(0, 2).map(w => w[0]).join("")}</span><span>{a.company}<span className="mt-1 block text-xs font-normal text-muted-foreground">{a.role}</span></span></div></td>
                    <td className="px-4 py-3"><StatusBadge status={a.status} /></td>
                    <td className="px-4 py-3 whitespace-nowrap tabular-nums text-muted-foreground">{fmtDate(a.appliedOn)}</td>
                    <td className="max-w-56 px-4 py-3 text-muted-foreground">{a.nextAction || "—"}</td>
                    <td className="px-2 py-3">
                      <div className="flex justify-end gap-0.5" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Edit ${a.company}`} onClick={() => edit(a)}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Delete ${a.company}`} onClick={() => setDeleting(a)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="space-y-2 md:hidden">
            {rows.map((a) => (
              <li key={a.id}>
                <Link to="/applications/$id" params={{ id: a.id }} className="surface block p-4 focus-visible:outline-2 focus-visible:outline-ring">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium">{a.company}</p>
                      <p className="text-sm text-muted-foreground">{a.role}</p>
                    </div>
                    <StatusBadge status={a.status} />
                  </div>
                  {a.nextAction && <p className="mt-3 text-sm">Next: {a.nextAction}</p>}
                  <p className="mt-2 text-xs text-muted-foreground">Applied {fmtDate(a.appliedOn)} · Updated {fmtDate(a.lastUpdated)}</p>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}

      {!isLoading && !isError && <p className="table-footer">Showing {rows.length} of {data?.length ?? 0} applications · Select an application to see its timeline.</p>}

      <ApplicationFormDialog open={formOpen} onOpenChange={setFormOpen} {...(editing ? { application: editing } : {})} />
      <DeleteApplicationDialog application={deleting} onOpenChange={(o) => !o && setDeleting(null)} />
    </>
  );
}
