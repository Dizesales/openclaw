import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

function readAutomationWorkflow(path: string) {
  return parse(readFileSync(path, "utf8"));
}

describe("ci workflow guards", () => {
  it("uses the scoped workflow token when GitHub App credentials are unavailable", () => {
    const workflowPaths = [".github/workflows/auto-response.yml", ".github/workflows/labeler.yml"];
    const expectedToken =
      "${{ steps.app-token.outputs.token || steps.app-token-fallback.outputs.token || github.token }}";

    for (const workflowPath of workflowPaths) {
      const workflow = readAutomationWorkflow(workflowPath);

      for (const [jobName, job] of Object.entries<Record<string, unknown>>(workflow.jobs)) {
        const steps = (job.steps ?? []) as Array<Record<string, unknown>>;
        const fallbackStep = steps.find((step) => step.id === "app-token-fallback");

        expect(fallbackStep?.["continue-on-error"], `${workflowPath}:${jobName}`).toBe(true);

        for (const step of steps) {
          const inputs = step.with as Record<string, unknown> | undefined;
          for (const inputName of ["github-token", "repo-token"]) {
            const token = inputs?.[inputName];
            if (typeof token === "string" && token.includes("steps.app-token.outputs.token")) {
              expect(token, `${workflowPath}:${jobName}:${inputName}`).toBe(expectedToken);
            }
          }
        }
      }
    }
  });

  it("runs dependency policy guards in PR CI preflight", () => {
    const workflow = readFileSync(".github/workflows/ci.yml", "utf8");
    const preflightGuards = workflow.slice(
      workflow.indexOf("guards)"),
      workflow.indexOf("prod-types)"),
    );

    expect(workflow).toContain("check-guards");
    expect(preflightGuards).toContain("pnpm deps:shrinkwrap:check");
    expect(preflightGuards).toContain("pnpm deps:patches:check");
  });

  it("keeps push docs validation ClawHub-backed", () => {
    const workflow = readFileSync(".github/workflows/docs.yml", "utf8");

    expect(workflow).toContain("repository: openclaw/clawhub");
    expect(workflow).toContain("path: clawhub-source");
    expect(workflow).toContain(
      "OPENCLAW_DOCS_SYNC_CLAWHUB_REPO: ${{ github.workspace }}/clawhub-source",
    );
  });
});
