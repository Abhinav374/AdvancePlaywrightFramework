export interface VerifiedHealCandidate {
  selector: string;
  strategy: string;
  matchCount: number;
  visible: boolean;
  reasoning: string;
}

export interface RejectedHealCandidate {
  selector: string;
  reason: string;
}

export interface HealReport {
  failedSelector: string;
  intent: string;
  verified: VerifiedHealCandidate[];
  rejected: RejectedHealCandidate[];
  unavailableReason?: string;
}
