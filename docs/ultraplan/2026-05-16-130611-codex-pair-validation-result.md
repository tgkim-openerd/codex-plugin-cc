# Codex Independent Audit codex-plugin-cc v1.0.4 to v1.1.0 ULTRAPLAN

## 1. Plan Completeness Audit

```yaml
claim: "분류=missing/partial: gh API는 로컬에서 차단되어 Web fallback으로 #113 #117 #134 #135 #141 #205 #208 #210 #215 #223 #229 #263 #275 #283 #309 #321 등 16개 issue body를 샘플링했다. 이 중 #113 설치 차단과 #309 최신 gpt-5.5/CLI 0.130 재현은 구현 ULTRAPLAN에 추적 행이 없다."
verification_command: "gh issue list --repo openai/codex-plugin-cc --state open --limit 100; rg -n '113|309|321|283' docs/ultraplan/2026-05-16-130611-codex-plugin-cc-implementation-ultraplan.md"
verification_result: |
  gh: connectex: An attempt was made to access a socket in a way forbidden by its access permissions.
  plan: no match for 113 or 309 or 321
  plan: 107:| 283 | PR-5.7 | 5 |
  Web fallback #113: Windows install fails and blocks setup.
  Web fallback #309: plugin unusable on default gpt-5.5 despite CLI 0.130.
verdict: CONFIRMED
confidence: likely
```

```yaml
claim: "분류=missing: BREAKING-change 집계가 내부 모순이다. 요약은 예상 breaking change 1개라고 쓰지만 release plan은 PR-2.1과 PR-5.6 두 개를 BREAKING으로 명시한다."
verification_command: "rg -n '예상 breaking|Breaking changes|PR-2\\.1|PR-5\\.6' docs/ultraplan/2026-05-16-130611-codex-plugin-cc-implementation-ultraplan.md"
verification_result: |
  27:| 예상 breaking change | 1 (sandbox default omit, semver minor justification) |
  326:- **위험**: **HIGH (BREAKING)** ...
  597:- **위험**: HIGH (BREAKING) ...
  995:### Breaking changes (CHANGELOG 명시)
  996:1. **sandbox default**: PR-2.1 ...
  997:2. **Codex home 분리**: PR-5.6 ...
verdict: CONFIRMED
confidence: certain
```

```yaml
claim: "분류=missing: §11 dependency graph는 PR-4.6 Windows review --background hang가 PR-3.4 review --background wire-up 이후에만 의미 있게 검증된다는 edge를 누락했다."
verification_command: "rg -n 'PR-3\\.4|PR-4\\.6|handleReviewCommand|options\\.background|enqueueBackgroundTask' docs/ultraplan/2026-05-16-130611-codex-plugin-cc-implementation-ultraplan.md plugins/codex/scripts/codex-companion.mjs"
verification_result: |
  plan:837:  PR-3.4 ... ◄─── PR-0.2
  plan:848:  PR-4.6 ... ◄─── PR-1.7 + investigation
  code:929:async function handleReviewCommand(argv, config) {
  code:956:  await runForegroundCommand(
  code:1009:  if (options.background) {
  code:1029:    const { payload } = enqueueBackgroundTask(...)
verdict: CONFIRMED
confidence: certain
```

```yaml
claim: "분류=design opinion: 38 PR / 8 Phase에 bug fixes, 2 BREAKING changes, Phase 7 feature bundle이 한 v1.1.0 train에 들어가 있어 Phase 7은 v1.2.0으로 분리하는 편이 더 안전하다."
verification_command: "rg -n '총 PR 수|Phase 수|Feature 추가|Phase 7|v1\\.1\\.0 Release Plan|Breaking changes' docs/ultraplan/2026-05-16-130611-codex-plugin-cc-implementation-ultraplan.md"
verification_result: |
  22:| 총 PR 수 | 38 |
  23:| Phase 수 | 8 |
  712:## 9. Phase 7 — Feature 추가 (선별)
  988:## 16. v1.1.0 Release Plan
  992:- Phase 7 + Phase 8.5 완료 → v1.1.0-rc2
  995:### Breaking changes (CHANGELOG 명시)
verdict: CONFIRMED
confidence: likely
```

## 2. Plan Correctness Audit

```yaml
claim: "분류=fidelity bug: PR-2.1은 codex-companion.mjs의 sandbox default만 고치면 된다고 보지만, 실제 sandbox 기본값은 lib/codex.mjs buildThreadParams/buildResumeParams에서도 read-only로 재주입된다."
verification_command: "rg -n 'request\\.sandbox \\?\\?|sandbox: options\\.sandbox \\?\\? \"read-only\"|PR-2\\.1' plugins/codex/scripts/codex-companion.mjs plugins/codex/scripts/lib/codex.mjs docs/ultraplan/2026-05-16-130611-codex-plugin-cc-implementation-ultraplan.md"
verification_result: |
  plan:314:### PR-2.1 — sandbox default omit ...
  code:680:  const sandbox = request.sandbox ?? ...
  code:64:    sandbox: options.sandbox ?? "read-only",
  code:77:    sandbox: options.sandbox ?? "read-only"
verdict: CONFIRMED
confidence: certain
```

```yaml
claim: "분류=fidelity bug: PR-4.1의 app-server.mjs line 188 spawn('codex') target은 현재 코드와 맞지 않는다. 실제 spawn은 line 286이고 이미 buildCommandInvocation('codex')를 사용해 PATHEXT/.cmd shim 처리를 탄다."
verification_command: "rg -n 'spawn\\(|buildCommandInvocation\\(\"codex\"|PR-4\\.1|line 188' plugins/codex/scripts/lib/app-server.mjs plugins/codex/scripts/lib/process.mjs docs/ultraplan/2026-05-16-130611-codex-plugin-cc-implementation-ultraplan.md"
verification_result: |
  plan:451:- **파일**: ... app-server.mjs (line 188 부근)
  app-server.mjs:283: const invocation = buildCommandInvocation("codex", ["app-server"], {
  app-server.mjs:286: this.proc = spawn(invocation.command, invocation.args, {
  process.mjs:62:export function buildCommandInvocation(...)
  process.mjs:68: const resolvedCommand = resolveWindowsCommand(...)
verdict: CONFIRMED
confidence: certain
```

```yaml
claim: "분류=implemented/redundant: PR-3.7은 review에서 -m alias가 누락됐다고 하지만 현재 handleReviewCommand는 model value option과 aliasMap m:model을 이미 가진다."
verification_command: "rg -n 'PR-3\\.7|현재 review 에서는 누락|valueOptions: \\[\"base\", \"scope\", \"model\", \"cwd\"\\]|m: \"model\"' docs/ultraplan/2026-05-16-130611-codex-plugin-cc-implementation-ultraplan.md plugins/codex/scripts/codex-companion.mjs"
verification_result: |
  plan:438:  - `aliasMap = { m: "model" }` 적용 (현재 review 에서는 누락)
  code:931:    valueOptions: ["base", "scope", "model", "cwd"],
  code:933:    aliasMap: {
  code:934:      m: "model"
verdict: CONFIRMED
confidence: certain
```

```yaml
claim: "분류=implemented/partial: PR-6.7은 mcpServer/elicitation/request가 현재 Unsupported라고 전제하지만, 현재 approvals path는 이미 해당 method를 승인 요청으로 인식한다. 남는 범위는 tool-loop guard와 fixture 강화다."
verification_command: "rg -n 'mcpServer/elicitation/request|Unsupported server request|createJobServerRequestHandler' plugins/codex/scripts/lib/approvals.mjs plugins/codex/scripts/lib/app-server.mjs plugins/codex/scripts/codex-companion.mjs docs/ultraplan/2026-05-16-130611-codex-plugin-cc-implementation-ultraplan.md"
verification_result: |
  plan:702: server-initiated request ... 현재 `Unsupported server request:`
  approvals.mjs:8:  "mcpServer/elicitation/request",
  approvals.mjs:161: case "mcpServer/elicitation/request":
  approvals.mjs:288: case "mcpServer/elicitation/request":
  codex-companion.mjs:347:function createJobServerRequestHandler(...)
verdict: CONFIRMED
confidence: certain
```

```yaml
claim: "분류=implemented/redundant: PR-6.6의 'schema maxItems 제거' 작업은 현재 review-output.schema.json에 maxItems가 없어 적용할 diff가 없다."
verification_command: "rg -n 'maxItems|findings|PR-6\\.6|schema 의 findings 항목 maxItems 제거' plugins/codex/schemas/review-output.schema.json docs/ultraplan/2026-05-16-130611-codex-plugin-cc-implementation-ultraplan.md"
verification_result: |
  plan:686:### PR-6.6 — review max-findings configurable (#298)
  plan:692:  - schema 의 findings 항목 maxItems 제거
  schema:23:    "findings": {
  schema:24:      "type": "array",
  rg maxItems in schema: empty
verdict: CONFIRMED
confidence: certain
```

## 3. Plan Risk Audit

```yaml
claim: "분류=design opinion: PR-1.1의 processStartedAt 비교만으로 PID reuse race를 닫기 어렵다. 현재 liveness는 kill(pid,0)뿐이고 계획도 kernel-level starttime/creation-time 검증을 명시하지 않는다."
verification_command: "rg -n 'function isPidRunning|processStartedAt|PID reuse|starttime|creation' plugins/codex/scripts/lib/state.mjs docs/ultraplan/2026-05-16-130611-codex-plugin-cc-implementation-ultraplan.md"
verification_result: |
  state.mjs:73:function isPidRunning(pid) {
  state.mjs:78:    process.kill(pid, 0);
  plan:215:PID reuse ... `processStartedAt` 비교 필요
  plan:217:mitigation: state.json 에 `processStartedAt` 저장
  rg starttime/creation: empty
verdict: CONFIRMED
confidence: likely
```

```yaml
claim: "분류=partial: PR-4.4, PR-4.6, PR-6.7의 HIGH-risk mitigation은 대부분 investigation/hypothesis/fixture 수준이며 deterministic root-cause gate가 부족하다."
verification_command: "rg -n 'PR-4\\.4|PR-4\\.6|PR-6\\.7|hypothesis|root cause 미특정|protocol fixture|investigation' docs/ultraplan/2026-05-16-130611-codex-plugin-cc-implementation-ultraplan.md"
verification_result: |
  483:### PR-4.4 — CreateProcessAsUserW 1920 root cause (#295)
  485:- **파일**: investigation 우선
  511:  - investigation: bisection 5 datapoint...
  512:  - hypothesis: child stdio pipe...
  518:- **위험**: HIGH — root cause 미특정.
  707:- **위험**: HIGH ... mitigation: protocol fixture test
verdict: CONFIRMED
confidence: certain
```

```yaml
claim: "분류=missing: rollback strategy는 PR별 revert/env-toggle 위주이고 Phase-level rollback/checkpoint 기준이 없다. 8-Phase train에서는 phase rollback gate가 별도 필요하다."
verification_command: "rg -n '롤백|Rollback|Phase [0-9] 완료|Release Plan|rc1|rc2' docs/ultraplan/2026-05-16-130611-codex-plugin-cc-implementation-ultraplan.md"
verification_result: |
  887:| PR | 위험 등급 | 주요 위험 | Mitigation | Rollback 방법 |
  906:### Phase 0 완료
  911:### Phase 1 완료
  991:- Phase 0~6 완료 + Phase 8.1~8.4 완료 → v1.1.0-rc1
  992:- Phase 7 + Phase 8.5 완료 → v1.1.0-rc2
  phase rollback 기준: empty
verdict: CONFIRMED
confidence: certain
```

```yaml
claim: "분류=missing: PR-2.1과 PR-5.6의 BREAKING mitigation은 env opt-out과 MIGRATION 문서뿐이며, v1.0.4 사용자의 자동 감지/first-run warning/compat mode test가 없다."
verification_command: "rg -n 'CODEX_PLUGIN_SANDBOX_DEFAULT|CODEX_PLUGIN_USE_DEFAULT_HOME|MIGRATION_v1\\.1|contract|first-run|compat' docs/ultraplan/2026-05-16-130611-codex-plugin-cc-implementation-ultraplan.md"
verification_result: |
  326:... `CODEX_PLUGIN_SANDBOX_DEFAULT=read-only`
  597:... opt-out env var (`CODEX_PLUGIN_USE_DEFAULT_HOME=1`)
  793:### PR-8.3 — MIGRATION_v1.1.md
  796:breaking change ... opt-out env var 안내
  first-run/compat-mode test: empty
verdict: CONFIRMED
confidence: certain
```

## 4. Plan Effort Audit

```yaml
claim: "분류=partial: 10-PR effort sample(PR-0.3,1.6,2.1,3.2,4.1,4.3,5.6,6.2,6.6,7.4)에서 PR-0.3, PR-2.1, PR-5.6, PR-7.4는 실제 blast radius 대비 과소 산정 가능성이 높다."
verification_command: "$p='docs/ultraplan/2026-05-16-130611-codex-plugin-cc-implementation-ultraplan.md'; $prs='PR-0.3','PR-1.6','PR-2.1','PR-3.2','PR-4.1','PR-4.3','PR-5.6','PR-6.2','PR-6.6','PR-7.4'; $lines=Get-Content $p; foreach($pr in $prs){$idx=0..($lines.Count-1)|?{$lines[$_] -match \"### $pr\"}|select -First 1; $size=($lines[($idx+1)..([Math]::Min($idx+8,$lines.Count-1))]|?{$_ -match '사이즈'}|select -First 1); \"$($idx+1):$($lines[$idx]) $size\"}"
verification_result: |
  187:PR-0.3 CI matrix - size M
  270:PR-1.6 hook stdin - size M
  314:PR-2.1 sandbox omit - size M
  588:PR-5.6 separate Codex home - size M
  686:PR-6.6 max-findings - size S
  732:PR-7.4 OS-native notification - size S
verdict: CONFIRMED
confidence: likely
```

```yaml
claim: "분류=missing: Phase 0의 6개 contract tests는 production failure modes를 충분히 덮지 않는다. 특히 sandbox omit, review background queue, PID reuse, MCP elicitation/tool-loop, gpt-5.5 structured review, Codex home migration 계약이 빠져 있다."
verification_command: "rg -n 'tests/contracts|rate-limit|large-prompt|broker-shutdown|state-race|sigterm|finalizing-stuck|sandbox omit|review --background|PID reuse|gpt-5\\.5|Codex home' docs/ultraplan/2026-05-16-130611-codex-plugin-cc-implementation-ultraplan.md tests"
verification_result: |
  plan:174:tests/contracts/{rate-limit,large-prompt,broker-shutdown,state-race,sigterm,finalizing-stuck}
  plan:215:PID reuse ... processStartedAt 비교 필요
  plan:323:contract ... sandbox 필드 부재 검증
  tests/contracts: no files
  tests/runtime.test.mjs:1171:review accepts --background...
verdict: CONFIRMED
confidence: certain
```

```yaml
claim: "분류=partial: contract-test name overlap이 있다. 기존 runtime test는 review --background를 받지만 jobId 즉시 반환/foreground stream 미발생을 검증하지 않아 PR-3.4의 새 contract와 중복 이름만 유사하다."
verification_command: "rg -n 'review accepts --background|jobId|foreground stream|PR-3\\.4|jobId 즉시 반환' tests/runtime.test.mjs docs/ultraplan/2026-05-16-130611-codex-plugin-cc-implementation-ultraplan.md"
verification_result: |
  tests/runtime.test.mjs:1171:test("review accepts --background while still running as a tracked review job", () => {
  tests/runtime.test.mjs:1188:  assert.equal(launchPayload.review, "Review");
  tests/runtime.test.mjs:1189:  assert.match(launchPayload.codex.stdout, /No material issues found/);
  plan:405:  - jobId 즉시 반환 + queued payload 렌더
  plan:407:- foreground stream 미발생
verdict: CONFIRMED
confidence: certain
```

## 5. Missed Concerns (Codex perspective)

```yaml
claim: "분류=missing: SemVer상 두 BREAKING changes를 유지한다면 v1.1.0은 부적절하고 2.0.0이 맞다. SemVer 2.0.0은 incompatible API changes는 MAJOR, backward-compatible additions는 MINOR라고 규정한다."
verification_command: "rg -n '목표 버전|BREAKING|Breaking changes|PR-2\\.1|PR-5\\.6' docs/ultraplan/2026-05-16-130611-codex-plugin-cc-implementation-ultraplan.md"
verification_result: |
  plan:5:**목표 버전**: v1.1.0
  plan:995:### Breaking changes (CHANGELOG 명시)
  plan:996:1. sandbox default...
  plan:997:2. Codex home 분리...
  SemVer https://semver.org/: MAJOR for incompatible API changes; MINOR for backward-compatible functionality.
verdict: CONFIRMED
confidence: certain
```

```yaml
claim: "분류=missing: v1.0.4→v1.1.0 single-jump은 too large다. 안정화 PR과 feature PR을 섞지 말고 1.0.5/1.0.6 patch safety releases, 2.0.0 breaking, 1.2.0 features로 나누는 release train이 더 안전하다."
verification_command: "rg -n 'v1\\.1\\.0|총 PR 수|Phase 7|feature request|BREAKING|rc1|rc2' docs/ultraplan/2026-05-16-130611-codex-plugin-cc-implementation-ultraplan.md"
verification_result: |
  5:**목표 버전**: v1.1.0
  22:| 총 PR 수 | 38 |
  10:- feature request ... Phase 7 선별 포함
  712:## 9. Phase 7 — Feature 추가
  991:- Phase 0~6 ... → v1.1.0-rc1
  992:- Phase 7 ... → v1.1.0-rc2
verdict: CONFIRMED
confidence: likely
```

```yaml
claim: "분류=partial: upstream codex CLI protocol drift 전략이 약하다. prebuild는 app-server types를 생성하지만 plan은 gpt-5.5/protocol drift를 fallback 중심으로 다루며, generated type diff gate나 app-server fixture matrix를 release blocker로 두지 않는다."
verification_command: "rg -n 'app-server generate-ts|\\.generated|gpt-5\\.5|model fallback|protocol fixture|clientInfo|version detect' package.json tsconfig.app-server.json docs/ultraplan/2026-05-16-130611-codex-plugin-cc-implementation-ultraplan.md"
verification_result: |
  package.json:14:prebuild ... codex app-server generate-ts --out plugins/codex/.generated/app-server-types
  tsconfig:20:plugins/codex/.generated/app-server-types/**/*.ts
  plan:615:gpt-5.5 ... fall-back + 경고 출력
  plan:616:startup 시 codex CLI version detect...
  plan:707:protocol fixture test
verdict: CONFIRMED
confidence: likely
```

```yaml
claim: "분류=missing: observability/incident response plan이 부족하다. plan은 telemetry stamp를 한 번 언급하지만 코드에는 telemetry/metrics sink가 없고, production incident에 필요한 structured event IDs, counters, correlation IDs가 계획되지 않았다."
verification_command: "rg -n 'telemetry|metrics|incident|trace|correlation|logNote|telemetry stamp' plugins docs/ultraplan/2026-05-16-130611-codex-plugin-cc-implementation-ultraplan.md"
verification_result: |
  plan:364:... warning + telemetry stamp
  plugins/codex/scripts/stop-review-gate-hook.mjs:33:function logNote(message) {
  plugins telemetry/metrics/trace/correlation: empty
verdict: CONFIRMED
confidence: certain
```

## Strengths

- bug-class 이슈를 Category A~F로 나누고 PR 단위로 쪼갠 구조 자체는 실행 가능한 뼈대다.
- Phase 0에 contract baseline을 먼저 두려는 방향은 맞다.
- PR-2.1, PR-5.6, PR-4.4, PR-4.6, PR-6.7을 high-risk로 별도 표기한 판단은 타당하다.
- 기존 코드의 위험 지점인 sandbox default, stop-review-gate, hook stdin, broker lifecycle, Windows path 계열을 대부분 건드린다.

## Weaknesses

- 현재 코드 기준으로 이미 구현된 항목(PR-3.7, PR-4.1 일부, PR-6.6 schema 부분, PR-6.7 elicitation 일부)이 남아 있어 plan diff fidelity가 낮다.
- BREAKING change 수와 SemVer 판단이 맞지 않는다.
- Phase 7 feature가 stabilization release에 섞여 release risk를 키운다.
- high-risk Windows/protocol PR은 root-cause gate보다 mitigation 문장이 먼저 나온다.
- `npm test`는 120초 제한에서 타임아웃되어 전체 green을 확인하지 못했다.

## Recommended Changes

1. HIGH: 목표 버전을 `v1.1.0`에서 `v2.0.0`으로 바꾸거나, PR-2.1/PR-5.6을 opt-in compatibility mode로 재설계해 BREAKING이 아니게 만든 뒤 `v1.1.0`을 유지하라.
2. HIGH: release train을 `1.0.5` 핵심 안전 bugfix, `1.0.6` Windows/auth hardening, `2.0.0` breaking defaults, `1.2.0` Phase 7 features로 분리하라.
3. HIGH: PR-2.1 target에 `plugins/codex/scripts/lib/codex.mjs:59-78`을 추가하고, `sandbox`를 `null`이 아니라 field omission으로 전달하는 contract를 넣어라.
4. HIGH: §1 issue mapping에 #113, #309, #321을 추가하라. #321은 #283 duplicate로 묶고, #309는 #270의 newer reproduction으로 traceability를 연결하라.
5. HIGH: §11 graph에 `PR-4.6 ◄─── PR-3.4`를 추가하고, PR-6.7은 `6.7a tool-loop guard`와 `6.7b protocol fixture expansion`으로 쪼개라.
6. MED: PR-3.7, PR-4.1, PR-6.6의 already-implemented/no-op 부분을 `implemented`로 재분류하고 실제 남은 diff만 유지하라.
7. MED: PR-1.1 PID reuse mitigation을 `processStartedAt`에서 OS process birth signal로 강화하라. Linux `/proc/<pid>/stat` starttime, Windows creation time, macOS `ps`/proc metadata, 또는 plugin-spawned worker exit latch를 명시하라.
8. MED: Phase 0 contract에 다음을 추가하라: `sandbox-omit-inherits-user-config`, `review-background-queues`, `pid-reuse-original-process`, `server-request-elicitation-and-loop`, `gpt55-structured-review-compat`, `codex-home-migration`, `hook-stdin-no-pipe-timeout`, `broker-orphan-exit`.
9. MED: PR-7.4 OS notification은 S가 아니라 M으로 올려라. Windows toast, macOS osascript, Linux notify-send, CI mock, failure-silent behavior까지 cross-platform surface가 있다.
10. LOW: telemetry plan을 별도 PR로 추가하라. 최소 event id, job id, thread id, phase, error class, elapsed ms, fallback path를 JSONL로 남기게 하라.
11. LOW: `MIGRATION_v1.1.md`를 단순 opt-out 안내가 아니라 v1.0.4 사용자의 first-run warning, rollback env, known behavior matrix, FAQ까지 포함하는 migration checklist로 확장하라.

## Decision Triage Summary

autonomous-safe 12:
plan traceability fixes, dependency graph edge, redundant PR reclassification, line target correction, missing contract-test additions, PR split/merge edits, CI matrix wording correction, migration doc expansion, telemetry PR drafting, test-name de-duplication, PR sizing corrections, issue duplicate consolidation.

needs-user 4:
version bump `1.1.0 vs 2.0.0`, Phase 7 inclusion vs v1.2.0 deferral, sandbox default policy, separate `CODEX_HOME` default policy.

needs-claude-judgment 5:
PR-4.4 Windows token root cause, PR-4.6 Windows hang root cause, PR-6.7 app-server protocol/tool-loop behavior, #141 macOS SCDynamicStore upstream boundary, #113 installer/harness scope boundary.

skipped 4 with reason taxonomy:
`gh-api-blocked`: local `gh issue list` failed due socket permission.
`full-test-incomplete`: `npm test` timed out at 120s after partial green output.
`real-os-unavailable`: Windows/macOS/locale dogfooding not run.
`not-all-82-bodies`: sampled issue bodies via Web fallback instead of reading all open issues.


Codex session ID: 019e2f04-5e14-7e53-a259-1f8a80c5aac7
Resume in Codex: codex resume 019e2f04-5e14-7e53-a259-1f8a80c5aac7
