export type FeedbackChoice = 'interested' | 'not_interested';

export interface FeedbackProposalState {
  choice: FeedbackChoice | null;
  comment: string;
}

export interface ClientFeedbackPayload {
  schemaVersion: number;
  proposals: Record<string, FeedbackProposalState>;
  futureToolsComment: string;
}

export interface ClientFeedbackRecord {
  id: string;
  user_id: string;
  feedback: ClientFeedbackPayload;
  created_at: string;
}

export interface FeedbackLoadResponse {
  feedback: ClientFeedbackPayload | null;
  createdAt: string | null;
}

export interface FeedbackSaveResponse {
  success: boolean;
  id: string;
  createdAt: string;
  emailSent: boolean;
}
