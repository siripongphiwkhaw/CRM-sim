export const DEAL_STAGES = [
  "New",
  "Contacted",
  "Qualified",
  "Proposal",
  "Won",
  "Lost",
] as const;

export type DealStage = (typeof DEAL_STAGES)[number];

export const TASK_TYPES = [
  "call",
  "email",
  "note",
  "meeting",
  "follow_up",
] as const;

export type TaskType = (typeof TASK_TYPES)[number];

export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  call: "Call",
  email: "Email",
  note: "Note",
  meeting: "Meeting",
  follow_up: "Follow-up",
};
