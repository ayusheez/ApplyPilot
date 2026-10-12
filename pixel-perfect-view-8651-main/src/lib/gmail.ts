import { API_BASE_URL } from "./auth";
import type { EmailInput } from "./types";
export type GmailReview = {kind:"review";jobId:string;email:EmailInput} | {kind:"duplicate";applicationId:string;company:string;role:string};
export type GmailJob = {id:string;status:string;applicationId:string|null};
export type GmailMessage = {id:string;subject:string;sender:string;date:string};
export async function gmailRequest<T>(path:string, method="GET"):Promise<T> {
  let response:Response;
  try { response=await fetch(`${API_BASE_URL}/api/gmail/${path}`,{method,credentials:"include",signal:AbortSignal.timeout(75000)}); }
  catch { throw new Error("Gmail request did not finish. Your connection may be offline. Check pending imports before retrying."); }
  if(response.status===204) return undefined as T;
  const data=await response.json().catch(()=>null);
  if(!response.ok) {
    if(response.status===401) window.dispatchEvent(new Event("applypilot:unauthorized"));
    throw new Error(data?.error?.message || "Gmail request failed. Try again later.");
  }
  if(!data) throw new Error("Unreadable Gmail response.");
  return data as T;
}
