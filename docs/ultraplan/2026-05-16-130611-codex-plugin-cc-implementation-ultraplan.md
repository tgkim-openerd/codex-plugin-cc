# ULTRAPLAN-IMPL — `@openai/codex-plugin-cc` v1.0.4 → split-train (1.0.5 / 1.0.6 / 2.0.0 / 1.2.0) 통합 결함 해결 구현 계획

**작성일**: 2026-05-16
**대상 브랜치 시작점**: `feat/doc-sync-changelog-prefix-match` (HEAD `2322926`)
**목표 release train (default — 사용자 redirect 가능)**:

- **v1.0.5** (Phase 0 + 1) — 안전 fix (state lifecycle / contract baseline / broker teardown)
- **v1.0.6** (Phase 4 + 5 일부) — Windows / auth hardening
- **v2.0.0** (Phase 2 + 5.6 + 5.1) — BREAKING (sandbox default omit + Codex home 분리 + clientInfo 변경) + Phase 3/6 stabilization
- **v1.2.0** (Phase 7 + 8 + 9) — feature train + telemetry + docs

§ 0.1 의 4 needs-user decision 에 대해 Codex 권장 default 채택 (D1-C / D2-B / D3-C / D4-A). 사용자 redirect 시 § 16 Release Plan 재구성.
**전제 문서**:

- [`2026-05-16-125443-codex-plugin-cc-feasibility-ultraplan.md`](./2026-05-16-125443-codex-plugin-cc-feasibility-ultraplan.md) (feasibility 평가)
- [`2026-05-16-130611-codex-pair-validation-result.md`](./2026-05-16-130611-codex-pair-validation-result.md) (Codex 독립 audit, 16 finding)

**Codex pair-validation 적용 (2026-05-16, task-mp7u9kxd-7c603j, 13min 6s)**:

- 16 finding 모두 5필드 검증 완료. autonomous-safe 12건 본 plan 에 incorporate, needs-user 4건 § 0.1 escalate, needs-claude-judgment 5건 § 0.2 보존, skipped 4건 § 0.3 명시.
- 본 헤더와 모든 PR section 의 변경 사항은 § 0.4 changelog 참조.

**스코프 원칙**:
- 모든 **bug-class 이슈** (Cat. A~F, 약 55건) 해결 — 본 ULTRAPLAN scope
- **feature request** (Cat. G, 약 13건) 중 production-blocking 만 Phase 7 선별 포함
- **vague / out-of-scope** (Cat. H~I, 약 5건) 제외 — 별도 issue triage
- 모든 PR 은 **independent merge 가능** (atomic) + 명확 dependency graph
- 각 PR 은 contract test 동반 (failure mode replay)
- Codex pair-validate gate: 각 Phase 종료 시점

---

## 0. 한눈 요약 (Codex audit 반영 후 v2)

| 메트릭 | v1 (초안) | v2 (Codex audit 반영) |
|---|---|---|
| 총 PR 수 | 38 | **40** (PR-6.7 → 6.7a/6.7b 분할 + PR-9.1 telemetry 추가, PR-3.7 implemented 로 제거) |
| Phase 수 | 8 | **9** (Phase 9 telemetry/observability 신규) |
| 추정 effort | XL | **XL+** (PR-7.4 S→M, PR-2.1 M→L 재산정 반영) |
| 사용자 영향 critical (HIGH-tier) | 14 PR | 14 PR |
| 차단 의존성 | Phase 0 → 1 → (2,3 parallel) → 4 → (5,6 parallel) → 7 → 8 | Phase 0 → 1 → (2,3 parallel) → (3.4 → 4.6) → (5,6,9 parallel) → 7 → 8 |
| 실제 breaking change | 1 (오기) | **2** — PR-2.1 (sandbox default), PR-5.6 (Codex home). semver 결정은 § 0.1 |
| 신규 환경 의존성 | 0 | 0 (zero runtime dep 유지) |
| Codex audit 적용 verdict | — | 16 CONFIRMED / 0 REJECTED |

### 0.1 사용자 결정 필요 (4건 — needs-user, 자동 축소 금지)

본 결정 4건은 product policy 영역. CLAUDE.md § User Decision Triage Protocol 준수 — 사용자가 명시 응답 전까지 plan 은 "decision pending" 상태로 유지.

#### D1. SemVer / Release train 전략

- **현황**: PR-2.1 (sandbox default omit) + PR-5.6 (Codex home 분리) = 2 BREAKING change
- **옵션 A**: 현재대로 v1.1.0 minor — env opt-out 으로 semver-minor 정당화 (Codex 의견: SemVer 2.0.0 위반)
- **옵션 B (Codex 권장)**: v2.0.0 major — BREAKING 명시
- **옵션 C (Codex 권장)**: split-train — `1.0.5` (Phase 0~1 안전 fix), `1.0.6` (Phase 4 Windows + 5 auth hardening), `2.0.0` (Phase 2 + 5.6 BREAKING), `1.2.0` (Phase 7 features). 4 release 로 분리해 risk dispersal
- **default if no answer**: 옵션 C — least destructive, rollback 단위 작음

#### D2. Phase 7 Feature 포함 여부

- **현황**: Phase 7 의 6 feature (--resume-id, --context, OS 알림, remote branches, --fast, user config, non-interactive) 가 v1.1.0 train 에 포함
- **옵션 A**: 현재대로 v1.1.0 에 통합
- **옵션 B (Codex 권장)**: v1.2.0 으로 분리 — stabilization 과 feature 섞지 말 것
- **default if no answer**: 옵션 B (split-train D1-C 와 일관)

#### D3. Sandbox default 정책

- **현황**: PR-2.1 이 sandbox 필드 omit 으로 user codex config 채택
- **옵션 A**: full omit (user config 가 sandbox_mode 미설정이면 codex CLI 의 default `read-only` 사용)
- **옵션 B (Codex 권장 mitigation)**: opt-in compatibility mode — env `CODEX_PLUGIN_SANDBOX_INHERIT=1` 명시 시에만 inherit, default 는 v1.0.x 동작 유지 → BREAKING 회피
- **옵션 C**: 현재대로 BREAKING 진행 + first-run warning 추가
- **default if no answer**: 옵션 B (least destructive — BREAKING 회피)

#### D4. Codex home (CODEX_HOME) 분리 정책

- **현황**: PR-5.6 이 plugin jobs 를 `~/.codex/claude-code/` 별도 home 으로 격리
- **옵션 A**: 현재대로 default 격리
- **옵션 B (Codex 권장)**: opt-in — env `CODEX_PLUGIN_USE_SEPARATE_HOME=1` 명시 시에만 격리, default 는 user 의 `~/.codex/` 공유
- **옵션 C**: 격리 자체 deferred (v1.2.0 또는 v2.1) — 재기획 시간 확보
- **default if no answer**: 옵션 B

### 0.2 Claude judgment 영역 (5건 — 진행 시 deep investigation)

본 항목은 외부 시스템 (Codex CLI / Windows kernel / macOS) 의 변경 또는 deep root-cause investigation 필요. 별도 spike PR 후 본 plan 에 통합.

| # | 항목 | 본 plan 의 처리 |
|---|---|---|
| 1 | PR-4.4 Windows token (CreateProcessAsUserW 1920) root cause | Phase 4 진입 전 spike PR-4.4-spike (1주 timebox) |
| 2 | PR-4.6 Windows review --background hang root cause | Phase 4 진입 전 spike PR-4.6-spike (1주 timebox) |
| 3 | PR-6.7 app-server protocol drift / tool-loop 정책 | Phase 6 분할 (6.7a tool-loop guard + 6.7b protocol fixture matrix) |
| 4 | #141 macOS SCDynamicStore (Apple Silicon + Antigravity) | upstream codex CLI 영역 — coordination issue 제기, plugin 측은 mitigation only |
| 5 | #113 Windows installer 차단 | Claude Code harness 영역 — coordination issue 제기 |

### 0.3 Codex audit skipped (4건, reason taxonomy)

- `gh-api-blocked`: Codex 환경에서 `gh` socket 권한 차단 → 16 issue 만 web fallback 으로 sample
- `full-test-incomplete`: `npm test` 가 120s timeout 으로 partial green 만 확인
- `real-os-unavailable`: Windows / macOS / non-UTF-8 locale dogfooding 미수행
- `not-all-82-bodies`: 모든 OPEN 82 issue body 미열람 (sample 16건만)

위 skipped 영역은 본 plan 의 Phase 0 (CI matrix) + Phase 8 (real-OS dogfooding) 으로 자체 해소.

### 0.4 v1 → v2 변경 사항 (autonomous-safe 12건 incorporate)

| Codex finding | v1 plan | v2 plan |
|---|---|---|
| C1: BREAKING count 모순 (1 vs 2) | 한눈 요약: 1 | **2 (명시)** |
| C2: 누락 issue #113 / #309 / #321 | mapping 없음 | § 1 의 Cat. D / E 에 추가 (#321 은 #283 duplicate 로 consolidate) |
| C3: dependency graph PR-4.6 ◄─── PR-3.4 누락 | edge 없음 | **§ 11 graph 에 추가** (review --background wire 가 Windows hang 검증 전제) |
| C4: PR-2.1 fidelity — `lib/codex.mjs:59-78` 누락 | codex-companion.mjs 만 | **lib/codex.mjs:59-78 (buildThreadParams/buildResumeParams) 도 sandbox 재주입 제거 명시** |
| C5: PR-4.1 redundant — buildCommandInvocation 이미 사용 | 신규 작업 | **implemented — PR-4.1 제거**, 단 line 286 의 spawn options windowsHide/windowsVerbatimArguments 점검은 잔존 |
| C6: PR-3.7 redundant — review aliasMap 이미 적용 | 신규 작업 | **implemented — PR-3.7 제거**, 단 task command 의 silent 400 검증 contract 만 잔존 |
| C7: PR-6.6 redundant — schema maxItems 부재 | "schema 의 maxItems 제거" 작업 | **prompt + max-findings option 만 잔존 (schema 작업 drop)** |
| C8: PR-6.7 redundant — elicitation 이미 처리 | "Unsupported server request" 가정 | **PR-6.7 → 6.7a (tool-loop guard) + 6.7b (protocol fixture expansion) 분할**. elicitation handler 작업 drop |
| C9: PR-1.1 PID reuse mitigation 약함 | `processStartedAt` timestamp | **OS-level birth time 명시 — Linux `/proc/<pid>/stat` starttime, Windows CreateProcessTime, macOS `ps -o lstart`, fall-back: spawn-side latch** |
| C10: rollback Phase-level checkpoint 부재 | PR-level 만 | **§ 12 에 Phase 0/1/2/3/4 별 rollback gate 추가** (각 Phase 종료 시 v1.0.4 fall-back tag 유지) |
| C11: BREAKING first-run warning 부재 | env opt-out 만 | **PR-8.6 신규 — first-run 시 sandbox/home 변경 사항 stderr 출력 + 1회만 표시 (state file 기록)** |
| C12: Phase 0 contract test 6 → 14 | 6 contract | **8 신규 추가** (sandbox-omit-inherits-user-config, review-background-queues, pid-reuse-original-process, server-request-elicitation-and-loop, gpt55-structured-review-compat, codex-home-migration, hook-stdin-no-pipe-timeout, broker-orphan-exit) |

추가 항목 (Codex 권장 사항 8~11):

| # | 권장 | v2 적용 |
|---|---|---|
| 8 | PR-7.4 S→M 재산정 (cross-platform notify surface) | **PR-7.4 사이즈 M** + Windows toast / macOS osascript / Linux notify-send / CI mock 명시 |
| 9 | telemetry / observability PR | **Phase 9 신규 + PR-9.1 (JSONL event log) + PR-9.2 (correlation ID)** |
| 10 | MIGRATION_v1.1.md 확장 | **PR-8.3 → first-run warning + rollback env + behavior matrix + FAQ 통합** |
| 11 | PR-3.7 / 4.1 / 6.6 reclassify | C5/C6/C7 와 통합 (위 표) |

---

## 0.5 한눈 요약 (원본 v1)

### Phase 의존성 그래프

```
Phase 0 (test infra)  ──┐
                        ├──► Phase 1 (state/lifecycle)  ──┬──► Phase 4 (Windows)  ──► Phase 7 (features)
                        │                                  │                          │
                        ├──► Phase 2 (sandbox/approval) ──┤                          ├──► Phase 8 (docs)
                        │                                  │                          │
                        └──► Phase 3 (response reliability)┴──► Phase 5/6 (auth/UX)──┘
```

---

## 1. 이슈 → PR 매핑 (전수 enumerate)

### Category A: 상태 / lifecycle (15 이슈)
| 이슈 # | 제목 | 매핑 PR | Phase |
|---|---|---|---|
| 122 | codex-rescue Bash 600s timeout | PR-3.6 | 3 |
| 163 | broker process leak (테스트) | PR-0.1 | 0 |
| 183 | finalizing 무한 대기 | PR-1.3 | 1 |
| 198 | worktree + run_in_background hang | PR-1.8 | 1 |
| 202 / 222 / 164 | PID liveness 부재 | PR-1.1 | 1 |
| 228 | 포그라운드 SIGTERM 시 status:running 잔존 | PR-1.2 | 1 |
| 247 | 동시 세션 EAGAIN | PR-1.6 | 1 |
| 264 | task_complete 후 status:running 잔존 | PR-1.5 | 1 |
| 266 / 268 | rescue 간헐 hang | PR-1.7 (간접) | 1 |
| 277 | review --background hang Windows | PR-4.6 | 4 |
| 279 | --background 플래그 read 안 됨 | PR-3.4 | 3 |
| 286 race 1·2 | state.mjs 비원자 | ✅ v1.0.4 fixed (regression test PR-0.2) | 0 |
| 286 race 3 | broker.json race | PR-1.4 | 1 |
| 324 | rescue stub 반환 | PR-3.3 | 3 |
| 120 / 191 | hook stdin EAGAIN / blocking | PR-1.6 | 1 |

### Category B: 샌드박스 / 승인 (5 이슈)
| 이슈 # | 매핑 PR | Phase |
|---|---|---|
| 167 | PR-2.1 | 2 |
| 240 | PR-2.1 | 2 |
| 304 | PR-2.1 + PR-2.3 | 2 |
| 124 | PR-2.2 | 2 |
| 145 | PR-2.2 | 2 |

### Category C: 통신 / 응답 신뢰성 (7 이슈)
| 이슈 # | 매핑 PR | Phase |
|---|---|---|
| 122 | PR-3.6 | 3 |
| 207 | PR-3.4 + PR-3.5 | 3 |
| 248 | PR-3.1 | 3 |
| 273 | PR-3.1 | 3 |
| 306 | PR-3.1 | 3 |
| 308 | PR-3.2 | 3 |
| 324 | PR-3.3 | 3 |
| 257 | PR-3.7 | 3 |

### Category D: Windows (9 이슈)
| 이슈 # | 매핑 PR | Phase |
|---|---|---|
| 182 / 219 | PR-4.3 | 4 |
| 236 | PR-4.6 | 4 |
| 259 / 287 | PR-4.1 | 4 |
| 277 | PR-4.6 | 4 |
| 280 | PR-4.7 | 4 |
| 285 | PR-4.2 | 4 |
| 295 | PR-4.4 | 4 |
| 310 | PR-4.5 (upstream coordination) | 4 |
| 191 | PR-1.6 (cross-Phase) | 1 |

### Category E: Auth / config (8 이슈)
| 이슈 # | 매핑 PR | Phase |
|---|---|---|
| 199 / 276 | PR-5.1 | 5 |
| 233 | PR-5.4 | 5 |
| 251 | PR-5.5 | 5 |
| 270 | PR-5.8 | 5 |
| 281 | PR-5.2 | 5 |
| 282 | PR-5.6 | 5 |
| 283 | PR-5.7 | 5 |
| 320 | PR-5.3 | 5 |

### Category F: UX 행동 (10 이슈)
| 이슈 # | 매핑 PR | Phase |
|---|---|---|
| 115 | PR-6.7 (loop guard) | 6 |
| 158 | PR-6.1 | 6 |
| 203 | PR-6.2 | 6 |
| 211 | PR-6.3 | 6 |
| 213 | PR-6.3 | 6 |
| 221 | PR-6.5 | 6 |
| 232 | PR-6.4 | 6 |
| 237 | PR-3.5 (status visibility) | 3 |
| 238 | PR-8.2 (docs) | 8 |
| 242 | PR-6.2 (lighter init) | 6 |
| 250 / 258 | PR-6.7 | 6 |
| 269 | PR-6.3 | 6 |
| 298 | PR-6.6 | 6 |

### Category G: Feature (선별 포함, Phase 7)
| 이슈 # | 포함 여부 | 매핑 PR |
|---|---|---|
| 114 | ✅ M | PR-7.5 |
| 134 | ✅ S | PR-7.4 |
| 135 | 🟡 deferred | — |
| 205 | 🟡 deferred (별도 spec) | — |
| 210 | ✅ XS | PR-7.6 |
| 213 | ✅ S | PR-7.7 |
| 215 | 🟡 deferred (별도 spec) | — |
| 223 | ✅ S | PR-7.8 |
| 229 | 🟡 deferred (deep redesign) | — |
| 230 | ✅ XS | PR-7.2 |
| 251 | (Phase 5 PR-5.5) | — |
| 263 | 🟡 deferred (별도 spec) | — |
| 284 | ✅ S | PR-7.3 |

### Category H: 제외 (vague / 정보 부족)
- #117 — 재현 정보 0
- #275 — self-hosted 환경, 별도 triage

### Category I: 제외 (out of plugin scope)
- #208 — Claude Code harness (`enabledPlugins` 자동화)
- #310 (부분) — codex CLI upstream JSONL parser
- #141 — macOS Apple SCDynamicStore (Codex CLI / Antigravity host issue)

---

## 2. Phase 0 — 테스트 인프라 베이스라인

### 목적
모든 후속 PR 의 회귀 차단 + failure mode 재현 능력 확보. tests/helpers.mjs 강화 + contract test layer + CI matrix 확장.

### PR-0.1 — 테스트 broker 자동 teardown (#163)
- **사이즈**: S
- **파일**: [tests/helpers.mjs](../../tests/helpers.mjs), tests/runtime.test.mjs (afterEach hook)
- **변경**:
  - `createTestWorkspace()` 가 broker pidfile 추적 set 등록
  - `cleanupTestWorkspace(ws)` 가 set 의 모든 broker PID 에 SIGTERM + 5s 후 SIGKILL
  - `process.on('exit')` 에 final sweep 등록
- **테스트**: `tests/teardown.test.mjs` 신규 — 100 회 createTestWorkspace 후 broker 잔존 0 검증
- **수용 기준**: `ls /tmp/cxc-* | wc -l` 가 테스트 후 0
- **위험**: 낮음 (테스트 인프라 only, runtime 영향 없음)
- **롤백**: revert single commit

### PR-0.2 — Failure mode contract test layer (regression baseline)
- **사이즈**: M
- **파일**: tests/contracts/ 신규 폴더 + `tests/contracts/{rate-limit,large-prompt,broker-shutdown,state-race,sigterm,finalizing-stuck}.contract.test.mjs`
- **변경**: 각 failure mode 의 fixture replay
  - `rate-limit.contract`: stop-review-gate 가 429 stub 받았을 때 동작
  - `large-prompt.contract`: 6KB 이상 prompt 의 codex-rescue 호출 동작
  - `broker-shutdown.contract`: broker 가 응답 없을 때 sendBrokerShutdown 동작
  - `state-race.contract`: 동시 5 process 가 upsertJob 호출 → 모든 job 보존
  - `sigterm.contract`: 포그라운드 task 에 SIGTERM 발사 → state 가 terminal
  - `finalizing-stuck.contract`: phase=finalizing 5 min 초과 → fail-fast
- **테스트**: 본 PR 자체가 테스트. 각 contract 는 PR-1.x ~ PR-3.x 머지 시 RED→GREEN 전환 (TDD discipline)
- **수용 기준**: 모든 contract 가 v1.0.4 baseline 에서 RED (fix 전), 후속 PR merge 후 GREEN
- **위험**: 낮음 (테스트 only)
- **의존**: PR-0.1

### PR-0.3 — CI matrix 확장 (#310, #285, #277, #295)
- **사이즈**: M
- **파일**: [.github/workflows/pull-request-ci.yml](../../.github/workflows/pull-request-ci.yml)
- **변경**: 기존 single-os ubuntu-latest → matrix:
  - `ubuntu-latest` (Linux baseline)
  - `windows-latest` (Git Bash + PowerShell 둘 다)
  - `macos-latest` (Apple Silicon)
  - locale variant: `en_US.UTF-8` (default), `ko_KR.UTF-8`, `zh_TW.Big5` (Windows only)
  - shell variant: bash / pwsh / cmd (Windows only)
- **테스트**: matrix 셀 12 (3 OS × 4 locale·shell) 통과
- **수용 기준**: 각 셀에서 `npm test` + `npm run build` 통과
- **위험**: 낮음 (CI only). 단 cost 증가 (셀 12 = 기존 3배)
- **의존**: 없음

---

## 3. Phase 1 — 상태 / lifecycle 정합성 (state correctness)

### PR-1.1 — PID liveness reaper (#222 / #164 / #202 / #264 — 4 이슈 해결)
- **사이즈**: M
- **파일**: [plugins/codex/scripts/lib/state.mjs](../../plugins/codex/scripts/lib/state.mjs), [plugins/codex/scripts/lib/job-control.mjs](../../plugins/codex/scripts/lib/job-control.mjs)
- **변경**:
  - state.mjs 의 `isPidRunning` 을 export 로 승격
  - `listJobs(workspaceRoot, { reap = true })` 옵션 추가 — `status === "running" || "queued"` 인 job 의 `pid` 를 `isPidRunning` 검사
  - 죽은 PID 발견 시 `status: "failed"` + `failureReason: "process_died"` + `terminatedAt: nowIso()` 로 자동 reaper
  - reaper 적용 entry point: `handleStatus`, `handleResult`, `getResumeCandidate`, stop-review-gate-hook
- **테스트**:
  - `tests/contracts/zombie-running.contract.test.mjs` — 가짜 죽은 PID 로 job 만들고 listJobs 호출 후 status:failed 검증
  - regression: PID reuse 시나리오 (죽은 PID 가 새 process 로 재할당된 경우 — `processStartedAt` 비교 필요)
- **수용 기준**: contract test GREEN, 기존 테스트 모두 통과
- **위험**: MEDIUM — PID reuse false positive 위험. mitigation: state.json 에 `processStartedAt` 저장 후 `isProcessAliveAndOriginalStart(pid, originalStart)` 비교
- **롤백**: state.mjs 의 reaper logic 만 disable (옵션 default false)

### PR-1.2 — 포그라운드 SIGTERM/SIGINT/SIGHUP 핸들러 (#228)
- **사이즈**: S
- **파일**: [plugins/codex/scripts/codex-companion.mjs](../../plugins/codex/scripts/codex-companion.mjs) (`runForegroundCommand` 부근)
- **변경**:
  - process.on("SIGTERM"|"SIGINT"|"SIGHUP", handler)
  - handler: 현재 jobId 의 state 를 `status: "failed"` + `failureReason: "sigterm"` 로 update + best-effort `terminateProcessTree(codexPid)` + `process.exit(143)`
  - 멱등 (handler 중복 호출 방지)
- **테스트**: `tests/contracts/sigterm.contract.test.mjs` — child process 띄워 SIGTERM 발사 후 state 검증
- **수용 기준**: contract GREEN
- **위험**: 낮음
- **롤백**: handler 자체 제거

### PR-1.3 — finalizing phase 타임아웃 (#183)
- **사이즈**: S
- **파일**: [plugins/codex/scripts/lib/codex.mjs](../../plugins/codex/scripts/lib/codex.mjs) (line 445/460 근방), [tracked-jobs.mjs](../../plugins/codex/scripts/lib/tracked-jobs.mjs)
- **변경**:
  - `FINALIZING_PHASE_TIMEOUT_MS = 5 * 60 * 1000` 상수
  - phase=finalizing 진입 시 `finalizingStartedAt` 기록
  - tracked progress callback 에서 finalizing 5 min 초과 시 promise reject + `phase: "failed"` + `failureReason: "finalizing_timeout"`
- **테스트**: `tests/contracts/finalizing-stuck.contract.test.mjs` — fake codex CLI 가 finalizing 진입 후 응답 멈춤 시뮬레이션
- **수용 기준**: contract GREEN, 5 min 타임아웃 후 정상 정리
- **위험**: 낮음 (타임아웃 보수적)
- **롤백**: 상수를 Infinity 로

### PR-1.4 — broker.json race 봉합 (#286 race 3)
- **사이즈**: M
- **파일**: [plugins/codex/scripts/lib/broker-lifecycle.mjs](../../plugins/codex/scripts/lib/broker-lifecycle.mjs)
- **변경**:
  - state.mjs 의 `withStateLock` 패턴을 `withBrokerLock(workspaceRoot, fn)` 로 동일 적용
  - `ensureBrokerSession` 의 read-modify-write 전체를 lock 내로 이동
  - lock dir: `<state>/.broker.lock/`
- **테스트**:
  - `tests/contracts/state-race.contract.test.mjs` 확장 — 동시 5 process 가 ensureBrokerSession 호출, 모두 동일 broker 사용 검증
  - 기존 broker tests regression
- **수용 기준**: contract GREEN, broker 단일 인스턴스 보장
- **위험**: 낮음 (state.mjs 와 동일 패턴)
- **롤백**: lock 적용 해제

### PR-1.5 — per-job state JSON terminal state guarantee (#264)
- **사이즈**: M
- **파일**: [plugins/codex/scripts/lib/codex.mjs](../../plugins/codex/scripts/lib/codex.mjs) (`runAppServerTurn` finally), [tracked-jobs.mjs](../../plugins/codex/scripts/lib/tracked-jobs.mjs)
- **변경**:
  - `runAppServerTurn` 의 try/finally 에서 finally 가 항상 terminal state 로 마무리 보장
  - rollout JSONL 파일 (`~/.codex/sessions/.../rollout-*.jsonl`) 에서 task_complete 이벤트 fall-back 읽기 — bridge layer signal lost 시 canonical source 활용
  - state JSON 의 `pid` 가 dead 면 PR-1.1 reaper 가 추가 cleanup
- **테스트**: contract — fake codex 가 task_complete 이벤트 발생 후 즉시 죽는 시나리오
- **수용 기준**: state JSON 이 30s 내 terminal 도달
- **위험**: MEDIUM — rollout JSONL 경로 hard-coded 위험. mitigation: codex CLI 가 표준 location 보장 못 하면 graceful skip
- **롤백**: rollout fall-back 만 disable

### PR-1.6 — hook stdin async + non-blocking (#120 / #247 / #191)
- **사이즈**: M
- **파일**: [plugins/codex/scripts/stop-review-gate-hook.mjs](../../plugins/codex/scripts/stop-review-gate-hook.mjs), [plugins/codex/scripts/session-lifecycle-hook.mjs](../../plugins/codex/scripts/session-lifecycle-hook.mjs), [plugins/codex/scripts/lib/fs.mjs](../../plugins/codex/scripts/lib/fs.mjs)
- **변경**:
  - `readHookInput()` 을 async + `process.stdin` event-based 로 재작성
  - chunk accumulate + `end` event 에서 buffer concat → JSON.parse
  - timeout 5s (hook 시작 후 stdin 도착 안 하면 빈 객체 반환)
  - readStdinIfPiped 도 동일 패턴
  - main() 도 async, top-level `(async () => { … })().catch(…)`
- **테스트**:
  - contract — 5 concurrent hook spawn 으로 EAGAIN 재현 차단
  - Windows Git Bash 시뮬레이션 (stdin 미파이프) — 5s 후 빈 객체로 진행
- **수용 기준**: 동시 50 hook spawn 시 EAGAIN 0 건
- **위험**: MEDIUM — stop-review-gate 가 stdin 에 의존하던 기존 동작 변경. mitigation: 5s timeout + fallback empty input
- **롤백**: sync 버전 alongside 두고 ENV var (`CODEX_HOOK_STDIN_LEGACY=1`) 로 toggle

### PR-1.7 — broker idle watchdog tightening + codex.exe orphan handling (#193)
- **사이즈**: S
- **파일**: [plugins/codex/scripts/app-server-broker.mjs](../../plugins/codex/scripts/app-server-broker.mjs)
- **변경**:
  - IDLE_WATCHDOG_GRACE_MS 30 min → 10 min (configurable env `CODEX_BROKER_IDLE_GRACE_MS`)
  - broker 의 codex.exe app-server child 도 idle 시 동반 종료 (현재는 broker 만 self-exit)
  - shutdown path 에서 child 명시적 terminateProcessTree
- **테스트**: contract — broker idle 11 min 후 codex.exe app-server 도 종료 검증
- **수용 기준**: orphan codex 0 건 (idle 시나리오)
- **위험**: 낮음 (환경 var 로 fall-back)
- **롤백**: env var 으로 30 min 복원

### PR-1.8 — worktree + run_in_background hang 봉합 (#198)
- **사이즈**: M
- **파일**: [agents/codex-rescue.md](../../plugins/codex/agents/codex-rescue.md), [skills/codex-cli-runtime/SKILL.md](../../plugins/codex/skills/codex-cli-runtime/SKILL.md)
- **변경**:
  - codex-rescue agent 가 worktree isolation 환경 감지 시 강제 foreground (Bash timeout 600s 명시) + `--background` 무시
  - 검출 방법: cwd 에 `.git/worktrees/` 또는 부모가 `.claude/worktrees/` 일 경우
  - SKILL 에 동일 가이드 추가
- **테스트**: contract — fake worktree 환경에서 background 요청 강제 foreground 동작 검증
- **수용 기준**: worktree 환경에서 hang 0 건
- **위험**: 낮음
- **롤백**: agent prompt revert

---

## 4. Phase 2 — 샌드박스 / 승인 모델 정합성

### PR-2.1 — sandbox default omit → user codex config inherit (#240 / #167 / #304)
- **사이즈**: M
- **파일**: [codex-companion.mjs:680, 1002, 1015, 1024, 1036, 1048](../../plugins/codex/scripts/codex-companion.mjs#L680), [buildTaskRequest](../../plugins/codex/scripts/codex-companion.mjs)
- **변경**:
  - `--sandbox` 미입력 시 `sandbox` 필드를 request 객체에서 omit (현재는 default 강제 채움)
  - app-server 가 user `~/.codex/config.toml` 의 `sandbox_mode` fall-back 사용
  - review / adversarial-review 의 `sandbox: "read-only"` hard-code 도 동일 omit, 단 `--read-only` 명시 가이드 README 추가
  - `--write` 와 sandbox 분리 (PR-2.3 와 함께)
- **테스트**:
  - contract — `~/.codex/config.toml` 에 `sandbox_mode = "danger-full-access"` 후 codex-companion 호출, request 에 sandbox 필드 부재 검증
  - regression — `--sandbox <mode>` 명시 시 honor 검증
- **수용 기준**: contract GREEN, bwrap 미가용 환경에서 `--sandbox danger-full-access` 명시 없이 user config 만으로 동작
- **위험**: **HIGH (BREAKING)** — 기존 review 가 hard-coded read-only 였는데 user config 가 workspace-write 일 경우 동작 변경. mitigation: README MIGRATION 명시 + v1.1.0 minor bump 정당화 + `CODEX_PLUGIN_SANDBOX_DEFAULT=read-only` 환경 var 로 legacy 동작 복원
- **롤백**: 단일 commit revert

### PR-2.2 — `--full-access` sugar + approval policy 명시 (#124 / #145)
- **사이즈**: S
- **파일**: [codex-companion.mjs](../../plugins/codex/scripts/codex-companion.mjs), [agents/codex-rescue.md](../../plugins/codex/agents/codex-rescue.md), [skills/codex-cli-runtime/SKILL.md](../../plugins/codex/skills/codex-cli-runtime/SKILL.md)
- **변경**:
  - `--full-access` 플래그 신규 — `--sandbox danger-full-access --approval never` 의 alias
  - `--dangerously-skip-permissions` (Claude Code 호환 alias) 추가, 동일 동작
  - 명령 호출 시 stderr 에 명시적 경고 ("RUNNING WITHOUT SANDBOX OR APPROVALS")
- **테스트**: alias 가 정확히 두 옵션으로 풀리는지
- **수용 기준**: `/codex:rescue --full-access ...` 호출 시 sandbox + approval 모두 적용
- **위험**: 낮음 (opt-in 만)
- **롤백**: alias 제거

### PR-2.3 — `--write` 와 `--sandbox` 분리 (#304)
- **사이즈**: S
- **파일**: [codex-companion.mjs:1002](../../plugins/codex/scripts/codex-companion.mjs#L1002)
- **변경**:
  - `effectiveSandbox = sandbox ?? null` (PR-2.1 통합 시 null = omit)
  - `--write` 는 thread/start 의 `write` flag 만 결정, sandbox 와 독립
  - `--write` + 네트워크 필요 (예: git push) 시 `--sandbox workspace-write` 가 차단됨을 README 경고
- **테스트**: `--write` 단독 사용 시 user codex config 의 sandbox 채택 검증
- **수용 기준**: git push 가 user config 가 `danger-full-access` 일 때 정상 동작
- **위험**: PR-2.1 의존
- **롤백**: PR-2.1 와 동시

---

## 5. Phase 3 — 통신 / 응답 신뢰성

### PR-3.1 — rate-limit / infrastructure error 분리 (#306 / #248 / #273)
- **사이즈**: M
- **파일**: [plugins/codex/scripts/stop-review-gate-hook.mjs](../../plugins/codex/scripts/stop-review-gate-hook.mjs)
- **변경**:
  - `runStopReview` 의 결과 분류 3 카테고리:
    - (a) Codex 가 명시 BLOCK 응답 → `decision: "block"` (현행 유지)
    - (b) Codex 가 명시 ALLOW 응답 → `decision: "allow"`
    - (c) infrastructure failure (timeout / status≠0 / empty / invalid JSON / rate-limit shape) → `decision: "allow"` + stderr 경고 + telemetry stamp
  - rate-limit shape 검출: stderr/stdout 에 `429`, `rate_limit`, `usage limit`, `quota_exceeded` 패턴 매칭
  - "blocked" verdict 의 3 가지 원인 별도 로깅 (#273)
- **테스트**:
  - contract `rate-limit.contract.test.mjs` — fake codex 가 429 응답 시 stop-gate 가 allow + 경고
  - infra error contract — timeout / empty / invalid JSON 각각
- **수용 기준**: rate-limit 시나리오에서 무한루프 없음, CC token 추가 소비 없음
- **위험**: MEDIUM — 진짜 BLOCK 이 infra error 로 잘못 분류 시 review 우회. mitigation: BLOCK 시그너처 (예: `BLOCK:` prefix) 명시 protocol 강화
- **롤백**: 분류 로직만 revert

### PR-3.2 — large prompt → tmpfile + --prompt-file 자동 전환 (#308)
- **사이즈**: S
- **파일**: [plugins/codex/agents/codex-rescue.md](../../plugins/codex/agents/codex-rescue.md), [plugins/codex/skills/codex-cli-runtime/SKILL.md](../../plugins/codex/skills/codex-cli-runtime/SKILL.md), [plugins/codex/scripts/codex-companion.mjs](../../plugins/codex/scripts/codex-companion.mjs)
- **변경**:
  - codex-companion task 가 prompt 가 inline 으로 받았는데 ~3KB 초과 시 자동으로 `os.tmpdir()` 에 임시 파일 작성 후 `--prompt-file` 변환
  - 또는 stdin 으로 받기 (`--prompt-stdin` 신규 옵션)
  - codex-rescue agent SKILL 에 "prompt 가 크면 stdin 사용" 가이드 추가
- **테스트**: contract `large-prompt.contract.test.mjs` — 6KB / 60KB prompt 로 codex-rescue 호출 시 silent reject 없음
- **수용 기준**: 100KB prompt 까지 정상 전달
- **위험**: 낮음 (tmp 파일 cleanup 보장 — task 종료 시 rm)
- **롤백**: auto-conversion 비활성, manual `--prompt-file` 만

### PR-3.3 — codex-rescue agent ↔ SKILL `--background` 모순 제거 (#324)
- **사이즈**: S
- **파일**: [plugins/codex/agents/codex-rescue.md](../../plugins/codex/agents/codex-rescue.md), [plugins/codex/skills/codex-cli-runtime/SKILL.md](../../plugins/codex/skills/codex-cli-runtime/SKILL.md)
- **변경**:
  - 통일 룰: "user 가 명시 `--background` 또는 `--wait` 시에만 그 의도 따름. 미명시 시 항상 foreground."
  - agent prompt 의 "complicated 면 background prefer" 문구 제거
  - SKILL 의 "strip --background" 문구를 "preserve --background as user explicit choice" 로 수정
  - foreground 가 600s 초과할 risk 가 있으면 **별도 SKILL hint**: "task 가 길어 보이면 user 에게 `--background` 명시 권유"
- **테스트**: contract — `--background` 명시 시 background, 미명시 시 foreground
- **수용 기준**: stub return 0 건 (parent agent 가 wait 안 한 케이스 제외)
- **위험**: 낮음
- **롤백**: prompt revert

### PR-3.4 — review/adversarial-review `--background` 플래그 wire-up (#279 / #207)
- **사이즈**: S
- **파일**: [codex-companion.mjs `handleReviewCommand`](../../plugins/codex/scripts/codex-companion.mjs)
- **변경**:
  - `handleReviewCommand` 에서 `options.background` 읽기 추가 (현재 declared but never read)
  - background 분기에서 `enqueueBackgroundTask` 사용 (handleTask 와 대칭)
  - jobId 즉시 반환 + queued payload 렌더
- **테스트**: contract — `/codex:review --background` 호출 시 jobId 즉시 반환 + foreground stream 미발생
- **수용 기준**: queue payload 정상, foreground stream 미발생
- **위험**: 낮음
- **롤백**: 단일 commit revert

### PR-3.5 — streaming partial result + `/codex:status --tail` (#264 / #237)
- **사이즈**: M
- **파일**: [plugins/codex/scripts/codex-companion.mjs](../../plugins/codex/scripts/codex-companion.mjs), [plugins/codex/commands/status.md](../../plugins/codex/commands/status.md)
- **변경**:
  - `status --tail` 옵션 신규 — 가장 최근 N (기본 20) 개의 progress line 출력
  - `status --watch` 옵션 — running job 의 progress 를 stream
  - foreground task 의 partial findings 를 progress callback 으로 stdout 에 flush (현재는 final 만)
- **테스트**: contract — running job 에 status --tail 호출, partial 출력 검증
- **수용 기준**: user 가 background job 진행 상황을 실시간 확인 가능
- **위험**: 낮음
- **롤백**: 신규 옵션만 제거

### PR-3.6 — codex-rescue 600s 한도 → background+poll mode (#122)
- **사이즈**: M
- **파일**: [agents/codex-rescue.md](../../plugins/codex/agents/codex-rescue.md), [skills/codex-cli-runtime/SKILL.md](../../plugins/codex/skills/codex-cli-runtime/SKILL.md), README
- **변경**:
  - SKILL 에 "Bash 600s 한도" 명시 + foreground 가 5 min 초과 예상 시 `--background` + jobId 반환 + parent agent 가 `/codex:status --watch` 또는 `/codex:result --wait` polling 가이드
  - codex-rescue agent prompt 도 동일
- **테스트**: 본 PR 은 doc/prompt 변경, contract 는 PR-3.3 와 함께
- **수용 기준**: agent 가 600s 초과 task 에 background 자동 선택 + parent 가 polling 으로 결과 회수
- **위험**: 낮음 (가이드 변경)
- **롤백**: revert

### PR-3.7 — `-m` 단축 alias prompt token 소비 fix (#257)
- **사이즈**: XS
- **파일**: [plugins/codex/scripts/lib/args.mjs](../../plugins/codex/scripts/lib/args.mjs), [codex-companion.mjs aliasMap](../../plugins/codex/scripts/codex-companion.mjs)
- **변경**:
  - `aliasMap = { m: "model" }` 적용 (현재 review 에서는 누락) — 모든 command 에서 일관되게
  - 또는 alias 자체를 deprecate 하고 `--model` full form 만 허용 (silent OpenAI 400 에러 방지)
- **테스트**: contract — `-m gpt-5.4` 가 prompt 가 아닌 model 옵션으로 인식
- **수용 기준**: silent 400 에러 0 건
- **위험**: 낮음
- **롤백**: alias 제거

---

## 6. Phase 4 — Windows hardening

### PR-4.1 — `app-server.mjs` spawn("codex") PATHEXT (#287 / #259)
- **사이즈**: XS
- **파일**: [plugins/codex/scripts/lib/app-server.mjs](../../plugins/codex/scripts/lib/app-server.mjs) (line 188 부근)
- **변경**:
  - Windows 분기에서 `spawn("codex", …, { shell: process.platform === "win32" })`
  - 또는 `lib/process.mjs` 의 `buildCommandInvocation` 헬퍼 사용 (이미 PATHEXT 처리)
- **테스트**: Windows CI 매트릭스에서 spawn ENOENT 0 건
- **수용 기준**: Windows + npm shim install 환경에서 정상 동작
- **위험**: 낮음 (Windows 한정)
- **롤백**: 단일 commit revert

### PR-4.2 — hooks.json drive-aware path normalization (#285)
- **사이즈**: S
- **파일**: [plugins/codex/hooks/hooks.json](../../plugins/codex/hooks/hooks.json), session-lifecycle-hook 진입점에 path normalize wrapper
- **변경**:
  - hooks.json 의 `command` 를 wrapper script 로 변경 — wrapper 가 `${CLAUDE_PLUGIN_ROOT}` 의 mangled path 감지/normalize 후 node 실행
  - 또는 hooks.json 직접에서 `node` 호출 시 path 를 quoted + Windows abs 명시
- **테스트**: Windows CI 에서 D 드라이브 cwd / C 드라이브 plugin 으로 hooks 실행 검증
- **수용 기준**: MODULE_NOT_FOUND 0 건
- **위험**: 낮음
- **롤백**: hooks.json revert

### PR-4.3 — Git Bash taskkill flag escaping (#182 / #219)
- **사이즈**: S
- **파일**: [plugins/codex/scripts/lib/process.mjs](../../plugins/codex/scripts/lib/process.mjs) (`terminateProcessTree`)
- **변경**:
  - Git Bash / MSYS 감지: `process.env.MSYSTEM` 또는 `SHELL=*sh`
  - taskkill 호출 시 `--%` stop-parsing 또는 명시적 escape (`/PID 1234 /T /F` 를 inline string 으로 전달, args array 분리 X)
  - 비-English locale (zh-TW, ko-KR) 의 taskkill stdout encoding 안전 처리
- **테스트**: contract — Git Bash 환경 emulate (env MSYSTEM 설정) 후 taskkill 동작
- **수용 기준**: cancel 명령이 Windows Git Bash 에서 정상 종료
- **위험**: 낮음 (Windows + Git Bash 한정)
- **롤백**: revert

### PR-4.4 — CreateProcessAsUserW 1920 root cause (#295)
- **사이즈**: L
- **파일**: investigation 우선
- **변경**:
  - 1920 = ERROR_FILE_INVALID. Windows + Git Bash + sandbox=elevated 조합에서 발생
  - Codex CLI 의 sandbox token escalation 이 plugin 의 spawn env 변경과 충돌 가능성
  - investigation: dotnet 의 `cmd.exe /c` wrapper 검토, `windowsHide` / `windowsVerbatimArguments` 영향 측정
  - mitigation: shell tool-call 시 sandbox token elevation 시점에 child env 의 USERPROFILE / APPDATA 보존 보장
- **테스트**: Windows CI 에 sandbox=elevated 시나리오 추가
- **수용 기준**: shell tool-call 정상 동작 (재현 환경에서)
- **위험**: HIGH (Windows + 권한 token 영역, 깊은 탐색 필요)
- **롤백**: 변경 revert

### PR-4.5 — non-UTF-8 locale safe JSONL parsing (#310)
- **사이즈**: M
- **파일**: codex CLI upstream coordination (out of plugin scope) + [plugins/codex/scripts/lib/codex.mjs](../../plugins/codex/scripts/lib/codex.mjs) 의 stdout decoder
- **변경**:
  - plugin 측: child_process spawn 시 `env: { ...process.env, LANG: "en_US.UTF-8", LC_ALL: "en_US.UTF-8" }` 강제 (Windows 비-UTF-8 회피)
  - codex CLI 가 자체 stdout 을 UTF-8 보장하도록 upstream issue 제기
- **테스트**: zh-TW locale CI 매트릭스에서 codex review 정상
- **수용 기준**: Big5 byte sequence crash 0 건
- **위험**: MEDIUM — LANG/LC_ALL 강제가 user 의 다른 locale 의존성과 충돌 가능
- **롤백**: env override 제거

### PR-4.6 — review --background hang on Windows + Initializing hang (#277 / #236)
- **사이즈**: L
- **파일**: investigation — broker / spawn / stdio 영역
- **변경**:
  - investigation: bisection 5 datapoint (#277) 으로 single-version regression 아님 확인됨 → environment-state contamination 의심
  - hypothesis: child stdio pipe 의 backpressure 또는 broker socket 의 Windows named-pipe peculiarity
  - mitigation 1: spawn options 에 `windowsHide: true` + `detached: false` (review 는 단명) 명시
  - mitigation 2: 5 min 무진행 (logfile mtime 정지) 시 self-recover (kill + restart)
  - 본 작업은 PR 분리: PR-4.6a (mitigation), PR-4.6b (root cause investigation report)
- **테스트**: Windows CI 매트릭스에 9-sequential review 시나리오 추가
- **수용 기준**: 9 review 연속 성공 (workaround 가 검증한 hygiene routine 자동화)
- **위험**: HIGH — root cause 미특정. mitigation 만으로는 deterministic fix 어려움
- **롤백**: timeout-based recovery 비활성

### PR-4.7 — review --cwd worktree git-dir handling (#280)
- **사이즈**: S
- **파일**: [plugins/codex/scripts/lib/git.mjs](../../plugins/codex/scripts/lib/git.mjs) (`collectReviewContext`)
- **변경**:
  - cwd 가 worktree 일 경우 `git rev-parse --git-dir` 로 실제 git-dir 미리 확인 + Codex 에 prompt 로 전달
  - prompt 에 "use --git-dir=<path> for git commands" hint 명시
- **테스트**: worktree fixture 에서 review 동작 검증
- **수용 기준**: worktree 환경에서 sandbox-decline 회수 0 (현재 ~15회)
- **위험**: 낮음
- **롤백**: revert

---

## 7. Phase 5 — Auth / config / clientInfo

### PR-5.1 — clientInfo.name codex-namespaced (#199 / #276)
- **사이즈**: S
- **파일**: [plugins/codex/scripts/lib/app-server.mjs](../../plugins/codex/scripts/lib/app-server.mjs), [codex.mjs](../../plugins/codex/scripts/lib/codex.mjs)
- **변경**:
  - app-server `initialize` request 의 clientInfo.name 을 호스트명 ("Claude Code") → "codex-plugin-cc" 변경
  - clientInfo.version 을 plugin version (1.1.0)
- **테스트**: app-server protocol fixture 에서 clientInfo 검증
- **수용 기준**: gpt-5.5 가 400 invalid_request_error 안 함
- **위험**: 낮음 (하지만 codex-cli 가 plugin 식별로 다른 동작 할 가능성 — 현재로서는 OK)
- **롤백**: name 복원

### PR-5.2 — app-server access token refresh after logout/login (#281)
- **사이즈**: M
- **파일**: [plugins/codex/scripts/lib/codex.mjs](../../plugins/codex/scripts/lib/codex.mjs), [app-server.mjs](../../plugins/codex/scripts/lib/app-server.mjs)
- **변경**:
  - "access token could not be refreshed" 에러 패턴 검출 → broker shutdown + restart + 1회 retry
  - 또는 startup 시 `~/.codex/auth.json` mtime 변경 감지 → broker restart prompt
- **테스트**: contract — auth.json 변경 시뮬레이션 후 token refresh 정상
- **수용 기준**: codex logout/login 후 plugin 정상 동작
- **위험**: MEDIUM — broker restart 가 in-flight job 영향. mitigation: in-flight 0 인 경우만 자동 restart
- **롤백**: 자동 restart 비활성, 사용자에게 manual restart 안내만

### PR-5.3 — ChatGPT subscription 인증 (#320)
- **사이즈**: investigation
- **파일**: TBD
- **변경**: issue body 정보 부족 (현재 "Not working" 만), 재현 정보 수집 후 root cause 특정
- **수용 기준**: ChatGPT Plus / Free 모두 정상 인증
- **위험**: investigation 결과에 따라
- **롤백**: N/A

### PR-5.4 — custom base URL no-auth bypass (#233)
- **사이즈**: S
- **파일**: [plugins/codex/scripts/codex-companion.mjs](../../plugins/codex/scripts/codex-companion.mjs) (auth check 부분)
- **변경**:
  - user codex config 에 `openai_base_url` 가 OpenAI 외 endpoint 면 auth check skip
  - `CODEX_PLUGIN_SKIP_AUTH=1` 환경 var 으로 manual override
- **테스트**: contract — custom base URL 설정 시 auth check 우회
- **수용 기준**: self-hosted endpoint 사용 가능
- **위험**: MEDIUM — auth bypass 의 의도하지 않은 사용. mitigation: 명시 설정 (config or env) 필요
- **롤백**: bypass logic 제거

### PR-5.5 — per-job Codex profile selection (#251)
- **사이즈**: S
- **파일**: [codex-companion.mjs](../../plugins/codex/scripts/codex-companion.mjs), `--profile <name>` 옵션 추가
- **변경**:
  - `--profile <name>` 옵션 → app-server `thread/start` 의 `profile` 필드로 전달
  - codex-rescue agent 가 user 가 명시 시 forward
- **테스트**: contract — profile 명시 시 thread 가 해당 profile 로 시작
- **수용 기준**: profile 별 model/effort/sandbox 다르게 적용
- **위험**: 낮음
- **롤백**: 옵션 제거

### PR-5.6 — separate Codex home for plugin jobs (#282)
- **사이즈**: M
- **파일**: [codex-companion.mjs](../../plugins/codex/scripts/codex-companion.mjs), [app-server.mjs](../../plugins/codex/scripts/lib/app-server.mjs) (env 설정 부분)
- **변경**:
  - 옵션 1: env `CODEX_HOME=~/.codex/claude-code` 강제 (plugin 전용 home)
  - 옵션 2: thread metadata 에 `source: "codex-plugin-cc"` tag → Codex Desktop 이 필터 가능
  - 1 채택 시 user 의 기존 history 와 격리 (config.toml 도 별도)
- **테스트**: plugin 호출 후 `~/.codex` (default) 에 새 thread 미생성
- **수용 기준**: Codex Desktop 의 history feed 에 plugin jobs 미오염
- **위험**: HIGH (BREAKING) — user 가 plugin 의 thread 를 Codex Desktop 으로 resume 하는 시나리오 깨짐. mitigation: README MIGRATION 명시 + opt-out env var (`CODEX_PLUGIN_USE_DEFAULT_HOME=1`)
- **롤백**: env 강제 제거

### PR-5.7 — representative session naming (#283)
- **사이즈**: XS
- **파일**: [codex-companion.mjs `buildTaskRunMetadata`](../../plugins/codex/scripts/codex-companion.mjs)
- **변경**:
  - 현재 "Codex Companion Task: <task> l..." 의 `<task>` placeholder 를 prompt 의 첫 60자로 채움
  - thread/name/set RPC 호출
- **테스트**: contract — task 시작 후 thread name 이 "Codex Companion Task: Review Spectre.Console …" 형태
- **수용 기준**: Codex Desktop 에서 구분 가능
- **위험**: 낮음
- **롤백**: revert

### PR-5.8 — default model fall-back (#270)
- **사이즈**: S
- **파일**: [plugins/codex/scripts/lib/codex.mjs](../../plugins/codex/scripts/lib/codex.mjs), [codex-companion.mjs](../../plugins/codex/scripts/codex-companion.mjs)
- **변경**:
  - adversarial-review 가 `gpt-5.5 requires newer Codex` 400 검출 시 자동으로 `gpt-5.4` fall-back + 경고 출력
  - 또는 startup 시 codex CLI version detect 후 model compatibility 사전 체크
- **테스트**: contract — codex-cli 0.125 + gpt-5.5 시나리오에서 자동 fall-back
- **수용 기준**: silent 400 0 건
- **위험**: 낮음 (fall-back 실패 시 명시 에러)
- **롤백**: fall-back 비활성

---

## 8. Phase 6 — UX 행동

### PR-6.1 — codex-rescue Bash-denied detection (#158)
- **사이즈**: S
- **파일**: [plugins/codex/agents/codex-rescue.md](../../plugins/codex/agents/codex-rescue.md)
- **변경**:
  - agent prompt 에 명시: "Bash 가 denied 되면 fall-back 분석 절대 금지. user 에게 'Codex 호출이 차단되었다 — 권한 부여 필요' 명시 후 종료."
  - SKILL 에 동일 가이드
- **테스트**: prompt review (manual)
- **수용 기준**: Bash denied 시 거짓 background-task-started claim 0 건
- **위험**: 낮음
- **롤백**: revert

### PR-6.2 — rescue init lighter (#203 / #242)
- **사이즈**: M
- **파일**: [plugins/codex/agents/codex-rescue.md](../../plugins/codex/agents/codex-rescue.md), [skills/codex-cli-runtime/SKILL.md](../../plugins/codex/skills/codex-cli-runtime/SKILL.md), [skills/gpt-5-4-prompting/SKILL.md](../../plugins/codex/skills/gpt-5-4-prompting/SKILL.md)
- **변경**:
  - SKILL 본문 trim — 핵심 contract (~60 lines) 만 유지, examples / 부가 explainer 는 별도 doc 으로 추출
  - gpt-5-4-prompting SKILL 동일 (현재 너무 verbose)
  - 측정: token count 측정 도구로 init cost 50% 이상 감소 검증
- **테스트**: token count 측정 + 기존 동작 regression
- **수용 기준**: rescue init cost 절반 이하
- **위험**: 낮음 (semantics 유지)
- **롤백**: SKILL revert

### PR-6.3 — disable-model-invocation 재검토 (#211 / #269 / #238 / #213)
- **사이즈**: S
- **파일**: [plugins/codex/commands/{review,adversarial-review,cancel,result,status}.md](../../plugins/codex/commands/) frontmatter
- **변경**:
  - `disable-model-invocation: true` 가 명령을 skill list 에서 숨겨 user invocation 자체를 차단하는 문제 해결
  - 옵션 1: `disable-model-invocation` 제거 (user-invocable 기본)
  - 옵션 2: skill list 에 노출 + agent 자율 invoke 차단 분리 → Claude Code harness 기능 요청
  - 1 채택 권장 (간단 + #269 fix)
  - 동시 #213 — user-level config (예: `~/.config/codex-plugin-cc/config.json`) 로 default `--background` / `--effort` 설정 가능하게
- **테스트**: skill list 에 모든 명령 노출 검증
- **수용 기준**: `/codex:review` 가 user 직접 입력으로 항상 동작
- **위험**: 낮음
- **롤백**: frontmatter revert

### PR-6.4 — AskUserQuestion regression #42 reproduction (#232)
- **사이즈**: S
- **파일**: [plugins/codex/commands/rescue.md](../../plugins/codex/commands/rescue.md) frontmatter, [agents/codex-rescue.md](../../plugins/codex/agents/codex-rescue.md)
- **변경**:
  - rescue.md frontmatter 의 `allowed-tools: AskUserQuestion` 가 효과 없는 원인 조사
  - rescue agent 가 prompt 가 아닌 plain text 로 옵션 출력하는 동작 fix → AskUserQuestion 명시 호출
- **테스트**: contract — resume candidate 있을 때 AskUserQuestion 호출 검증
- **수용 기준**: user 가 옵션 클릭 가능
- **위험**: 낮음
- **롤백**: revert

### PR-6.5 — `/codex:review` 자동 wait/background 결정 (#221)
- **사이즈**: S
- **파일**: [plugins/codex/commands/review.md](../../plugins/codex/commands/review.md), [adversarial-review.md](../../plugins/codex/commands/adversarial-review.md)
- **변경**:
  - 현재 `--wait` / `--background` 미입력 시 `AskUserQuestion` 으로 매번 묻는 동작
  - 변경: review 의 예상 시간 (diff 크기 heuristic) 으로 자동 결정 (예: <500 라인 → wait, >=500 → background)
  - 또는 default 를 `--background` 로 (대부분 user 가 background 선호)
- **테스트**: contract — diff 크기별 default behavior
- **수용 기준**: 무인 실행 가능 (multi-step plan embedding)
- **위험**: 낮음
- **롤백**: AskUserQuestion 동작 복원

### PR-6.6 — review max-findings configurable (#298)
- **사이즈**: S
- **파일**: [plugins/codex/prompts/adversarial-review.md](../../plugins/codex/prompts/adversarial-review.md), [schemas/review-output.schema.json](../../plugins/codex/schemas/review-output.schema.json)
- **변경**:
  - `--max-findings <N>` (default 20) 옵션 추가
  - prompt 에 "report up to N material findings" 명시 (현재는 캡 없음 + 모델 자율로 ~3 만 반환)
  - schema 의 findings 항목 maxItems 제거
- **테스트**: contract — large diff 에서 findings >3 반환
- **수용 기준**: 1 cycle 으로 ~20 findings 회수 가능 (현재 8 cycle 필요)
- **위험**: 낮음 (token cost 증가 trade-off, default 20 보수적)
- **롤백**: 옵션 제거

### PR-6.7 — MCP elicitation forwarding + tool-loop guard (#258 / #250 / #115)
- **사이즈**: L
- **파일**: [plugins/codex/scripts/app-server-broker.mjs](../../plugins/codex/scripts/app-server-broker.mjs), [lib/app-server.mjs](../../plugins/codex/scripts/lib/app-server.mjs)
- **변경**:
  - app-server protocol 의 server-initiated request (`mcpServer/elicitation/request` 등) 처리 추가 (현재 `Unsupported server request:` 응답)
  - elicitation 을 Claude Code 로 forward 또는 default deny + 로깅
  - tool-call loop 검출: 같은 tool / args 가 N (기본 5) 회 연속 호출 시 강제 abort + 경고
- **테스트**: contract — elicitation 요청 시 hang 없음, tool-loop 시 abort
- **수용 기준**: xcode/XcodeListWindows 등 MCP 의존 review 정상
- **위험**: HIGH (protocol 호환성). mitigation: protocol fixture test
- **롤백**: 신규 handler 비활성

---

## 9. Phase 7 — Feature 추가 (선별)

### PR-7.1 — `/codex:test` 신규 명령 (#205) [DEFERRED — 별도 spec PR]

### PR-7.2 — `--resume-id <threadId>` 옵션 (#230)
- **사이즈**: XS
- **파일**: [codex-companion.mjs `task` handler](../../plugins/codex/scripts/codex-companion.mjs)
- **변경**: `--resume-id <id>` 옵션 → app-server `thread/resume` 직접 호출
- **테스트**: contract
- **수용 기준**: 기존 thread ID 로 resume 가능
- **위험**: 낮음

### PR-7.3 — `--context <path>` 옵션 (#284)
- **사이즈**: S
- **파일**: [codex-companion.mjs](../../plugins/codex/scripts/codex-companion.mjs)
- **변경**: `--context <path>` → 파일 내용을 prompt 앞에 주입
- **테스트**: contract
- **수용 기준**: file content 가 codex prompt 의 context 로 전달
- **위험**: 낮음

### PR-7.4 — completion 알림 (#134)
- **사이즈**: S
- **파일**: [codex-companion.mjs](../../plugins/codex/scripts/codex-companion.mjs), 신규 [scripts/notify.mjs](../../plugins/codex/scripts/notify.mjs)
- **변경**:
  - background task 완료 시 OS-native 알림 (macOS osascript / Windows toast / Linux notify-send)
  - full log 미전송 — summary 만 (#134 요청)
- **테스트**: contract — task 완료 시 notify 호출 검증 (mock)
- **수용 기준**: user 가 OS 알림으로 완료 인지 가능
- **위험**: 낮음 (best-effort, 실패 시 silent)

### PR-7.5 — review remote branches without checkout (#114)
- **사이즈**: M
- **파일**: [plugins/codex/scripts/lib/git.mjs](../../plugins/codex/scripts/lib/git.mjs)
- **변경**:
  - `--base origin/main` 처럼 remote ref 도 처리 가능하게 (현재는 local checkout 필요)
  - `git fetch <remote> <ref>` + `git diff` 가상 ref
- **테스트**: contract — origin/main 등 remote ref 로 review
- **수용 기준**: PR review without local checkout
- **위험**: 낮음

### PR-7.6 — `--fast` flag (service_tier=fast) (#210)
- **사이즈**: XS
- **파일**: [codex-companion.mjs](../../plugins/codex/scripts/codex-companion.mjs)
- **변경**: `--fast` → app-server request 의 `service_tier: "fast"` 필드
- **테스트**: contract
- **수용 기준**: fast tier 호출 가능
- **위험**: 낮음

### PR-7.7 — user-level config defaults (#213)
- **사이즈**: S
- **파일**: [codex-companion.mjs](../../plugins/codex/scripts/codex-companion.mjs), 신규 config loader
- **변경**:
  - `~/.config/codex-plugin-cc/config.json` 또는 `~/.codex/plugin-cc.json` 에서 default 옵션 (`stopReviewGate`, `defaultEffort`, `defaultSandbox` 등) 로드
  - command-line 옵션이 우선
- **테스트**: contract — config 파일 default 가 적용 검증
- **수용 기준**: user 가 매번 옵션 명시 안 해도 default 동작 일관
- **위험**: 낮음

### PR-7.8 — non-interactive mode (claude --print) 지원 (#223)
- **사이즈**: S
- **파일**: [plugins/codex/commands/review.md](../../plugins/codex/commands/review.md) frontmatter, codex-companion.mjs
- **변경**:
  - non-interactive 환경 (`claude --print`) 감지 → AskUserQuestion 우회 + default mode (PR-6.5 와 통합)
- **테스트**: claude --print + /codex:review 시나리오
- **수용 기준**: non-interactive 정상 동작
- **위험**: 낮음

---

## 10. Phase 8 — Documentation & migration

### PR-8.1 — README sandbox + auth section 강화
- **사이즈**: S
- **파일**: [README.md](../../README.md)
- **변경**: sandbox config inherit 동작, `--full-access` / `--dangerously-skip-permissions` 사용법, custom base URL 사용법

### PR-8.2 — TROUBLESHOOTING.md 신규
- **사이즈**: S
- **파일**: 신규 `docs/TROUBLESHOOTING.md`
- **내용**: 5 failure mode 별 진단 + workaround (rate-limit 무한루프 / large prompt / Bash 600s / Windows hang / sandbox 차단)

### PR-8.3 — MIGRATION_v1.1.md
- **사이즈**: S
- **파일**: 신규 `docs/MIGRATION_v1.1.md`
- **내용**: breaking change (sandbox default omit + Codex home 분리) + opt-out env var 안내

### PR-8.4 — CHANGELOG v1.1.0
- **사이즈**: S
- **파일**: [plugins/codex/CHANGELOG.md](../../plugins/codex/CHANGELOG.md)
- **내용**: 모든 PR 의 변경사항 요약

### PR-8.5 — agent / SKILL doc consistency audit
- **사이즈**: S
- **파일**: agents/, skills/
- **내용**: PR-3.3 와 정합되도록 모순 표현 일소

---

## 11. 의존성 그래프 (PR-level)

```
Phase 0:
  PR-0.1 (broker teardown)
  PR-0.2 (contract baseline) ◄─── PR-0.1
  PR-0.3 (CI matrix)

Phase 1: (depends on Phase 0)
  PR-1.1 (PID reaper) ◄─── PR-0.2
  PR-1.2 (SIGTERM handler) ◄─── PR-0.2
  PR-1.3 (finalizing timeout) ◄─── PR-0.2
  PR-1.4 (broker race) ◄─── PR-0.2
  PR-1.5 (terminal state) ◄─── PR-1.1
  PR-1.6 (hook stdin async) ◄─── PR-0.2
  PR-1.7 (broker idle) ◄─── PR-0.2
  PR-1.8 (worktree hang) ◄─── PR-0.2

Phase 2: (parallel to Phase 1)
  PR-2.1 (sandbox omit) ◄─── PR-0.2
  PR-2.2 (--full-access) ◄─── PR-2.1
  PR-2.3 (--write decouple) ◄─── PR-2.1

Phase 3: (parallel to Phase 1, depends on Phase 0)
  PR-3.1 (rate-limit) ◄─── PR-0.2
  PR-3.2 (large prompt) ◄─── PR-0.2
  PR-3.3 (--background) ◄─── PR-0.2
  PR-3.4 (review --background wire) ◄─── PR-0.2
  PR-3.5 (streaming) ◄─── PR-1.5
  PR-3.6 (600s) ◄─── PR-3.3
  PR-3.7 (-m alias) ◄─── PR-0.2

Phase 4: (depends on Phase 1, + Codex C3 edge: PR-4.6 ◄─── PR-3.4)
  PR-4.1 (PATHEXT) — IMPLEMENTED (Codex C5), spawn options 점검만 잔존 → trim
  PR-4.2 (drive-aware) ◄─── PR-0.3
  PR-4.3 (taskkill) ◄─── PR-0.3
  PR-4.4 (CreateProcessAsUserW) ◄─── PR-0.3 + spike PR-4.4-spike (Codex 0.2 #2)
  PR-4.5 (locale UTF-8) ◄─── PR-0.3
  PR-4.6 (Windows hang) ◄─── PR-1.7 + spike PR-4.6-spike + PR-3.4 (Codex C3)
  PR-4.6 (Windows hang) ◄─── PR-1.7 + investigation
  PR-4.7 (worktree git-dir) ◄─── PR-0.3

Phase 5: (parallel to Phase 4)
  PR-5.1 (clientInfo) ◄─── PR-0.2
  PR-5.2 (token refresh) ◄─── PR-1.4
  PR-5.3 (ChatGPT auth) ◄─── investigation
  PR-5.4 (custom base URL) ◄─── PR-0.2
  PR-5.5 (profile) ◄─── PR-0.2
  PR-5.6 (Codex home) ◄─── PR-0.2
  PR-5.7 (session naming) ◄─── PR-0.2
  PR-5.8 (model fallback) ◄─── PR-0.2

Phase 6: (parallel to Phase 5)
  PR-6.1 (Bash denied) ◄─── PR-3.3
  PR-6.2 (rescue init) ◄─── (independent)
  PR-6.3 (disable-model-invocation) ◄─── (independent)
  PR-6.4 (AskUserQuestion) ◄─── PR-3.3
  PR-6.5 (auto wait/background) ◄─── PR-3.4
  PR-6.6 (max-findings) ◄─── (independent)
  PR-6.7 (MCP elicitation) ◄─── PR-1.4

Phase 7: (depends on Phase 5/6)
  PR-7.2 (--resume-id) ◄─── PR-5.5
  PR-7.3 (--context) ◄─── PR-3.2
  PR-7.4 (notification) ◄─── PR-1.5
  PR-7.5 (remote branches) ◄─── (independent)
  PR-7.6 (--fast) ◄─── (independent)
  PR-7.7 (user config) ◄─── PR-2.1
  PR-7.8 (non-interactive) ◄─── PR-6.5

Phase 8: (last — depends on all)
  PR-8.1, PR-8.2, PR-8.3, PR-8.4, PR-8.5
```

---

## 12. 위험 / 롤백 매트릭스

| PR | 위험 등급 | 주요 위험 | Mitigation | Rollback 방법 |
|---|---|---|---|---|
| PR-1.1 | MEDIUM | PID reuse false positive | `processStartedAt` 비교 | reaper opt-in (default off) 후 점진 enable |
| PR-1.5 | MEDIUM | rollout JSONL 경로 가정 | graceful skip | rollout fall-back disable |
| PR-1.6 | MEDIUM | sync→async semantics 변경 | env var legacy mode | `CODEX_HOOK_STDIN_LEGACY=1` |
| PR-2.1 | **HIGH** (BREAKING) | review 가 user config workspace-write 면 동작 변경 | env var `CODEX_PLUGIN_SANDBOX_DEFAULT=read-only` | env 명시로 legacy 복원 |
| PR-3.1 | MEDIUM | 진짜 BLOCK 을 infra error 로 오분류 | `BLOCK:` prefix protocol 명시 | 분류 로직 revert |
| PR-4.4 | HIGH | Windows token escalation 깊은 영역 | 분리 PR + investigation 우선 | mitigation 만 적용, root cause 후속 |
| PR-4.5 | MEDIUM | LANG 강제가 다른 locale 의존성과 충돌 | env override 명시 documentation | env 강제 제거 |
| PR-4.6 | HIGH | Windows hang root cause 미특정 | mitigation 만 적용, deterministic fix 후속 | timeout-based recovery 비활성 |
| PR-5.2 | MEDIUM | broker restart 가 in-flight 영향 | in-flight 0 일 때만 자동 restart | 자동 restart 비활성 |
| PR-5.4 | MEDIUM | auth bypass 의도치 않은 사용 | 명시 설정 (config / env) 필요 | bypass logic 제거 |
| PR-5.6 | **HIGH** (BREAKING) | Codex Desktop resume 시나리오 깨짐 | env `CODEX_PLUGIN_USE_DEFAULT_HOME=1` | env 강제 제거 |
| PR-6.7 | HIGH | protocol 호환성 | protocol fixture test | 신규 handler 비활성 |

---

## 13. Acceptance Criteria (Phase-level)

### Phase 0 완료
- [ ] 100 회 createTestWorkspace 후 broker 잔존 0
- [ ] failure mode contract 6 개 모두 RED (baseline)
- [ ] CI matrix 12 cell 모두 green

### Phase 1 완료
- [ ] 모든 contract test (zombie / sigterm / finalizing / state-race / broker-shutdown / hook-stdin) GREEN
- [ ] 24 시간 dogfooding session 에서 status:running 영구 잔존 0 건
- [ ] hook EAGAIN 0 건 (50 concurrent spawn)

### Phase 2 완료
- [ ] user `~/.codex/config.toml` 의 sandbox_mode 가 honor 됨
- [ ] bwrap 미가용 환경에서 `--sandbox danger-full-access` user config 로 동작
- [ ] `--full-access` / `--dangerously-skip-permissions` 작동

### Phase 3 완료
- [ ] rate-limit 시 stop-gate 무한루프 0 건
- [ ] 100KB prompt 의 codex-rescue silent reject 0 건
- [ ] codex-rescue stub return 0 건 (background 미명시 시)
- [ ] review --background 정상 큐잉

### Phase 4 완료
- [ ] Windows CI matrix 모두 green
- [ ] zh-TW / ko-KR locale 에서 codex review 정상
- [ ] worktree 환경 sandbox-decline 회수 0

### Phase 5 완료
- [ ] gpt-5.5 가 400 invalid_request_error 0 건
- [ ] codex logout/login 후 plugin 자동 복구
- [ ] Codex Desktop history feed 분리 (opt-out 가능)

### Phase 6 완료
- [ ] rescue init token cost 50% 감소
- [ ] disable-model-invocation 으로 인한 hidden command 0 건
- [ ] review 1 cycle 으로 ~20 findings 회수

### Phase 7 완료
- [ ] 선별 6 feature 정상 동작
- [ ] 기존 동작 regression 0 건

### Phase 8 완료
- [ ] CHANGELOG / MIGRATION / TROUBLESHOOTING 문서 일관성
- [ ] README 의 모든 예제 dogfooding 으로 검증

---

## 14. Codex Pair-Validation 게이트

각 Phase 종료 시 `/codex:rescue --background "validate Phase N implementation against this ULTRAPLAN"` 실행. 결과를 PR review 에 첨부.

특히 다음 PR 은 머지 전 Codex pair-validation 필수:
- **PR-2.1** (BREAKING)
- **PR-4.4** (Windows token 영역)
- **PR-4.6** (Windows hang root cause)
- **PR-5.6** (BREAKING)
- **PR-6.7** (protocol 호환성)

Codex unavailable 시 / 본 PR 의 dogfooding 패턴이 위험 시 → Claude code-reviewer + reviewer agent 2명 (3 시각) 으로 대체.

---

## 15. 미탐색 영역 (Goal: 0)

본 ULTRAPLAN 에서 잔존하는 미탐색 영역:

| 영역 | 탐색 깊이 | 추가 탐색 방법 |
|---|---|---|
| #117 (vague body) | L0 | reporter 에 재현 정보 요청 |
| #275 self-hosted | L1 | self-hosted Claude Code 환경 별도 dogfooding |
| #229 Codex Desktop context capture | L2 (deep redesign) | 별도 spec 작업 (Phase 9 후속) |
| #135 git worktree isolation | L1 (isolation 의 deeper redesign) | 별도 spec |
| #205 /codex:test | L1 (별도 명령 spec) | 별도 spec |
| #215 jujutsu (jj) workspaces | L1 | jj 사용자 dogfooding 필요 |
| #263 /codex:implement/execute | L1 | 별도 spec |
| #310 zh-TW Big5 (root cause) | L2 (codex CLI upstream) | upstream coordination — plugin 측은 PR-4.5 로 mitigation |
| #141 macOS SCDynamicStore NULL | L1 | Apple Silicon + Antigravity 환경 dogfooding 필요 |
| issue 101 번 이상 (이전 100건 cap) | L0 | `gh issue list --search …` 로 확장 |

위 영역은 별도 sprint / spec 작업으로 분리 필요. 본 ULTRAPLAN 은 v1.1.0 에 집중.

---

## 16. Release Train (v2 — Codex audit D1-C 채택)

### v1.0.5 — 안전 fix train (Phase 0 + 1)

**Scope**: contract baseline + 모든 state/lifecycle 정합성 PR (zero BREAKING)

- PR-0.1, PR-0.2, PR-0.3
- PR-1.1 (PID reaper, OS birth time mitigation 포함 — Codex C9)
- PR-1.2 (SIGTERM handler)
- PR-1.3 (finalizing timeout)
- PR-1.4 (broker race)
- PR-1.5 (terminal state)
- PR-1.6 (hook stdin async)
- PR-1.7 (broker idle)
- PR-1.8 (worktree hang)

**Acceptance**: § 13 Phase 0 + Phase 1 acceptance 모두 통과 + 7-day dogfooding (Linux 우선)

### v1.0.6 — Windows / auth hardening (Phase 4 + 5 일부)

**Scope**: cross-platform 안정성 (zero BREAKING)

- PR-4.2 / 4.3 / 4.5 / 4.6 / 4.7 (PR-4.1 은 Codex C5 로 implemented 분류, drop)
- PR-4.4-spike (Windows token investigation, separate PR)
- PR-4.6-spike (Windows hang investigation, separate PR)
- PR-5.1 (clientInfo namespacing — opt-in env 처음, 1.0.6 은 default 유지)
- PR-5.2 (token refresh)
- PR-5.4 (custom base URL)
- PR-5.5 (profile)
- PR-5.7 (session naming)
- PR-5.8 (model fallback)

**Acceptance**: Windows + macOS + Linux CI matrix 12 cell green + zh-TW/ko-KR locale dogfooding

### v2.0.0 — BREAKING + stabilization (Phase 2 + 5.6 + 3 + 6)

**Scope**: 2 BREAKING change + 응답 신뢰성 + UX (Codex C1 명시 — 2 BREAKING 기록)

- **BREAKING #1**: PR-2.1 — sandbox default omit (Codex C4 fidelity 반영: codex-companion.mjs:680/1002 + lib/codex.mjs:59-78 모두 수정)
- **BREAKING #2**: PR-5.6 — Codex home 분리
- PR-2.2 (--full-access), PR-2.3 (--write decouple)
- PR-3.1 ~ PR-3.6 (rate-limit / large prompt / --background 모순 / review wire / streaming / 600s)
- PR-3.7 — Codex C6 으로 implemented 분류, contract test 만 잔존
- PR-5.1 default 변경 (1.0.6 의 opt-in → 2.0.0 default)
- PR-6.1 ~ PR-6.6
- PR-6.7a (tool-loop guard) + PR-6.7b (protocol fixture matrix) — Codex C8 분할

**Migration safety (Codex C11)**:
- 첫 호출 시 stderr 에 BREAKING 변경 사항 출력 (PR-8.6 신규)
- opt-out env: `CODEX_PLUGIN_SANDBOX_DEFAULT=read-only`, `CODEX_PLUGIN_USE_DEFAULT_HOME=1`
- MIGRATION_v2.0.md 의 behavior matrix + FAQ + rollback env 종합

**Acceptance**: § 13 Phase 2 + 3 + 6 acceptance 통과 + 14-day RC dogfooding (3 OS) + Codex pair-validation 5 high-risk PR 통과

### v1.2.0 — Feature train (Phase 7 + 9)

**Scope**: feature additions + telemetry/observability (Codex 권장 #9)

- PR-7.2 ~ PR-7.8 (선별 6 feature)
- PR-9.1 (JSONL telemetry event log)
- PR-9.2 (correlation ID)
- PR-8.* (docs)

**Acceptance**: feature acceptance + telemetry SLO 정의

### Phase-level Rollback gate (Codex C10)

각 Phase 종료 시:

1. tag `v<train>-phase<N>-rollback` 생성 (revert 기준점)
2. v1.0.4 baseline 과의 contract test diff 보고서
3. dogfooding session log 첨부
4. 후속 Phase 진행 전 rollback gate 사용자 승인

### 새 기능 (CHANGELOG 명시)
- `--full-access`, `--dangerously-skip-permissions`
- `--profile`, `--resume-id`, `--context`, `--fast`, `--max-findings`
- `--prompt-stdin` (large prompt 지원)
- `status --tail`, `status --watch`
- OS-native 완료 알림
- user-level config 파일

### 안정성 개선 (CHANGELOG 명시)
- PID liveness reaper (zombie running state 자동 정리)
- 포그라운드 SIGTERM 핸들러
- finalizing phase timeout
- broker.json race 봉합
- hook stdin async (EAGAIN 차단)
- worktree + background hang 봉합
- rate-limit infrastructure error 분리 (stop-gate 무한루프 차단)
- large prompt 자동 file 변환
- Windows: PATHEXT, drive 분리, taskkill, locale UTF-8
- gpt-5.5 model fallback

---

## 17. 결론

| 영역 | 본 ULTRAPLAN 의 답 |
|---|---|
| 모든 이슈 해결? | 38 PR 로 55+ 이슈 해결, 7+ 이슈는 별도 spec 분리 (Phase 9+) |
| 깔끔한 구현? | atomic PR + contract test 동반 + dependency graph 명확 |
| 미탐색 0? | § 15 의 10 항목은 별도 sprint scope, 본 PR series 외 |
| Codex 사용? | § 14 게이트로 critical PR (BREAKING / Windows / protocol) 은 Codex pair-validation 필수 |

본 plan 의 38 PR 을 8 Phase 로 진행하면 **v1.0.4 → v1.1.0** 에서 **production 무인 위임 + multi-platform + 대용량 task** 시나리오까지 안정적으로 cover 가능.
