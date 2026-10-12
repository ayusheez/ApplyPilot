import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { gmailRequest, type GmailReview, type GmailMessage, type GmailJob } from "@/lib/gmail";
export function GmailImport({onReview}:{onReview:(result:GmailReview)=>void}) {
  const [connection,setConnection]=useState<{connected:boolean;mailbox:string|null}|null>(null);
  const [query,setQuery]=useState("newer_than:30d {application interview assessment offer recruitment}");
  const [messages,setMessages]=useState<GmailMessage[]>([]);
  const [jobs,setJobs]=useState<GmailJob[]>([]);
  const [page,setPage]=useState<string|null>(null);
  const [searched,setSearched]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  async function refresh(){
    setConnection(await gmailRequest("status")); setJobs(await gmailRequest("imports"));
  }
  useEffect(()=>{
    let active=true;
    Promise.all([gmailRequest<{connected:boolean;mailbox:string|null}>("status"),gmailRequest<GmailJob[]>("imports")]).then(([c,j])=>{if(active){setConnection(c);setJobs(j);}}).catch(e=>{if(active)setError(e.message);});
    const result=new URLSearchParams(window.location.search).get("gmail");
    if(result) setNotice(result==="connected" ? "Gmail connected. Choose emails to review locally." : "Gmail connection was cancelled or failed. Check your Google test-user and permission settings, then reconnect.");
    return ()=>{active=false;};
  },[]);
  async function run(action:()=>Promise<void>){setBusy(true);setError("");try{await action();}catch(e){setError(e instanceof Error?e.message:"Gmail request failed.");}finally{setBusy(false);}}
  async function search(next=""){
    const result=await gmailRequest<{messages:GmailMessage[];nextPage:string|null}>(`messages?q=${encodeURIComponent(query)}&page=${encodeURIComponent(next)}`);
    setMessages(result.messages);setPage(result.nextPage);setSearched(true);
  }
  return <section className="surface mb-6 space-y-3 p-5">
    <h2 className="section-title">Import from Gmail</h2>
    <p className="text-sm text-muted-foreground">Read-only access. Select one email at a time and fill in the application details during review. Gmail messages are not sent to Gemini. Attachments are not fetched.</p>
    {notice && <p role="status" className="text-sm">{notice}</p>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {!connection ? <Button disabled={busy} onClick={()=>void run(refresh)}>Check Gmail connection</Button> : !connection.connected ?
      <Button disabled={busy} onClick={()=>void run(async()=>{const result=await gmailRequest<{url:string}>("connect","POST");window.location.assign(result.url);})}>Connect Gmail</Button> : <>
      <div className="flex flex-wrap items-center gap-3"><span className="text-sm">Connected: {connection.mailbox}</span>
      <Button variant="outline" disabled={busy} onClick={()=>void run(async()=>{
        const result=await gmailRequest<{revoked:boolean}>("connection","DELETE");setMessages([]);setPage(null);setSearched(false);await refresh();
        setNotice(result.revoked ? "Disconnected. Pending imports were removed; saved applications remain." : "Disconnected locally. Also remove ApplyPilot access in your Google Account permissions; Google revocation could not be confirmed.");
      })}>Disconnect Gmail</Button></div>
      <p className="text-xs text-muted-foreground">Disconnect removes stored tokens and pending email previews. Saved source emails remain until you delete their application.</p>
      <label htmlFor="gmail-search" className="text-sm">Search Gmail</label>
      <Input id="gmail-search" value={query} disabled={busy} maxLength={300} onChange={e=>{setQuery(e.target.value);setPage(null);setMessages([]);setSearched(false);}} />
      <Button disabled={busy} variant="outline" onClick={()=>void run(()=>search())}>{busy?"Working…":"Find emails"}</Button>
      <ul className="divide-y">{messages.map(m=><li key={m.id} className="flex items-center justify-between gap-3 py-3"><div className="min-w-0"><p className="break-words text-sm font-medium">{m.subject}</p><p className="break-words text-xs text-muted-foreground">{m.sender} · {m.date}</p></div><Button disabled={busy} size="sm" onClick={()=>void run(async()=>onReview(await gmailRequest<GmailReview>(`messages/${encodeURIComponent(m.id)}/prepare`,"POST")))}>Review</Button></li>)}</ul>
      {searched && !messages.length && <p className="text-sm">No matching emails. Try a company name or a broader search.</p>}
      {page && <Button disabled={busy} variant="outline" onClick={()=>void run(()=>search(page))}>Next page</Button>}
    </>}
    {!!jobs.length && <div className="space-y-2"><h3 className="text-sm font-medium">Pending imports</h3><p className="text-xs text-muted-foreground">Resume a ready import after a page refresh. Failed or interrupted imports can be discarded and selected again.</p>{jobs.map(j=><div key={j.id} className="flex flex-wrap items-center gap-2 text-sm"><span>Import {j.id.slice(0,8)} · {j.status}</span><Button size="sm" disabled={busy||j.status!=="ready"} onClick={()=>void run(async()=>onReview(await gmailRequest<GmailReview>(`imports/${j.id}`)))}>Resume</Button><Button size="sm" variant="outline" disabled={busy} onClick={()=>void run(async()=>{await gmailRequest(`imports/${j.id}`,"DELETE");await refresh();})}>Discard</Button></div>)}</div>}
  </section>;
}
