#!/usr/bin/env tsx
/**
 * Omnysync Test Report Generator
 *
 * Runs vitest with JSON reporter, parses the output, and generates a
 * comprehensive Markdown report with summary, per-file results, and
 * duration breakdown.
 *
 * Usage:
 *   npx tsx tests/generate-report.ts
 *   npx tsx tests/generate-report.ts --coverage   # also parses coverage summary
 */

import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

interface AssertionResult {
  ancestorTitles: string[];
  fullName: string;
  status: "passed" | "failed" | "pending" | "todo";
  title: string;
  duration: number;
  failureMessages: string[];
  meta: Record<string, unknown>;
  tags: string[];
}

interface TestResult {
  assertionResults: AssertionResult[];
  startTime: number;
  endTime: number;
  status: "passed" | "failed" | "pending";
  message: string;
  name: string;
}

interface VitestJsonOutput {
  numTotalTestSuites: number;
  numPassedTestSuites: number;
  numFailedTestSuites: number;
  numPendingTestSuites: number;
  numTotalTests: number;
  numPassedTests: number;
  numFailedTests: number;
  numPendingTests: number;
  numTodoTests: number;
  startTime: number;
  success: boolean;
  testResults: TestResult[];
}

interface CoverageSummary {
  totalLines: number;
  coveredLines: number;
  totalBranches: number;
  coveredBranches: number;
  totalFunctions: number;
  coveredFunctions: number;
  totalStatements: number;
  coveredStatements: number;
}

function runVitest(includeCoverage: boolean): VitestJsonOutput {
  const args = ["vitest", "run", "--reporter=json"];

  if (includeCoverage) {
    args.push("--coverage");
  }

  console.log(`Running: npx ${args.join(" ")}`);

  const stdout = execSync(`npx ${args.join(" ")}`, {
    cwd: resolve(process.cwd()),
    encoding: "utf-8",
    maxBuffer: 50 * 1024 * 1024, // 50 MB
    env: {
      ...process.env,
      CI: "true",
    },
  });

  // Vitest JSON output is on the last line
  const lines = stdout.trim().split("\n");
  const jsonLine = lines[lines.length - 1];

  try {
    return JSON.parse(jsonLine) as VitestJsonOutput;
  } catch {
    // Try the entire output as JSON (some versions output only JSON)
    return JSON.parse(stdout) as VitestJsonOutput;
  }
}

function tryParseCoverage(): CoverageSummary | null {
  // Try to find and parse vitest coverage summary from coverage directory
  const coverageDir = resolve(process.cwd(), "coverage");
  const coverageJsonPath = resolve(coverageDir, "coverage-final.json");

  if (existsSync(coverageJsonPath)) {
    try {
      const coverageData = JSON.parse(readFileSync(coverageJsonPath, "utf-8"));
      let totalLines = 0;
      let coveredLines = 0;
      let totalBranches = 0;
      let coveredBranches = 0;
      let totalFunctions = 0;
      let coveredFunctions = 0;
      let totalStatements = 0;
      let coveredStatements = 0;

      for (const filePath of Object.keys(coverageData)) {
        const fileCoverage = coverageData[filePath];
        if (fileCoverage?.s) {
          const stmts = Object.values(fileCoverage.s) as number[];
          totalStatements += stmts.length;
          coveredStatements += stmts.filter((c) => c > 0).length;
        }
        if (fileCoverage?.f) {
          const funcs = Object.values(fileCoverage.f) as number[];
          totalFunctions += funcs.length;
          coveredFunctions += funcs.filter((c) => c > 0).length;
        }
        if (fileCoverage?.b) {
          for (const branchHits of Object.values(
            fileCoverage.b,
          ) as number[][]) {
            totalBranches += branchHits.length;
            coveredBranches += branchHits.filter((c) => c > 0).length;
          }
        }
        if (fileCoverage?.l) {
          const lines_ = Object.values(fileCoverage.l) as number[];
          totalLines += lines_.length;
          coveredLines += lines_.filter((c) => c > 0).length;
        }
      }

      return {
        totalLines,
        coveredLines,
        totalBranches,
        coveredBranches,
        totalFunctions,
        coveredFunctions,
        totalStatements,
        coveredStatements,
      };
    } catch {
      return null;
    }
  }

  // Try clover.xml or lcov for summary
  const lcovPath = resolve(coverageDir, "lcov.info");
  if (existsSync(lcovPath)) {
    try {
      const lcov = readFileSync(lcovPath, "utf-8");
      const lhMatches = lcov.match(/^LH:(\d+)$/gm);
      const lfMatches = lcov.match(/^LF:(\d+)$/gm);
      if (lhMatches && lfMatches) {
        const covered = lhMatches.reduce(
          (sum: number, m: string) => sum + parseInt(m.split(":")[1], 10),
          0,
        );
        const found = lfMatches.reduce(
          (sum: number, m: string) => sum + parseInt(m.split(":")[1], 10),
          0,
        );
        return {
          totalLines: found,
          coveredLines: covered,
          totalBranches: 0,
          coveredBranches: 0,
          totalFunctions: 0,
          coveredFunctions: 0,
          totalStatements: 0,
          coveredStatements: 0,
        };
      }
    } catch {
      return null;
    }
  }

  return null;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = ((ms % 60000) / 1000).toFixed(1);
  return `${minutes}m ${seconds}s`;
}

function categorizeTestFile(filePath: string): string {
  const normalized = filePath.replace(/\\/g, "/");
  if (normalized.includes("/omnysync-web/")) return "Web App";
  if (normalized.includes("/packages/omnysync-core/")) return "Core Package";
  if (normalized.includes("/packages/")) return "Other Package";
  if (normalized.includes("/omnysync-mobile/")) return "Mobile App";
  if (normalized.includes("/omnysync-desktop/")) return "Desktop App";
  if (normalized.includes("/omnysync-extension/")) return "Extension";
  return "Other";
}

function getRelativePath(filePath: string): string {
  const normalized = filePath.replace(/\\/g, "/");
  const root = process.cwd().replace(/\\/g, "/");
  return normalized.replace(root + "/", "");
}

function generateReport(
  data: VitestJsonOutput,
  includeCoverage: boolean,
): string {
  const lines: string[] = [];
  const now = new Date().toISOString().split("T")[0];

  lines.push("# Omnysync Test Report");
  lines.push("");
  lines.push(`**Generated:** ${now}`);
  lines.push(`**Duration:** ${formatDuration(Date.now() - data.startTime)}`);
  lines.push("");
  lines.push("---");
  lines.push("");

  // ── Summary ─────────────────────────────────────────────────────────────
  lines.push("## Executive Summary");
  lines.push("");
  lines.push("| Metric | Value |");
  lines.push("|--------|-------|");

  const totalSuites = data.numTotalTestSuites;
  const passedSuites = data.numPassedTestSuites;
  const failedSuites = data.numFailedTestSuites;
  const pendingSuites = data.numPendingTestSuites;

  lines.push(`| **Total Test Suites** | ${totalSuites} |`);
  lines.push(`| Passed | ${passedSuites} |`);
  if (failedSuites > 0) lines.push(`| **Failed** | **${failedSuites}** |`);
  if (pendingSuites > 0) lines.push(`| Pending | ${pendingSuites} |`);
  lines.push(`| **Total Tests** | ${data.numTotalTests} |`);
  lines.push(`| **Passed** | **${data.numPassedTests}** |`);
  if (data.numFailedTests > 0)
    lines.push(`| **Failed** | **${data.numFailedTests}** |`);
  if (data.numPendingTests > 0)
    lines.push(`| Pending | ${data.numPendingTests} |`);
  if (data.numTodoTests > 0) lines.push(`| Todo | ${data.numTodoTests} |`);

  const passRate =
    data.numTotalTests > 0
      ? ((data.numPassedTests / data.numTotalTests) * 100).toFixed(1)
      : "N/A";
  lines.push(`| **Pass Rate** | **${passRate}%** |`);
  lines.push(`| **Status** | ${data.success ? "✅ PASS" : "❌ FAIL"} |`);
  lines.push("");

  // ── Coverage ─────────────────────────────────────────────────────────────
  if (includeCoverage) {
    const coverage = tryParseCoverage();
    if (coverage) {
      lines.push("## Coverage Summary");
      lines.push("");
      lines.push("| Metric | Covered | Total | Rate |");
      lines.push("|--------|---------|-------|------|");

      if (coverage.totalLines > 0) {
        const rate = (
          (coverage.coveredLines / coverage.totalLines) *
          100
        ).toFixed(1);
        lines.push(
          `| Lines | ${coverage.coveredLines} | ${coverage.totalLines} | ${rate}% |`,
        );
      }
      if (coverage.totalStatements > 0) {
        const rate = (
          (coverage.coveredStatements / coverage.totalStatements) *
          100
        ).toFixed(1);
        lines.push(
          `| Statements | ${coverage.coveredStatements} | ${coverage.totalStatements} | ${rate}% |`,
        );
      }
      if (coverage.totalBranches > 0) {
        const rate = (
          (coverage.coveredBranches / coverage.totalBranches) *
          100
        ).toFixed(1);
        lines.push(
          `| Branches | ${coverage.coveredBranches} | ${coverage.totalBranches} | ${rate}% |`,
        );
      }
      if (coverage.totalFunctions > 0) {
        const rate = (
          (coverage.coveredFunctions / coverage.totalFunctions) *
          100
        ).toFixed(1);
        lines.push(
          `| Functions | ${coverage.coveredFunctions} | ${coverage.totalFunctions} | ${rate}% |`,
        );
      }
      lines.push("");
    } else {
      lines.push("## Coverage Summary");
      lines.push("");
      lines.push(
        "> ⚠️ Coverage data not found. Run with `--coverage` flag first.",
      );
      lines.push("");
    }
  }

  // ── Per-category breakdown ──────────────────────────────────────────────
  const categories: Record<
    string,
    {
      files: string[];
      passed: number;
      failed: number;
      pending: number;
      total: number;
    }
  > = {};

  for (const result of data.testResults) {
    const cat = categorizeTestFile(result.name);
    if (!categories[cat]) {
      categories[cat] = {
        files: [],
        passed: 0,
        failed: 0,
        pending: 0,
        total: 0,
      };
    }
    categories[cat].files.push(result.name);
    for (const assertion of result.assertionResults) {
      categories[cat].total++;
      if (assertion.status === "passed") categories[cat].passed++;
      else if (assertion.status === "failed") categories[cat].failed++;
      else if (assertion.status === "pending") categories[cat].pending++;
    }
  }

  lines.push("## Category Breakdown");
  lines.push("");
  lines.push(
    "| Category | Files | Tests | Passed | Failed | Pending | Pass Rate |",
  );
  lines.push(
    "|----------|-------|-------|--------|--------|---------|-----------|",
  );

  for (const [cat, stats] of Object.entries(categories).sort()) {
    const rate =
      stats.total > 0 ? ((stats.passed / stats.total) * 100).toFixed(1) : "N/A";
    lines.push(
      `| ${cat} | ${stats.files.length} | ${stats.total} | ${stats.passed} | ${stats.failed} | ${stats.pending} | ${rate}% |`,
    );
  }
  lines.push("");

  // ── Per-file results ─────────────────────────────────────────────────────
  lines.push("## Test File Results");
  lines.push("");
  lines.push(
    "| # | File | Status | Tests | Passed | Failed | Pending | Duration |",
  );
  lines.push(
    "|---|------|--------|-------|--------|--------|---------|----------|",
  );

  const sortedResults = [...data.testResults].sort((a, b) =>
    getRelativePath(a.name).localeCompare(getRelativePath(b.name)),
  );

  let fileIndex = 0;
  for (const result of sortedResults) {
    fileIndex++;
    const relativePath = getRelativePath(result.name);
    const totalAssertions = result.assertionResults.length;
    const passed = result.assertionResults.filter(
      (a) => a.status === "passed",
    ).length;
    const failed = result.assertionResults.filter(
      (a) => a.status === "failed",
    ).length;
    const pending = result.assertionResults.filter(
      (a) => a.status === "pending",
    ).length;
    const duration = result.endTime - result.startTime;

    let statusIcon = "✅";
    if (failed > 0) statusIcon = "❌";
    else if (pending > 0 && passed === 0) statusIcon = "⏭️";
    else if (pending > 0) statusIcon = "⚠️";

    lines.push(
      `| ${fileIndex} | \`${relativePath}\` | ${statusIcon} | ${totalAssertions} | ${passed} | ${failed} | ${pending} | ${formatDuration(duration)} |`,
    );
  }
  lines.push("");

  // ── Failed test details ───────────────────────────────────────────────────
  const failedTests = data.testResults.flatMap((r) =>
    r.assertionResults.filter((a) => a.status === "failed"),
  );

  if (failedTests.length > 0) {
    lines.push("## Failed Test Details");
    lines.push("");
    lines.push("> ⚠️ The following tests failed:");
    lines.push("");

    for (const test of failedTests) {
      lines.push(`### ❌ ${test.fullName}`);
      lines.push("");
      lines.push(`- **File:** \`${test.ancestorTitles.join(" > ")}\``);
      lines.push(`- **Duration:** ${formatDuration(test.duration)}`);
      lines.push("");
      if (test.failureMessages.length > 0) {
        lines.push("```");
        lines.push(test.failureMessages.join("\n\n"));
        lines.push("```");
        lines.push("");
      }
    }
  }

  // ── Skipped test suites ──────────────────────────────────────────────────
  const skippedFiles = data.testResults.filter((r) => r.status === "pending");
  if (skippedFiles.length > 0) {
    lines.push("## Skipped Test Suites");
    lines.push("");
    for (const file of skippedFiles) {
      lines.push(`- ⏭️ \`${getRelativePath(file.name)}\``);
    }
    lines.push("");
  }

  // ── Slowest tests ─────────────────────────────────────────────────────────
  const allAssertions = data.testResults.flatMap((r) => r.assertionResults);
  const slowest = [...allAssertions]
    .sort((a, b) => b.duration - a.duration)
    .slice(0, 10);

  if (slowest.length > 0) {
    lines.push("## Slowest Tests (Top 10)");
    lines.push("");
    lines.push("| # | Test | Duration |");
    lines.push("|---|------|----------|");
    slowest.forEach((test, i) => {
      lines.push(
        `| ${i + 1} | \`${test.fullName}\` | ${formatDuration(test.duration)} |`,
      );
    });
    lines.push("");
  }

  // ── Environment ──────────────────────────────────────────────────────────
  lines.push("## Environment");
  lines.push("");
  lines.push(`- **Node.js:** ${process.version}`);
  lines.push(`- **Platform:** ${process.platform} ${process.arch}`);
  lines.push(`- **Date:** ${now}`);
  lines.push(
    `- **Total Duration:** ${formatDuration(Date.now() - data.startTime)}`,
  );
  lines.push("");

  return lines.join("\n");
}

// ── Main ───────────────────────────────────────────────────────────────────
function main() {
  const args = process.argv.slice(2);
  const includeCoverage = args.includes("--coverage");

  const reportsDir = resolve(process.cwd(), "tests", "reports");
  if (!existsSync(reportsDir)) {
    mkdirSync(reportsDir, { recursive: true });
  }

  console.log("🧪 Omnysync Test Report Generator");
  console.log("──────────────────────────────────");
  console.log("");

  try {
    const data = runVitest(includeCoverage);
    const report = generateReport(data, includeCoverage);

    const reportPath = resolve(
      reportsDir,
      `test-report-${new Date().toISOString().split("T")[0]}.md`,
    );
    writeFileSync(reportPath, report, "utf-8");

    console.log(`\n✅ Report generated: ${reportPath}`);
    console.log(
      `   Tests: ${data.numPassedTests}/${data.numTotalTests} passed`,
    );
    console.log(`   Skipped: ${data.numPendingTests}`);
    if (data.numFailedTests > 0) {
      console.log(`   ❌ Failed: ${data.numFailedTests}`);
    }

    // Exit with non-zero if any tests failed
    process.exit(data.success ? 0 : 1);
  } catch (error) {
    console.error("❌ Failed to generate report:", (error as Error).message);
    process.exit(1);
  }
}

main();
