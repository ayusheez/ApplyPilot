import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useCreateApplication, useUpdateApplication } from "@/lib/queries";
import { today } from "@/lib/format";
import { STATUSES, type Application, type ApplicationInput, type ApplicationStatus } from "@/lib/types";

type Errors = Partial<Record<keyof ApplicationInput, string>>;

function initial(app?: Application): ApplicationInput {
  return {
    company: app?.company ?? "",
    role: app?.role ?? "",
    jobUrl: app?.jobUrl ?? "",
    appliedOn: app?.appliedOn ?? today(),
    status: app?.status ?? "Applied",
    interviewDate: app?.interviewDate ?? "",
    followUpDate: app?.followUpDate ?? "",
    nextAction: app?.nextAction ?? "",
    notes: app?.notes ?? "",
  };
}

function validate(v: ApplicationInput): Errors {
  const e: Errors = {};
  if (!v.company.trim()) e.company = "Enter the company name.";
  else if (v.company.length > 100) e.company = "Keep it under 100 characters.";
  if (!v.role.trim()) e.role = "Enter the role.";
  else if (v.role.length > 120) e.role = "Keep it under 120 characters.";
  if (!v.appliedOn) e.appliedOn = "Choose the application date.";
  if (v.jobUrl && !/^https?:\/\/\S+\.\S+/.test(v.jobUrl.trim())) e.jobUrl = "Enter a full link starting with http:// or https://";
  if (v.nextAction && v.nextAction.length > 160) e.nextAction = "Keep it under 160 characters.";
  return e;
}

export function ApplicationFormDialog({
  open, onOpenChange, application, onSaved,
}: { open: boolean; onOpenChange: (o: boolean) => void; application?: Application; onSaved?: (a: Application) => void }) {
  const [values, setValues] = useState<ApplicationInput>(() => initial(application));
  const [errors, setErrors] = useState<Errors>({});
  const create = useCreateApplication();
  const update = useUpdateApplication();
  const pending = create.isPending || update.isPending;

  useEffect(() => {
    if (open) { setValues(initial(application)); setErrors({}); }
  }, [open, application]);

  const set = <K extends keyof ApplicationInput>(k: K, v: ApplicationInput[K]) => {
    setValues((p) => ({ ...p, [k]: v }));
    if (errors[k]) setErrors((p) => ({ ...p, [k]: undefined }));
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate(values);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    try {
      const saved = application
        ? await update.mutateAsync({ id: application.id, patch: values })
        : await create.mutateAsync(values);
      toast.success(application ? "Application updated" : "Application added");
      onOpenChange(false);
      onSaved?.(saved);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save. Your entries are kept — try again.");
    }
  }

  const field = (id: keyof ApplicationInput, label: string, input: React.ReactNode, opt = false) => (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}{opt && <span className="ml-1 font-normal text-muted-foreground">(optional)</span>}</Label>
      {input}
      {errors[id] && <p id={`${id}-error`} className="text-xs text-destructive">{errors[id]}</p>}
    </div>
  );
  const aria = (id: keyof ApplicationInput) => ({ id, "aria-invalid": !!errors[id], "aria-describedby": errors[id] ? `${id}-error` : undefined });

  return (
    <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{application ? "Edit application" : "Add application"}</DialogTitle>
          <DialogDescription>Fields marked optional can be left blank.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
          {field("company", "Company", <Input {...aria("company")} value={values.company} onChange={(e) => set("company", e.target.value)} />)}
          {field("role", "Role", <Input {...aria("role")} value={values.role} onChange={(e) => set("role", e.target.value)} />)}
          <div className="sm:col-span-2">
            {field("jobUrl", "Job link", <Input {...aria("jobUrl")} type="url" placeholder="https://" value={values.jobUrl} onChange={(e) => set("jobUrl", e.target.value)} />, true)}
          </div>
          {field("appliedOn", "Applied on", <Input {...aria("appliedOn")} type="date" value={values.appliedOn} onChange={(e) => set("appliedOn", e.target.value)} />)}
          {field("status", "Status",
            <Select value={values.status} onValueChange={(v) => set("status", v as ApplicationStatus)}>
              <SelectTrigger id="status"><SelectValue /></SelectTrigger>
              <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>)}
          {field("interviewDate", "Interview date", <Input {...aria("interviewDate")} type="date" value={values.interviewDate} onChange={(e) => set("interviewDate", e.target.value)} />, true)}
          {field("followUpDate", "Follow-up date", <Input {...aria("followUpDate")} type="date" value={values.followUpDate} onChange={(e) => set("followUpDate", e.target.value)} />, true)}
          <div className="sm:col-span-2">
            {field("nextAction", "Next action", <Input {...aria("nextAction")} value={values.nextAction} onChange={(e) => set("nextAction", e.target.value)} />, true)}
          </div>
          <div className="sm:col-span-2">
            {field("notes", "Notes", <Textarea {...aria("notes")} rows={3} value={values.notes} onChange={(e) => set("notes", e.target.value)} />, true)}
          </div>
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
            <Button type="submit" disabled={pending}>{pending ? "Saving…" : application ? "Save changes" : "Add application"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
