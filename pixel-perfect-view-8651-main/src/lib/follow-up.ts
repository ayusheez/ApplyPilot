import type { Application } from "./types";

export function makeFollowUpDraft(app: Pick<Application, "company" | "role" | "status">): string {
  const context = app.status === "Interview"
    ? "I am writing to follow up on the interview process and ask about the next steps."
    : app.status === "Assessment"
      ? "I am writing to ask whether there are any updates or next steps regarding the assessment process."
      : app.status === "Offer"
        ? "Thank you for the offer. I would appreciate clarification on the next steps and any response deadline."
        : app.status === "Rejected"
          ? "Thank you for considering my application. If you are able to share feedback, I would appreciate the opportunity to learn from it."
          : app.status === "Withdrawn"
            ? "I am writing regarding my withdrawn application. Please let me know if any further information is needed."
            : "I am writing to ask whether there are any updates on my application or next steps in the hiring process.";
  return `Subject: Follow-up on ${app.role} application at ${app.company}

Hello ${app.company} hiring team,

${context}

The position is ${app.role} at ${app.company}. Please let me know if you need any additional information from me.

Thank you for your time.

Best regards,
[Your name]`;
}
