import type { Application, EmailInput } from "./types";

export function isoDay(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}
function isoAt(offsetDays: number, hour = 10): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

const duplicateEmail: EmailInput = {
  subject: "Your application to Quarry Lane Logistics",
  sender: "careers@quarrylane.example",
  body: "Hi Sam,\n\nThank you for applying to Quarry Lane Logistics for the Operations Analyst position. Our team is reviewing applications and will be in touch.\n\nBest,\nQuarry Lane Talent Team",
};

export function seedApplications(): Application[] {
  return [
    {
      id: "app-1",
      company: "Northwind Analytics",
      role: "Data Analyst",
      jobUrl: "https://jobs.northwind.example/data-analyst",
      appliedOn: isoDay(-18),
      status: "Assessment",
      followUpDate: isoDay(2),
      nextAction: "Complete SQL take-home",
      notes: "Referred by Priya. Team uses dbt and Looker.",
      lastUpdated: isoAt(-4),
      timeline: [
        { id: "t1", date: isoAt(-18), type: "created", status: "Applied", description: "Application added" },
        { id: "t2", date: isoAt(-4), type: "status", status: "Assessment", description: "Status changed to Assessment" },
      ],
      sourceEmails: [],
    },
    {
      id: "app-2",
      company: "Halden & Pike",
      role: "Junior Product Designer",
      jobUrl: "https://haldenpike.example/careers/123",
      appliedOn: isoDay(-25),
      status: "Interview",
      interviewDate: isoDay(3),
      nextAction: "Prepare portfolio walkthrough",
      notes: "Second round with design lead.",
      lastUpdated: isoAt(-2),
      timeline: [
        { id: "t3", date: isoAt(-25), type: "created", status: "Applied", description: "Application added" },
        { id: "t4", date: isoAt(-10), type: "status", status: "Interview", description: "Status changed to Interview" },
        { id: "t5", date: isoAt(-2), type: "edit", description: "Interview date set" },
      ],
      sourceEmails: [],
    },
    {
      id: "app-3",
      company: "Quarry Lane Logistics",
      role: "Operations Analyst",
      appliedOn: isoDay(-9),
      status: "Applied",
      followUpDate: isoDay(-1),
      nextAction: "Send follow-up note",
      notes: "",
      lastUpdated: isoAt(-9),
      timeline: [
        { id: "t6", date: isoAt(-9), type: "import", status: "Applied", description: "Created from imported email" },
      ],
      sourceEmails: [
        { id: "em-seed", ...duplicateEmail, receivedAt: isoDay(-9), importedAt: isoAt(-9), applicationId: "app-3" },
      ],
    },
    {
      id: "app-4",
      company: "Bramble Software",
      role: "Frontend Developer",
      appliedOn: isoDay(-40),
      status: "Rejected",
      notes: "Feedback: looking for more testing experience.",
      lastUpdated: isoAt(-20),
      timeline: [
        { id: "t7", date: isoAt(-40), type: "created", status: "Applied", description: "Application added" },
        { id: "t8", date: isoAt(-20), type: "status", status: "Rejected", description: "Status changed to Rejected" },
      ],
      sourceEmails: [],
    },
    {
      id: "app-5",
      company: "Copperline Energy",
      role: "Business Analyst",
      appliedOn: isoDay(-32),
      status: "Offer",
      followUpDate: isoDay(5),
      nextAction: "Reply to offer by deadline",
      notes: "Offer received. Compare with other processes.",
      lastUpdated: isoAt(-1),
      timeline: [
        { id: "t9", date: isoAt(-32), type: "created", status: "Applied", description: "Application added" },
        { id: "t10", date: isoAt(-15), type: "status", status: "Interview", description: "Status changed to Interview" },
        { id: "t11", date: isoAt(-1), type: "status", status: "Offer", description: "Status changed to Offer" },
      ],
      sourceEmails: [],
    },
    {
      id: "app-6",
      company: "Tidewater Media",
      role: "Content Strategist",
      appliedOn: isoDay(-14),
      status: "Withdrawn",
      notes: "Withdrew — role moved to on-site only.",
      lastUpdated: isoAt(-6),
      timeline: [
        { id: "t12", date: isoAt(-14), type: "created", status: "Applied", description: "Application added" },
        { id: "t13", date: isoAt(-6), type: "status", status: "Withdrawn", description: "Status changed to Withdrawn" },
      ],
      sourceEmails: [],
    },
  ];
}

export interface SampleEmail extends EmailInput {
  label: string;
}

function longDate(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

export function sampleEmails(): SampleEmail[] {
  return [
    {
      label: "Interview invitation",
      subject: "Interview invitation – Data Analyst",
      sender: "recruiting@northwind.example",
      receivedAt: isoDay(0),
      body: `Hi Sam,\n\nThanks for completing the assessment for the Data Analyst role at Northwind Analytics. We'd like to invite you to an interview on ${longDate(6)} at 14:00 via video call.\n\nPlease confirm your availability by ${longDate(2)}.\n\nKind regards,\nElena Ruiz\nNorthwind Analytics Recruiting`,
    },
    {
      label: "New application confirmation",
      subject: "Application received: Clinical Data Coordinator",
      sender: "no-reply@fernleafhealth.example",
      receivedAt: isoDay(0),
      body: `Dear Sam,\n\nThank you for applying to Fernleaf Health for the Clinical Data Coordinator position. We have received your application and our hiring team will review it shortly.\n\nIf we have not been in touch by ${longDate(10)}, feel free to follow up.\n\nFernleaf Health Talent Acquisition`,
    },
    {
      label: "Rejection notice",
      subject: "Update on your application",
      sender: "talent@haldenpike.example",
      receivedAt: isoDay(0),
      body: "Hi Sam,\n\nThank you for your time interviewing for the Junior Product Designer role at Halden & Pike. Unfortunately, we have decided not to move forward with your application at this time.\n\nWe wish you the best in your search.\n\nHalden & Pike",
    },
    { label: "Duplicate check (import twice)", ...duplicateEmail },
  ];
}
