/**
 * Report generator for MCP conformance testing
 */

import * as core from "@actions/core";
import * as fs from "fs";
import * as path from "path";
import type { TestResult, ConformanceReport } from "./types.js";

/**
 * Generate a conformance report from test results
 */
export function generateReport(
  results: TestResult[],
  currentBranch: string,
  compareRef: string
): ConformanceReport {
  const totalBranchTime = results.reduce((sum, r) => sum + r.branchTime, 0);
  const totalBaseTime = results.reduce((sum, r) => sum + r.baseTime, 0);
  const passedCount = results.filter((r) => !r.hasDifferences).length;
  const diffCount = results.filter((r) => r.hasDifferences).length;

  return {
    generatedAt: new Date().toISOString(),
    currentBranch,
    compareRef,
    results,
    totalBranchTime,
    totalBaseTime,
    passedCount,
    diffCount,
  };
}

/**
 * Generate markdown report
 */
export function generateMarkdownReport(report: ConformanceReport): string {
  const lines: string[] = [];

  lines.push("# MCP Conformance Test Report");
  lines.push("");
  lines.push(`**Generated:** ${report.generatedAt}`);
  lines.push(`**Current Branch:** ${report.currentBranch}`);
  lines.push(`**Compared Against:** ${report.compareRef}`);
  lines.push("");

  // Summary
  lines.push("## Summary");
  lines.push("");
  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Total Configurations | ${report.results.length} |`);
  lines.push(`| Passed | ${report.passedCount} |`);
  lines.push(`| With Differences | ${report.diffCount} |`);
  lines.push(`| Branch Total Time | ${formatTime(report.totalBranchTime)} |`);
  lines.push(`| Base Total Time | ${formatTime(report.totalBaseTime)} |`);
  lines.push("");

  // Overall status
  if (report.diffCount === 0) {
    lines.push("## ✅ All Conformance Tests Passed");
    lines.push("");
    lines.push("No API differences detected between the current branch and the comparison ref.");
  } else {
    lines.push("## ⚠️ API Differences Detected");
    lines.push("");
    lines.push(
      `${report.diffCount} configuration(s) have API differences that may indicate breaking changes.`
    );
  }
  lines.push("");

  // Per-configuration results
  lines.push("## Configuration Results");
  lines.push("");

  for (const result of report.results) {
    const statusIcon = result.hasDifferences ? "⚠️" : "✅";
    lines.push(`### ${statusIcon} ${result.configName}`);
    lines.push("");
    lines.push(`- **Transport:** ${result.transport}`);
    lines.push(`- **Branch Time:** ${formatTime(result.branchTime)}`);
    lines.push(`- **Base Time:** ${formatTime(result.baseTime)}`);
    lines.push("");

    if (result.hasDifferences) {
      lines.push("#### Differences");
      lines.push("");

      for (const [endpoint, diff] of result.diffs) {
        lines.push(`<details>`);
        lines.push(`<summary><strong>${endpoint}</strong></summary>`);
        lines.push("");
        lines.push("```diff");
        lines.push(diff);
        lines.push("```");
        lines.push("");
        lines.push("</details>");
        lines.push("");
      }
    } else {
      lines.push("No differences detected.");
      lines.push("");
    }
  }

  return lines.join("\n");
}

/**
 * Format milliseconds to human readable time
 */
function formatTime(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  const seconds = (ms / 1000).toFixed(2);
  return `${seconds}s`;
}

/**
 * Save report to file and set outputs
 */
export function saveReport(report: ConformanceReport, markdown: string, outputDir: string): void {
  // Ensure output directory exists
  const reportDir = path.join(outputDir, "conformance-report");
  fs.mkdirSync(reportDir, { recursive: true });

  // Save JSON report
  const jsonPath = path.join(reportDir, "conformance-report.json");
  fs.writeFileSync(
    jsonPath,
    JSON.stringify(
      {
        ...report,
        results: report.results.map((r) => ({
          ...r,
          diffs: Object.fromEntries(r.diffs),
        })),
      },
      null,
      2
    )
  );
  core.info(`📄 JSON report saved to: ${jsonPath}`);

  // Save markdown report
  const mdPath = path.join(reportDir, "CONFORMANCE_REPORT.md");
  fs.writeFileSync(mdPath, markdown);
  core.info(`📄 Markdown report saved to: ${mdPath}`);

  // Set outputs using GITHUB_OUTPUT file (for composite actions)
  const githubOutput = process.env.GITHUB_OUTPUT;
  if (githubOutput) {
    const status = report.diffCount > 0 ? "differences" : "passed";
    fs.appendFileSync(githubOutput, `status=${status}\n`);
    fs.appendFileSync(githubOutput, `report_path=${mdPath}\n`);
    fs.appendFileSync(githubOutput, `json_report_path=${jsonPath}\n`);
    fs.appendFileSync(githubOutput, `has_differences=${report.diffCount > 0}\n`);
    fs.appendFileSync(githubOutput, `passed_count=${report.passedCount}\n`);
    fs.appendFileSync(githubOutput, `diff_count=${report.diffCount}\n`);
  }

  // Also set via core for compatibility
  core.setOutput("report_path", mdPath);
  core.setOutput("json_report_path", jsonPath);
  core.setOutput("has_differences", report.diffCount > 0);
  core.setOutput("passed_count", report.passedCount);
  core.setOutput("diff_count", report.diffCount);
}

/**
 * Write a simple summary for PR comments
 */
export function generatePRSummary(report: ConformanceReport): string {
  const lines: string[] = [];

  if (report.diffCount === 0) {
    lines.push("## ✅ MCP Conformance: All Tests Passed");
    lines.push("");
    lines.push(
      `Tested ${report.results.length} configuration(s) - no API breaking changes detected.`
    );
  } else {
    lines.push("## ⚠️ MCP Conformance: API Differences Detected");
    lines.push("");
    lines.push(
      `**${report.diffCount}** of ${report.results.length} configuration(s) have differences.`
    );
    lines.push("");
    lines.push("### Changed Endpoints");
    lines.push("");

    for (const result of report.results.filter((r) => r.hasDifferences)) {
      lines.push(`- **${result.configName}:** ${Array.from(result.diffs.keys()).join(", ")}`);
    }

    lines.push("");
    lines.push("See the full report in the job summary for details.");
  }

  return lines.join("\n");
}
