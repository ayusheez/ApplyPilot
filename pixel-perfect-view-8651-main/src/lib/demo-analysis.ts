import type { Application, ApplicationStatus, EmailInput, ExtractedField, ExtractionResult } from "./types";

/**
 * Demo analysis: simple keyword/pattern rules over the email text.
 * Not AI — will be replaced by the FastAPI analysis endpoint.
 */

const MONTHS = ["january","february","march","april","may","june","july","august","september","october","november","december"];

function sentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter(Boolean);
}
function findSentence(text: string, re: RegExp): string | null {
  return sentences(text).find((s) => re.test(s)) ?? null;
}
const empty = <T,>(): ExtractedField<T> => ({ value: null, excerpt: null });

function parseDate(s: string): string | null {
  const m = s.match(/(\d{1,2})\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{4})/i);
  if (!m?.[1] || !m[2] || !m[3]) return null;
  const month = MONTHS.indexOf(m[2].toLowerCase()) + 1;
  const parsed = new Date(Number(m[3]), month - 1, Number(m[1]));
  if (parsed.getMonth() !== month - 1 || parsed.getDate() !== Number(m[1])) return null;
  return `${m[3]}-${String(month).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}

export function runDemoAnalysis(email: EmailInput, existing: Application[]): ExtractionResult {
  const text = `${email.subject}\n${email.body}`;

  // Company
  let company = empty<string>();
  const companyRe = /(?:applying to|role at|position at|interviewing for .*? at|with)\s+([A-Z][\w&'-]*(?:\s+(?:&\s+)?[A-Z][\w&'-]*){0,3})/;
  const cs = findSentence(text, companyRe);
  if (cs) {
    const m = cs.match(companyRe);
    if (m?.[1]) company = { value: m[1].replace(/\s+(for|the)$/i, "").trim(), excerpt: cs };
  }

  // Role
  let role = empty<string>();
  const roleRe = /(?:for the|the)\s+([A-Z][\w-]*(?:\s+[A-Z][\w-]*){0,4})\s+(?:role|position)/;
  const rs = findSentence(text, roleRe);
  if (rs) role = { value: rs.match(roleRe)?.[1] ?? null, excerpt: rs };

  // Status
  let status = empty<ApplicationStatus>();
  const rules: [RegExp, ApplicationStatus][] = [
    [/not (?:to )?move forward|unfortunately|decided not/i, "Rejected"],
    [/pleased to offer|offer of employment/i, "Offer"],
    [/invite you to an interview|interview on|schedule an interview/i, "Interview"],
    [/assessment|take-home|coding test/i, "Assessment"],
    [/received your application|thank you for applying/i, "Applied"],
  ];
  for (const [re, s] of rules) {
    const hit = findSentence(email.body, re);
    if (hit) { status = { value: s, excerpt: hit }; break; }
  }

  // Interview date
  let interviewDate = empty<string>();
  const is = findSentence(email.body, /interview.*\d{1,2}\s+[A-Za-z]+\s+\d{4}/i);
  if (is) interviewDate = { value: parseDate(is), excerpt: is };

  // Follow-up / deadline
  let followUpDate = empty<string>();
  const fs = findSentence(email.body, /(?:by|until|before)\s+\d{1,2}\s+[A-Za-z]+\s+\d{4}/i);
  if (fs) followUpDate = { value: parseDate(fs.replace(/^.*?(by|until|before)\s+/i, "")), excerpt: fs };

  // Next action
  let nextAction = empty<string>();
  const ns = findSentence(email.body, /please confirm|follow up|complete the|reply by/i);
  if (ns) {
    const v = /confirm/i.test(ns) ? "Confirm interview availability" : /follow up/i.test(ns) ? "Follow up if no response" : "Respond to request";
    nextAction = { value: v, excerpt: ns };
  }

  const matched = company.value
    ? existing.find((a) => a.company.toLowerCase() === company.value!.toLowerCase() && !!role.value && a.role.toLowerCase() === role.value.toLowerCase())
    : undefined;

  return { company, role, status, interviewDate, followUpDate, nextAction, matchedApplicationId: matched?.id ?? null };
}

export function emailFingerprint(e: { subject: string; body: string }): string {
  return `${e.subject}\n${e.body}`.toLowerCase().replace(/\s+/g, " ").trim();
}
