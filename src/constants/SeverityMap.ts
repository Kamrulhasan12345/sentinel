export enum TriageLevel {
  CRITICAL = "CRITICAL", // Life-threatening
  URGENT = "URGENT", // Needs a doctor soon
  ROUTINE = "ROUTINE", // Home care
}

export const SEVERITY_MAP: Record<string, TriageLevel> = {
  // Critical - Immediate Escalation
  choking: TriageLevel.CRITICAL,
  chest_pain: TriageLevel.CRITICAL,
  stroke: TriageLevel.CRITICAL,
  difficulty_breathing: TriageLevel.CRITICAL,
  unconscious_unresponsive: TriageLevel.CRITICAL,
  severe_bleeding: TriageLevel.CRITICAL,

  // Urgent - Professional help needed
  fracture: TriageLevel.URGENT,
  poisoning: TriageLevel.URGENT,
  internal_bleeding: TriageLevel.URGENT,
  deep_cuts: TriageLevel.URGENT,

  // Routine - First Aid enough
  abrasions: TriageLevel.ROUTINE,
  nosebleed: TriageLevel.ROUTINE,
  sunburn: TriageLevel.ROUTINE,
};
