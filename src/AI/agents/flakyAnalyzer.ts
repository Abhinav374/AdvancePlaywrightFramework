export type BuildSummary = {
  runId: string;
  tests: Record<string, 'passed' | 'failed' | 'skipped' | 'timedOut'>;
};

export type FlakyResult = {
  flaky: string[];
  summary?: string;
  counts: {
    flaky: number;
    failing: number;
    total: number;
  };
};

export async function analyzeFlaky(
  prev: BuildSummary | undefined,
  curr: BuildSummary,
  _hasApiKey: boolean,
): Promise<FlakyResult> {
  const total = Object.keys(curr.tests).length;
  const flaky: string[] = [];

  if (!prev) {
    return {
      flaky,
      summary: 'Only one build snapshot is available, so no flaky comparison was performed.',
      counts: { flaky: 0, failing: 0, total },
    };
  }

  const prevTests = prev.tests;
  const currTests = curr.tests;

  for (const [name, currStatus] of Object.entries(currTests)) {
    const prevStatus = prevTests[name];
    if (prevStatus && prevStatus !== currStatus && (currStatus === 'failed' || currStatus === 'timedOut')) {
      flaky.push(name);
    }
  }

  return {
    flaky,
    summary: 'This local fallback analysis compared the latest snapshot against the previous build.',
    counts: {
      flaky: flaky.length,
      failing: Object.values(currTests).filter((status) => status === 'failed' || status === 'timedOut').length,
      total,
    },
  };
}
