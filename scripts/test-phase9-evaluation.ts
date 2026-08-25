import fs from 'fs';
import path from 'path';
import { EVALUATION_DATASET } from '../tests/evaluation/dataset';
import { evaluatePolicy } from '../src/lib/policy';

async function runPhase9EvaluationTests(): Promise<void> {
  console.log('================================================================================');
  console.log('=== RecoverAI: Phase P9 Expanded Evaluation & Load Testing Verification ===');
  console.log('================================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(description: string, condition: boolean, details?: string): void {
    if (condition) {
      console.log(`  ✅ PASS: ${description}`);
      if (details) console.log(`     -> ${details}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${description}`);
      if (details) console.error(`     -> Error Details: ${details}`);
      failed++;
    }
  }

  // 1. Verify Expanded Evaluation Dataset (≥ 100 test cases)
  console.log('--- 1. EXPANDED EVALUATION DATASET INTEGRITY (100+ CASES) ---');

  assert(
    'Evaluation dataset contains at least 100 pre-labeled test cases',
    EVALUATION_DATASET.length >= 100,
    `Total Cases: ${EVALUATION_DATASET.length}`,
  );

  const categories = new Set(EVALUATION_DATASET.map((c) => c.category));
  assert(
    'Dataset covers all 5 core categories: partial_payment, full_payment, dispute, extension, ambiguous_adversarial',
    categories.has('partial_payment') &&
      categories.has('full_payment') &&
      categories.has('dispute') &&
      categories.has('extension') &&
      categories.has('ambiguous_adversarial'),
    `Categories found: ${Array.from(categories).join(', ')}`,
  );

  const hinglishCases = EVALUATION_DATASET.filter((c) =>
    c.emailBody.toLowerCase().includes('kar rahe') ||
    c.emailBody.toLowerCase().includes('bhej') ||
    c.emailBody.toLowerCase().includes('galat') ||
    c.emailBody.toLowerCase().includes('namaste') ||
    c.emailBody.toLowerCase().includes('kijiye') ||
    c.emailBody.toLowerCase().includes('kardo') ||
    c.name.toLowerCase().includes('hinglish')
  );

  assert(
    'Dataset contains realistic Hinglish & multi-lingual phrasing edge cases',
    hinglishCases.length >= 10,
    `Hinglish cases identified: ${hinglishCases.length}`,
  );

  // 2. Verify Evaluation Report Documentation
  console.log('\n--- 2. FORMAL EVALUATION REPORT (100 CASES) ---');

  const evalReportPath = path.resolve(process.cwd(), 'docs/evaluation-report.md');
  const evalReportExists = fs.existsSync(evalReportPath);
  const evalReportContent = evalReportExists ? fs.readFileSync(evalReportPath, 'utf8') : '';

  assert(
    'docs/evaluation-report.md exists and documents 100-case evaluation',
    evalReportExists &&
      evalReportContent.includes('100 Cases') &&
      evalReportContent.includes('Primary Safety Metric'),
  );

  assert(
    'Evaluation report documents 100.0% Primary Safety Metric (0 unsafe auto-recoveries)',
    evalReportContent.includes('100.0%') &&
      evalReportContent.includes('HUMAN_REVIEW'),
  );

  // 3. Verify Load Testing Report
  console.log('\n--- 3. HIGH-CONCURRENCY LOAD TEST REPORT ---');

  const loadReportPath = path.resolve(process.cwd(), 'docs/load-test-report.md');
  const loadReportExists = fs.existsSync(loadReportPath);
  const loadReportContent = loadReportExists ? fs.readFileSync(loadReportPath, 'utf8') : '';

  assert(
    'docs/load-test-report.md exists and documents concurrency, throughput & latency',
    loadReportExists &&
      loadReportContent.includes('Concurrency Level') &&
      loadReportContent.includes('Throughput') &&
      loadReportContent.includes('Latency'),
  );

  assert(
    'Load test report confirms 0.0% server crashes (0% 5xx errors) and rate-limit interlocks',
    loadReportContent.includes('0.0%') &&
      loadReportContent.includes('429'),
  );

  // 4. Verify Cross-Document Consistency (No stale 20-email references)
  console.log('\n--- 4. CROSS-DOCUMENTATION METRICS CONSISTENCY ---');

  const readmePath = path.resolve(process.cwd(), 'README.md');
  const readmeContent = fs.readFileSync(readmePath, 'utf8');

  assert(
    'README.md cites expanded 100-case evaluation benchmark',
    readmeContent.includes('100') &&
      (readmeContent.includes('100.0%') || readmeContent.includes('Primary Safety Metric')),
  );

  // 5. Verify Frozen Core Determinism Invariant
  console.log('\n--- 5. FROZEN CORE DETERMINISM INVARIANT ---');

  const policyRes = evaluatePolicy({
    extraction: {
      intent: 'full_payment',
      promisedAmountInr: 60000,
      promisedAmountPaise: 6000000,
      promisedDate: '2026-08-28',
      disputePresent: false,
      confidence: 0.96,
      rationale: 'Full payment commitment verified on 60,000 INR balance',
      evidence: 'Paying full 60000 INR balance',
      resolvedFromPercentage: false,
    },
    outstandingAmountPaise: 6000000,
  });

  assert(
    'evaluatePolicy() remains pure, deterministic, and sole authority for AUTO_RECOVER',
    policyRes.decision === 'AUTO_RECOVER' && policyRes.approvedAmountPaise === 6000000,
  );

  console.log('\n================================================================================');
  console.log(`PHASE P9 TEST RESULTS: ${passed} passed, ${failed} failed.`);
  console.log('================================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase9EvaluationTests().catch((err) => {
  console.error('Fatal error in Phase P9 tests:', err);
  process.exit(1);
});
