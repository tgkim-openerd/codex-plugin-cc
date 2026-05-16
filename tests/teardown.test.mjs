import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { makeTempDir, trackBrokerSessionDir, sweepTrackedBrokers } from "./helpers.mjs";

// PR-0.1 (#163) regression: test infrastructure must not accumulate orphan
// broker session directories under os.tmpdir(). Each makeTempDir() call is now
// registered and swept by process exit hooks; the explicit sweep API is also
// exposed so tests can force-cleanup mid-run.

test("makeTempDir registers workspaces so sweepTrackedBrokers can drop a fake broker session", () => {
  const workspace = makeTempDir();
  assert.equal(fs.existsSync(workspace), true, "workspace dir created");

  // Simulate a broker session by writing the canonical broker.json + dir that
  // loadBrokerSession would find.
  const sessionDir = fs.mkdtempSync(path.join(os.tmpdir(), "cxc-"));
  fs.writeFileSync(path.join(sessionDir, "broker.pid"), "0\n", "utf8");
  fs.writeFileSync(path.join(sessionDir, "broker.log"), "", "utf8");

  const stateDir = path.join(workspace, ".codex-plugin-state");
  fs.mkdirSync(stateDir, { recursive: true });
  fs.writeFileSync(
    path.join(stateDir, "broker.json"),
    JSON.stringify({
      endpoint: `unix:${sessionDir}/broker.sock`,
      pidFile: path.join(sessionDir, "broker.pid"),
      logFile: path.join(sessionDir, "broker.log"),
      sessionDir,
      pid: 0
    }),
    "utf8"
  );
  trackBrokerSessionDir(sessionDir);

  sweepTrackedBrokers();

  assert.equal(fs.existsSync(sessionDir), false, "broker session dir removed by sweep");
});

test("sweepTrackedBrokers is idempotent when there is nothing to clean", () => {
  // Calling twice with no registered workspaces should not throw.
  sweepTrackedBrokers();
  sweepTrackedBrokers();
});

test("sweepTrackedBrokers tolerates missing broker session directories", () => {
  const workspace = makeTempDir();
  const sessionDir = path.join(os.tmpdir(), `cxc-missing-${process.pid}`);
  trackBrokerSessionDir(sessionDir);
  // Directory intentionally never created.
  sweepTrackedBrokers();
  assert.equal(fs.existsSync(workspace), true, "workspace itself is not deleted by sweep");
});
