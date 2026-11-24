export type RcaVerdict = {
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  rootCause: string;
  fixes: string[];
};

export async function analyzeFailure(input: {
  title: string;
  file: string;
  error: string;
  stack?: string;
}): Promise<RcaVerdict> {
  const errorText = input.error || 'Unknown error';
  return {
    severity: 'MEDIUM',
    priority: 'P2',
    rootCause: `The failure was reported in ${input.file}. The exact issue was: ${errorText}.`,
    fixes: [
      'Review the failure logs and reproduce the issue in the same environment.',
      'Check for a recent code or configuration change in the affected area.',
      'If the failure is intermittent, add a focused retry or stability assertion.',
    ],
  };
}
