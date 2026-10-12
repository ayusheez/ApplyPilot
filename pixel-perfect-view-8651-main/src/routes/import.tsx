import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertCircle, CheckCircle2, Copy, Loader2 } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { analyseEmail } from "@/lib/api";
import { fmtDate } from "@/lib/format";
import { sampleEmails } from "@/lib/mock-data";
import { useApplications, useSaveImport } from "@/lib/queries";
import { STATUSES, type Application, type ApplicationStatus, type EmailInput, type ExtractionResult } from "@/lib/types";

export const Route = createFileRoute("/import")({
  head: () => ({
    meta: [
      { title: "Import email — ApplyPilot" },
      { name: "description", content: "Paste a recruiter email, review the extracted details and save or update an application." },
      { property: "og:title", content: "Import email — ApplyPilot" },
      { property: "og:description", content: "Paste a recruiter email, review the extracted details and save or update an application." },
    ],
  }),
  component: ImportPage,
});

type Fields = { company: string; role: string; status: ApplicationStatus | ""; interviewDate: string; followUpDate: string; nextAction: string };
type Stage =
  | { s: "input" }
  | { s: "duplicate"; applicationId: string; label: string }
  | { s: "review"; extraction: ExtractionResult }
  | { s: "saved"; app: Application; updated: boolean };

const blankEmail: EmailInput = { subject: "", sender: "", receivedAt: "", body: "" };

function ImportPage() {
  const [email, setEmail] = useState<EmailInput>(blankEmail);
  const [emailErrors, setEmailErrors] = useState<{ subject?: string; body?: string }>({});
  const [analysing, setAnalysing] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>({ s: "input" });

  const setE = (k: keyof EmailInput, v: string) => {
    setEmail((p) => ({ ...p, [k]: v }));
    setStage({ s: "input" });
    setFailure(null);
    if (k === "subject" || k === "body") setEmailErrors((p) => ({ ...p, [k]: undefined }));
  };

  async function analyse(e: React.FormEvent) {
    e.preventDefault();
    const errs: typeof emailErrors = {};
    if (!email.subject.trim()) errs.subject = "Enter the email subject.";
    if (!email.body.trim()) errs.body = "Paste the email body.";
    else if (email.body.trim().length < 30) errs.body = "The body looks too short to analyse.";
    else if (email.body.length > 20000) errs.body = "Keep the body under 20,000 characters.";
    setEmailErrors(errs);
    if (Object.keys(errs).length) return;
    setFailure(null);
    setAnalysing(true);
    try {
      const res = await analyseEmail(email);
      if (res.kind === "duplicate") setStage({ s: "duplicate", applicationId: res.applicationId, label: `${res.role} at ${res.company}` });
      else setStage({ s: "review", extraction: res.extraction });
    } catch (err) {
      setFailure(err instanceof Error ? err.message : "Analysis failed. Try again.");
    } finally {
      setAnalysing(false);
    }
  }

  const reset = () => { setEmail(blankEmail); setEmailErrors({}); setStage({ s: "input" }); setFailure(null); };

  return (
    <>
      <PageHeader title="Import email" meta={<>Paste an email → analyse → review → save. <span className="ml-1 rounded border border-border bg-muted px-1.5 py-0.5 text-xs font-medium text-foreground">Gemini analysis</span></>} />

      {stage.s === "saved" ? (
        <div className="surface p-8 text-center">
          <CheckCircle2 className="mx-auto h-8 w-8 text-status-offer" aria-hidden />
          <p className="mt-3 font-medium">{stage.updated ? "Application updated" : "Application saved"}</p>
          <p className="mt-1 text-sm text-muted-foreground">{stage.app.role} at {stage.app.company}</p>
          <div className="mt-5 flex justify-center gap-2">
            <Button asChild><Link to="/applications/$id" params={{ id: stage.app.id }}>View application</Link></Button>
            <Button variant="outline" onClick={reset}>Import another</Button>
          </div>
        </div>
      ) : stage.s === "review" ? (
        <Review email={email} extraction={stage.extraction} onBack={() => setStage({ s: "input" })} onSaved={(app, updated) => setStage({ s: "saved", app, updated })} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
          <form onSubmit={analyse} noValidate className="surface space-y-4 p-5">
            {stage.s === "duplicate" && (
              <div role="status" className="flex gap-3 rounded-md border border-status-assessment/30 bg-status-assessment/10 p-3 text-sm">
                <Copy className="mt-0.5 h-4 w-4 shrink-0 text-status-assessment" aria-hidden />
                <div>
                  <p className="font-medium">This email was already imported</p>
                  <p className="text-muted-foreground">It's saved on {stage.label}. <Link to="/applications/$id" params={{ id: stage.applicationId }} className="text-primary hover:underline">Open the existing record</Link></p>
                </div>
              </div>
            )}
            {failure && (
              <div role="alert" className="flex gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden />
                <div><p className="font-medium">Analysis failed</p><p className="text-muted-foreground">{failure} Your text has been kept.</p></div>
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="subject">Subject</Label>
              <Input disabled={analysing} id="subject" value={email.subject} onChange={(e) => setE("subject", e.target.value)} aria-invalid={!!emailErrors.subject} aria-describedby={emailErrors.subject ? "subject-error" : undefined} />
              {emailErrors.subject && <p id="subject-error" className="text-xs text-destructive">{emailErrors.subject}</p>}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5"><Label htmlFor="sender">Sender <span className="font-normal text-muted-foreground">(optional)</span></Label><Input disabled={analysing} id="sender" value={email.sender} onChange={(e) => setE("sender", e.target.value)} /></div>
              <div className="space-y-1.5"><Label htmlFor="received">Received date <span className="font-normal text-muted-foreground">(optional)</span></Label><Input disabled={analysing} id="received" type="date" value={email.receivedAt} onChange={(e) => setE("receivedAt", e.target.value)} /></div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="body">Email body</Label>
              <Textarea disabled={analysing} id="body" rows={12} value={email.body} onChange={(e) => setE("body", e.target.value)} aria-invalid={!!emailErrors.body} aria-describedby={emailErrors.body ? "body-error" : undefined} />
              {emailErrors.body && <p id="body-error" className="text-xs text-destructive">{emailErrors.body}</p>}
            </div>
            <p className="text-xs text-muted-foreground">Analysing sends this email to Google Gemini. Free-tier content may be used to improve Google products. Try a fictional sample first and remove sensitive information.</p>
            <div className="flex items-center gap-3">
              <Button type="submit" disabled={analysing}>{analysing ? <><Loader2 className="h-4 w-4 animate-spin" />Analysing…</> : "Analyse email"}</Button>
              {(email.subject || email.body) && !analysing && <Button type="button" variant="ghost" onClick={reset}>Clear</Button>}
            </div>
          </form>
          <aside className="space-y-3">
            <div className="surface p-4 text-sm">
              <p className="font-medium">About AI analysis</p>
              <p className="mt-1 text-muted-foreground">Gemini extracts suggested details with source quotes. Review every field before saving: AI can make mistakes. Unknown details are left blank.</p>
            </div>
            <div className="surface p-4">
              <p className="mb-2 text-sm font-medium">Sample emails</p>
              <ul className="space-y-1">
                {sampleEmails().map((s) => (
                  <li key={s.label}>
                    <button type="button" disabled={analysing} onClick={() => { const { label: _l, ...rest } = s; setEmail({ ...blankEmail, ...rest }); setStage({ s: "input" }); setFailure(null); setEmailErrors({}); }}
                      className="w-full rounded px-2 py-1.5 text-left text-sm text-primary hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring">{s.label}</button>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}

function Review({ email, extraction, onBack, onSaved }: {
  email: EmailInput; extraction: ExtractionResult; onBack: () => void; onSaved: (a: Application, updated: boolean) => void;
}) {
  const { data: apps } = useApplications();
  const save = useSaveImport();
  const [fields, setFields] = useState<Fields>({
    company: extraction.company.value ?? "",
    role: extraction.role.value ?? "",
    status: extraction.status.value ?? "",
    interviewDate: extraction.interviewDate.value ?? "",
    followUpDate: extraction.followUpDate.value ?? "",
    nextAction: extraction.nextAction.value ?? "",
  });
  const [errors, setErrors] = useState<Partial<Record<keyof Fields, string>>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const match = apps?.find((a) => a.id === extraction.matchedApplicationId);
  const [mode, setMode] = useState<"update" | "new">(extraction.matchedApplicationId ? "update" : "new");

  const set = (k: keyof Fields, v: string) => { setFields((p) => ({ ...p, [k]: v })); setErrors((p) => ({ ...p, [k]: undefined })); };

  async function submit() {
    const e: typeof errors = {};
    if (!fields.company.trim()) e.company = "Enter the company.";
    if (!fields.role.trim()) e.role = "Enter the role.";
    if (!fields.status) e.status = "Choose a status.";
    setErrors(e);
    if (Object.keys(e).length) return;
    setSaveError(null);
    const updating = mode === "update" && !!match;
    try {
      const app = await save.mutateAsync({
        email,
        fields: { ...fields, status: fields.status as ApplicationStatus },
        targetApplicationId: updating ? match!.id : null,
      });
      onSaved(app, updating);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Couldn't save. Try again.");
    }
  }

  const row = (k: keyof Fields, label: string, input: React.ReactNode) => {
    const excerpt = extraction[k].excerpt;
    return (
      <div className="grid gap-3 border-b border-border py-4 last:border-0 md:grid-cols-[1fr_1fr]">
        <div className="space-y-1.5">
          <Label htmlFor={`r-${k}`}>{label}</Label>
          {input}
          {errors[k] && <p id={`r-${k}-error`} className="text-xs text-destructive">{errors[k]}</p>}
        </div>
        <div className="text-sm">
          <p className="mb-1 text-xs text-muted-foreground">From the email</p>
          {excerpt ? <blockquote className="border-l-2 border-primary/40 pl-3 text-foreground/80 italic">“{excerpt}”</blockquote> : <p className="text-muted-foreground">Not found — left blank.</p>}
        </div>
      </div>
    );
  };
  const ia = (k: keyof Fields) => ({ id: `r-${k}`, "aria-invalid": !!errors[k], "aria-describedby": errors[k] ? `r-${k}-error` : undefined });

  const changes = match ? ([
    ["Company", match.company, fields.company],
    ["Role", match.role, fields.role],
    ["Status", match.status, fields.status],
    ["Interview date", fmtDate(match.interviewDate), fields.interviewDate ? fmtDate(fields.interviewDate) : fmtDate(match.interviewDate)],
    ["Follow-up date", fmtDate(match.followUpDate), fields.followUpDate ? fmtDate(fields.followUpDate) : fmtDate(match.followUpDate)],
    ["Next action", match.nextAction || "—", fields.nextAction || match.nextAction || "—"],
  ] as const).filter(([, a, b]) => a !== b) : [];

  return (
    <div className="space-y-6">
      <div className="surface px-5 py-3 text-sm">
        <span className="text-muted-foreground">Email:</span> <span className="font-medium">{email.subject}</span>
        {email.sender && <span className="text-muted-foreground"> · {email.sender}</span>}
      </div>

      {match && (
        <section className="surface p-5">
          <h2 className="section-title">Matches an existing application</h2>
          <p className="mb-3 text-sm"><Link to="/applications/$id" params={{ id: match.id }} className="font-medium text-primary hover:underline">{match.role} at {match.company}</Link> <StatusBadge status={match.status} className="ml-1" /></p>
          <RadioGroup value={mode} onValueChange={(v) => setMode(v as "update" | "new")} className="gap-2">
            <div className="flex items-center gap-2"><RadioGroupItem value="update" id="m-update" /><Label htmlFor="m-update" className="font-normal">Update this application</Label></div>
            <div className="flex items-center gap-2"><RadioGroupItem value="new" id="m-new" /><Label htmlFor="m-new" className="font-normal">Save as a new application</Label></div>
          </RadioGroup>
          {mode === "update" && (
            <div className="mt-4 rounded-md border border-border bg-muted/30 p-3 text-sm">
              <p className="mb-2 text-xs font-medium text-muted-foreground">Proposed changes</p>
              {changes.length === 0 ? <p className="text-muted-foreground">No field changes — the email will be attached to the record.</p> : (
                <ul className="space-y-1">{changes.map(([l, a, b]) => <li key={l}><span className="text-muted-foreground">{l}:</span> <span className="line-through opacity-60">{a}</span> → <span className="font-medium">{b}</span></li>)}</ul>
              )}
            </div>
          )}
        </section>
      )}

      <p className="text-sm text-muted-foreground">Review these AI suggestions before saving. Nothing has been added to your applications yet.</p>
      {!!extraction.warnings?.length && <ul role="status" className="text-sm text-muted-foreground">{extraction.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>}
      <section className="surface px-5 py-1">
        {row("company", "Company", <Input {...ia("company")} value={fields.company} onChange={(e) => set("company", e.target.value)} />)}
        {row("role", "Role", <Input {...ia("role")} value={fields.role} onChange={(e) => set("role", e.target.value)} />)}
        {row("status", "Status",
          <Select value={fields.status} onValueChange={(v) => set("status", v)}>
            <SelectTrigger {...ia("status")}><SelectValue placeholder="Choose status" /></SelectTrigger>
            <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>)}
        {row("interviewDate", "Interview date", <Input {...ia("interviewDate")} type="date" value={fields.interviewDate} onChange={(e) => set("interviewDate", e.target.value)} />)}
        {row("followUpDate", "Follow-up deadline", <Input {...ia("followUpDate")} type="date" value={fields.followUpDate} onChange={(e) => set("followUpDate", e.target.value)} />)}
        {row("nextAction", "Next action", <Input {...ia("nextAction")} value={fields.nextAction} onChange={(e) => set("nextAction", e.target.value)} />)}
      </section>

      {saveError && <p role="alert" className="text-sm text-destructive">{saveError}</p>}
      <div className="flex gap-2">
        <Button onClick={submit} disabled={save.isPending}>{save.isPending ? "Saving…" : mode === "update" && match ? "Update application" : "Save application"}</Button>
        <Button variant="outline" onClick={onBack} disabled={save.isPending}>Back to email</Button>
      </div>
    </div>
  );
}
