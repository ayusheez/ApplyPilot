export const STATUSES = ["Applied", "Assessment", "Interview", "Offer", "Rejected", "Withdrawn"] as const;
export type ApplicationStatus = (typeof STATUSES)[number];

export type TimelineEventType = "created" | "status" | "edit" | "note" | "import";

export interface TimelineEvent {
  id: string;
  date: string; // ISO datetime
  type: TimelineEventType;
  status?: ApplicationStatus;
  description: string;
}

export interface EmailImport {
  id: string;
  subject: string;
  sender?: string;
  receivedAt?: string; // YYYY-MM-DD
  body: string;
  importedAt: string; // ISO datetime
  applicationId?: string;
}

export interface Application {
  id: string;
  company: string;
  role: string;
  jobUrl?: string;
  appliedOn: string; // YYYY-MM-DD
  status: ApplicationStatus;
  interviewDate?: string;
  followUpDate?: string;
  nextAction?: string;
  notes: string;
  lastUpdated: string; // ISO datetime
  timeline: TimelineEvent[];
  sourceEmails: EmailImport[];
}

export type ApplicationInput = Omit<Application, "id" | "lastUpdated" | "timeline" | "sourceEmails">;

export interface EmailInput {
  subject: string;
  sender?: string;
  receivedAt?: string;
  body: string;
}

export interface ExtractedField<T = string> {
  value: T | null;
  excerpt: string | null;
}

export interface ExtractionResult {
  warnings?: string[];
  company: ExtractedField;
  role: ExtractedField;
  status: ExtractedField<ApplicationStatus>;
  interviewDate: ExtractedField;
  followUpDate: ExtractedField;
  nextAction: ExtractedField;
  matchedApplicationId: string | null;
}

export type AnalysisResponse =
  | { kind: "duplicate"; applicationId: string; company: string; role: string }
  | { kind: "result"; extraction: ExtractionResult };

export interface ImportSaveRequest {
  gmailJobId?: string;
  updateFields?: boolean;
  email: EmailInput;
  fields: {
    company: string;
    role: string;
    status: ApplicationStatus;
    interviewDate?: string;
    followUpDate?: string;
    nextAction?: string;
  };
  targetApplicationId: string | null; // null = create new
}
