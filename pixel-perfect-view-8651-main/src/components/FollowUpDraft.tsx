import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { makeFollowUpDraft } from "@/lib/follow-up";
import type { Application } from "@/lib/types";

export function FollowUpDraft({ app }: { app: Application }) {
  const [generated, setGenerated] = useState(false);
  const [draft, setDraft] = useState("");
  const [message, setMessage] = useState("");
  async function copy() {
    try { await navigator.clipboard.writeText(draft); setMessage("Draft copied. Review it in your email app before sending."); }
    catch { setMessage("Copy is unavailable. Select the draft text and copy it manually."); }
  }
  return <section className="surface space-y-3 p-5">
    <h2 className="section-title">Follow-up assistant</h2>
    <p className="text-sm text-muted-foreground">Create a template using this application's company, role and status. Edit it and replace [Your name] before copying. Nothing is sent automatically. Draft edits are not saved after leaving this page.</p>
    {!generated ? <Button onClick={() => { setGenerated(true); setDraft(makeFollowUpDraft(app)); setMessage(""); }}>Create follow-up draft</Button> : <>
      <label htmlFor="follow-up-draft" className="text-sm font-medium">Editable draft</label>
      <Textarea id="follow-up-draft" rows={12} value={draft} onChange={(e) => { setDraft(e.target.value); setMessage(""); }} />
      <Button onClick={() => void copy()} disabled={!draft.trim()}>Copy draft</Button>
    </>}
    <p role="status" className="text-sm text-muted-foreground">{message}</p>
  </section>;
}
