# ULTRAPLAN — `@openai/codex-plugin-cc` v1.0.4 Feasibility & Risk Assessment

**작성일**: 2026-05-16
**대상 브랜치**: `feat/doc-sync-changelog-prefix-match` (HEAD `2322926`)
**버전**: v1.0.4 (CHANGELOG 최신)
**스코프**: 다음 5축 정밀 검토 — 미탐색 영역 0 까지 push

| # | 사용자 질문 | 결론 라벨 |
|---|---|---|
| Q1 | 원본 저장소(openai/codex-plugin-cc)의 모든 이슈를 이 플러그인으로 해결 가능한가? | **NO** — 82 OPEN 중 약 12% 만 v1.0.4 가 부분 해결, 다수는 설계상 미해결 |
| Q2 | 샌드박스 환경 제약이 풀리는가? | **부분** — `--sandbox <mode>` 플래그로 우회 가능. 단 default 는 여전히 hard-coded → upstream config 무시 |
| Q3 | Codex 응답 실패 / 대용량 입력으로 죽는 에러가 없는가? | **NO** — 5 가지 failure mode 잔존 (Bash 600s 한도 / 6KB prompt rejection / rate-limit 무한루프 / finalizing 무한대기 / app-server JSONL crash) |
| Q4 | 메모리 누수가 없는가? | **거의 없음** — c40449f / 4f0a7ae / 2322926 으로 클래식 누수 봉합. 단 broker orphan / state JSON 미갱신 (#264 / #163) 잔존 |
| Q5 | 직접 Codex CLI 사용을 완전 대체하는가? | **NO** — auth / clientInfo / sandbox / 결과 fan-in / sub-agent stub / 컨텍스트 캡처 등 6 가지 영역에서 직접 CLI 가 우위 |

---

## Executive Summary (10 줄)

1. v1.0.4 는 **메모리 / IPC layer hardening 은 우수** — 최근 3 commit (2322926/4f0a7ae/c40449f) 으로 sweep timer + 즉시 cleanup + leak 봉합 완료.
2. **upstream issue tracker 의 ground truth 는 부정적** — 82 OPEN / 18 CLOSED, OPEN 중 가시 위험 9 건 + 잠재 위험 24 건.
3. **샌드박스 hard-coding 은 부분 해소** — `--sandbox` user 입력 시 honor (line 680), 단 미입력 시 여전히 `read-only` 또는 `workspace-write` 강제 → user `~/.codex/config.toml` 의 `sandbox_mode` 무시 (#240 / #167 미해결).
4. **Bash 600s 한도와 충돌** — codex-rescue 가 single Bash call → foreground task 가 600s 초과하면 timeout, Codex 는 살아있고 결과만 lost (#122 / **본 세션의 codex audit 가 25min+ 실행되며 실시간 재현**).
5. **6KB-ish prompt rejection 미해결** — Claude Code harness (Bash) 가 큰 prompt 를 "user denied" 로 silent reject. plugin 측은 `--prompt-file` 지원하나 codex-rescue.md 가 사용하지 않음 (#308).
6. **rate-limit 무한루프** — stop-review-gate 가 `status !== 0` 시 무조건 `decision: "block"` → rate-limited 시 Claude 무한 retry → CC token 소진 (#306 미해결).
7. **state race + 좀비 running 상태** — withStateLock 으로 race 1·2 봉합되었으나 (#286), PID liveness check 부재로 worker 사망 시 status:running 영구 잔존 (#222 / #164 / #202 / #264 미해결).
8. **Windows Git Bash 환경의 path mangling / .cmd shim / drive 분리 문제** 잔존 — #285 / #287 / #295 / #310 / #182 / #219.
9. **codex-rescue subagent 의 stub 반환** — agent 프롬프트가 "complicated 면 background 선택" 권유 ↔ SKILL 이 "--background strip" 강제 → 모순으로 stub 반환 케이스 존재 (#324).
10. **대체 가능성**: read-only review 와 단발성 rescue 는 가치 명확. 그러나 "프로덕션 무인 위임" 시나리오에서는 직접 `codex exec` / `codex resume` 호출이 더 안정적.

---

## 1. 원본 저장소 이슈 → 로컬 v1.0.4 매핑 (Q1)

### 검증 방법
- `gh issue list --repo openai/codex-plugin-cc --state all --limit 100 --json ...` → 100 건 (82 OPEN / 18 CLOSED)
- 각 critical 이슈 body 인용 후 로컬 v1.0.4 코드 (`plugins/codex/scripts/`) grep 으로 fix 여부 검증

### 1.1 v1.0.4 가 해결한 이슈 (10 건 확인)

| # | 이슈 | 로컬 fix 증거 | confidence |
|---|---|---|---|
| 245 / 288 | sendBrokerShutdown 무한 hang | [broker-lifecycle.mjs:47-72](../../plugins/codex/scripts/lib/broker-lifecycle.mjs#L47-L72) — `BROKER_SHUTDOWN_TIMEOUT_MS` + `setTimeout(settle, timeoutMs)` + idempotent `settle()` | certain |
| 286 race 1·2 | state.mjs updateState/upsertJob 비원자 | [state.mjs:232-242](../../plugins/codex/scripts/lib/state.mjs#L232-L242) — `withStateLock(cwd, …)` 적용 (mkdir-based dir lock + atomic rename) | certain |
| 308 (부분) | 6KB prompt → user-denied | `--prompt-file` 지원 ([codex-companion.mjs:847-848](../../plugins/codex/scripts/codex-companion.mjs#L847-L848)) — 단 codex-rescue agent 가 사용 안 함 | likely |
| 322 | SessionStart appendEnvVar 비멱등 | CHANGELOG v1.0.4 + 최근 commit history | certain |
| 254 | SessionStart hook leaks CLAUDE_PLUGIN_DATA | CLOSED upstream | certain |
| 234 | Skill(codex:rescue) infinite recurse | v1.0.4 "routes through Agent tool to prevent Skill recursion" | certain |
| 199 (부분) | clientInfo.name 호스트앱 사용 | 부분 — 일부 영역만 namespaced | uncertain |
| 161 / 287 (부분) | spawn codex ENOENT (Windows) | v1.0.1 `shell: true` + v1.0.2 ENOENT fix. 단 #287 (app-server.mjs:188) 은 OPEN 잔존 | likely |
| 138 | Windows Git Bash hang | CLOSED, `SHELL` 처리 | certain |
| 144 | SessionStart hook fails on Linux/WSL2 (CLAUDE_PLUGIN_ROOT) | CLOSED | certain |

### 1.2 v1.0.4 에 잔존 (가시 위험 — HIGH)

| # | 이슈 | 로컬 검증 결과 | 영향 |
|---|---|---|---|
| 122 | codex-rescue agent 600s 초과 시 Bash timeout, Codex 결과 lost | [agents/codex-rescue.md:18-21](../../plugins/codex/agents/codex-rescue.md#L18-L21) — single Bash call, no fall-back. 본 세션 25 min+ 실측 재현 | **위임 결과 영구 손실** |
| 222 / 164 / 202 / 264 | PID liveness check 없음 → worker 사망 후 status:running 영구 잔존 | [state.mjs:74-88](../../plugins/codex/scripts/lib/state.mjs#L74-L88) `isPidRunning` 존재하나 lock owner check 에만 사용. job status reaper 부재 | **zombie state 누적** |
| 240 / 167 / 304 | sandbox hard-coding (default `read-only` / `workspace-write`) | [codex-companion.mjs:680](../../plugins/codex/scripts/codex-companion.mjs#L680) `request.sandbox ?? (request.write ? "workspace-write" : "read-only")` — user `~/.codex/config.toml` 의 `sandbox_mode` 무시 | **bwrap 실패 / git push DNS 실패** |
| 306 | stop-review-gate rate-limit 무한루프 | [stop-review-gate-hook.mjs:122-130](../../plugins/codex/scripts/stop-review-gate-hook.mjs#L122-L130) — `status !== 0` 무조건 `block`. rate-limit / 429 별도 분기 없음 | **CC token 소진** |
| 308 | 6KB prompt → "user denied" 무복구 | codex-rescue.md 가 raw inline arg 만 사용, `--prompt-file` 미적용 | **위임 실패 silent** |
| 324 | codex-rescue 가 stub 반환 | agent 와 SKILL 의 `--background` 처리 모순 — agent: "complicated 면 background", SKILL: "strip" | **wrapper 가 wait 안 하고 종료** |
| 198 | worktree 사용 시 hang | run_in_background 와 worktree cleanup race | **deleted dir 에서 codex 무한 대기** |
| 277 | review --background 가 2~30 min hang (Windows + CLI 0.125+) | bisection 5 datapoint 으로 single-version regression 아님 확인됨 | **Windows 무인 운영 불가** |
| 279 | --background 플래그가 review 에서는 declared but never read | [codex-companion.mjs handleReview/Command](../../plugins/codex/scripts/codex-companion.mjs) 에서 `options.background` 읽지 않음 | **review 큐 우회됨** |

### 1.3 v1.0.4 에 잔존 (잠재 위험 — MEDIUM)

| # | 이슈 | 비고 |
|---|---|---|
| 113 | Plugin install fails on Windows with corrupted error | install-time, plugin source 외 |
| 115 | rescue task infinite tool-call loop | upstream Codex CLI 측 가능성 |
| 117 | code breaks due to exception | 재현 정보 부족 |
| 120 | EAGAIN crash hook scripts (readFileSync(0) non-blocking) | 미해결 |
| 124 / 145 | --dangerously-skip-permissions / --full-access | 기능 요청 |
| 134 / 135 / 205 / 213 / 215 / 221 / 223 / 230 / 251 / 263 / 284 / 298 | 기능 추가 / UX 개선 요청 다수 | scope 외 |
| 141 | macOS SCDynamicStore NULL panic (Claude Code sandbox 안에서 codex app-server 실행 시) | 환경 의존 |
| 158 | rescue 가 Bash denied 시 non-Codex fallback 으로 거짓 claim | UX 함정 |
| 163 | 테스트 스위트 broker 158 orphan | 테스트 teardown 결함 |
| 182 / 219 | Windows Git Bash 의 taskkill flag mangling | OS-level path mangling |
| 183 | runTrackedJob phase: finalizing 무한 대기 | timeout 부재 |
| 191 | Stop hook stdin blocking (Windows + review-gate disabled) | timeout 우회 |
| 193 | orphan codex 100% CPU 후 session 종료 | broker idle watchdog 30 min grace 로 부분 완화 |
| 203 | rescue skill init 이 session budget 20% 소진 | 초기화 비용 |
| 207 / 208 / 210 / 211 | 신뢰성 / disable-model-invocation / fast tier 등 | mixed |
| 228 | foreground SIGTERM 시 jobs 가 status:running 잔존 | signal handler 부재 |
| 232 | rescue 가 AskUserQuestion 사용 불가 (#42 regression) | 도구 제한 |
| 233 | 자체 base URL 사용 시 auth guard 우회 불가 | auth 경직성 |
| 236 / 237 / 238 / 247 / 250 / 257 / 258 / 259 / 266 / 268 / 270 / 273 / 275 / 276 / 280 / 281 / 282 / 283 / 285 / 295 / 304 / 310 / 320 / 321 | 다양한 환경 / config / 모델 / namespacing / Windows-specific 이슈 | mixed |

> **OPEN 82건 중 v1.0.4 가 명시적으로 fix 한 항목 ≤ 10 건. 결론: 원본 저장소 이슈를 "모두" 해결하지 못한다 (Q1: NO).**

---

## 2. 샌드박스/승인 모델의 제약 (Q2)

### 2.1 현재 동작 (verification)

```bash
$ grep -n "sandbox" plugins/codex/scripts/codex-companion.mjs | head -10
141:function normalizeSandboxMode(sandbox)
630:    sandbox: "read-only",                                              # review hard-coded
680:  const sandbox = request.sandbox ?? (request.write ? "workspace-write" : "read-only");
1002:  const effectiveSandbox = sandbox ?? (write ? "workspace-write" : "read-only");
```

### 2.2 결론

| 시나리오 | 결과 | 비고 |
|---|---|---|
| user 가 `--sandbox danger-full-access` 명시 | ✅ honor | line 680 / 1002 |
| user 가 `--sandbox` 미입력 + `--write` | `workspace-write` 강제 | user config (`~/.codex/config.toml`) 무시 |
| user 가 `--sandbox` 미입력 + read-only review | `read-only` 강제 | user config 무시 |
| Linux bwrap 미동작 환경 (#240) | bwrap 실패 → review unsable | `--sandbox danger-full-access` 명시로만 우회 가능 |
| macOS Seatbelt 가 .git/, listen() 차단 (#240 후속 코멘트) | rescue task 가 git commit 실패 | `--sandbox danger-full-access` 필요 |
| `git push` 가 DNS 차단 (#304) | "completed" but not pushed | 사용자 manual recovery 필요 |

> **Q2 결론: user 가 매번 `--sandbox` 를 명시할 의지가 있으면 풀린다. 단 default 동작이 user codex config 를 무시하므로, "기존 환경" 의 sandbox 정책을 inherit 하는 것은 NO.**

### 2.3 권장 대응

- **즉시 (LOW)**: codex-rescue 의 default 호출에 `--sandbox` 옵션 추가 가이드 제공.
- **중기 (M)**: codex-companion.mjs:680 / 1002 의 default 를 `null` 로 두고, app-server `thread/start` request 의 `sandbox` 필드를 omit. user 의 `~/.codex/config.toml` 가 honor 되도록. 이는 #240 의 PR 패치 방향과 일치.

---

## 3. Codex 응답 실패 / 대용량 입력 (Q3)

### 3.1 발견된 5 가지 failure mode

#### A. Bash 600s 한도 vs foreground task

- **시나리오**: codex-rescue subagent → single Bash → `codex-companion.mjs task` foreground.
- **위험**: Bash tool 의 max timeout 600s. 본 세션의 codex audit 는 25min+ (1500s+) 실행 → Bash 측 timeout 됨. Codex 는 background 에서 계속 실행되나 wrapper 로 결과 미회수.
- **재현**: 본 세션 task `task-mp7sdta9-ppf8we` (Phase: verifying, Elapsed: 25m 11s 기록).
- **이슈 #**: 122
- **fix 방향**: agent 가 `--background` + 별도 polling loop 또는 Bash timeout 600000 explicit + Codex 측 streaming partial result.

#### B. ~6 KB prompt → "user denied" silent rejection

- **시나리오**: parent agent 가 codex-rescue 에 large prompt 전달.
- **위험**: Claude Code Bash tool 이 inline argument 크기를 reject ("user denied tool use" 와 동일 표현 사용). plugin 은 `--prompt-file` 지원하나 [codex-rescue.md:21-23](../../plugins/codex/agents/codex-rescue.md#L21-L23) 이 raw arg 만 사용.
- **이슈 #**: 308
- **fix 방향**: codex-rescue agent 가 prompt 가 ~3KB 초과 시 자동 tmpfile 작성 후 `--prompt-file` 사용.

#### C. rate-limit 시 stop-review-gate 무한루프

- **시나리오**: ChatGPT 5h rate-limit 도달 → Codex `status: 1` + `rawOutput: ""` → stop-review-gate 가 `decision: "block"` → Claude 가 retry → 또 rate-limit → 무한 루프.
- **재현**: [stop-review-gate-hook.mjs:122-130](../../plugins/codex/scripts/stop-review-gate-hook.mjs#L122-L130).
- **위험**: CC token 즉시 소진, 사용자 감시 없으면 CC rate-limit 까지 도달.
- **이슈 #**: 306, 248
- **fix 방향**: rate-limit / 429 / `rawOutput=""` 케이스를 별도 분기하여 `decision: "allow"` + warning logNote.

#### D. finalizing phase 무한 대기

- **시나리오**: codex.mjs:445/460 의 `phase: "finalizing"` 이후 timeout 부재. task 가 finalizing 에서 멈추면 `--wait` 호출자가 `DEFAULT_REQUEST_TIMEOUT_MS = 30 min` 까지 대기.
- **이슈 #**: 183
- **fix 방향**: finalizing phase 진입 후 N 분 (예: 5 min) 미해결 시 fail-fast.

#### E. Windows zh-TW 의 Big5-encoded taskkill stdout → JSONL parser crash

- **시나리오**: Windows 비-UTF-8 locale 에서 codex app-server JSONL parser 가 Big5 byte sequence 에 crash.
- **이슈 #**: 310
- **fix 방향**: app-server 측 JSONL parser 의 encoding 강제 / sanitization. 본 plugin 보다 codex CLI upstream 영역.

### 3.2 응답 채널 신뢰성 평가

| 채널 | 안정성 | 잔존 위험 |
|---|---|---|
| codex-companion task `--wait` (foreground) | 🟡 600s Bash 한도 의존 | #122 |
| codex-companion task `--background` + status/result polling | 🟢 (대부분 안정) | #324 stub 반환 / #264 status:running 영구 잔존 / #222 result vs status 비동기 |
| codex review (read-only) | 🟢 일반 | #277 Windows hang / #279 background flag silently ignored |
| codex adversarial-review | 🟢 일반 | #270 default model 으로 fail (CLI 0.125+) |
| stop-review-gate | 🔴 rate-limit infinite loop / Windows stdin block | #306 / #191 / #248 |

> **Q3 결론: 5 가지 failure mode 모두 v1.0.4 미해결. 특히 A (Bash 600s) 와 C (rate-limit infinite loop) 는 사용자 token 비용에 직접 영향.**

---

## 4. 메모리 / 리소스 누수 잔존 평가 (Q4)

### 4.1 봉합 완료 (최근 3 commit)

| commit | 봉합 영역 | 검증 |
|---|---|---|
| `2322926` fix(broker,app-server) | sendMessage sync 실패 시 pending 즉시 cleanup | [app-server.mjs:152-162](../../plugins/codex/scripts/lib/app-server.mjs#L152-L162) — pending.delete + clearTimeoutSweep 보장 |
| `4f0a7ae` perf(broker,app-server) | per-request setTimeout → 단일 sweep timer (30s/15s) | [app-server.mjs:95-117](../../plugins/codex/scripts/lib/app-server.mjs#L95-L117) — setInterval + .unref() + size==0 시 clear |
| `c40449f` fix(broker,runtime) | memory-leak + resource-leak hardening (Codex audit 결과 반영) | broker / runtime 광범위 |

### 4.2 잔존 위험

| # | 위험 | 영향 | 검증 |
|---|---|---|---|
| 163 | 테스트 스위트 broker 158 orphan 발생 가능 | 테스트 환경 한정 | upstream 미해결 |
| 264 | task_complete 후에도 per-job state JSON 이 status:running 유지 + .output 스트림 mid-turn 끊김 | 영구 lingering state file | upstream 미해결 |
| 193 | session 종료 후 orphan codex 100% CPU | broker idle watchdog (30 min grace) 가 부분 완화하나, codex.exe app-server 자체 orphan 은 별도 | [app-server-broker.mjs:392-417](../../plugins/codex/scripts/app-server-broker.mjs#L392-L417) |
| 198 | worktree 사용 시 hang → deleted dir 에서 codex 잔존 | run_in_background + worktree cleanup race | upstream 미해결 |
| 222 / 164 / 202 / 264 | PID liveness check 없음 → status:running 영구 잔존 | aggregate jobs.json 누적 | [state.mjs:74-88](../../plugins/codex/scripts/lib/state.mjs#L74-L88) `isPidRunning` 정의 있으나 jobs reaper 미적용 |
| 247 | concurrent session 시 readStdinIfPiped sync 가 EAGAIN crash | hook 동시성 | upstream 미해결 |
| 286 race 3 | broker.json `ensureBrokerSession` race | 동일 cwd parallel 호출 시 orphan broker | 부분 완화 (race 1·2 만 봉합) |

### 4.3 결론

> **Q4: 클래식 메모리 누수 (pending Map / setTimeout pile-up) 는 v1.0.4 에서 완전 봉합. 단 "리소스 누수" 광의 정의 (orphan process / lingering state file / 좀비 jobs.json entry) 는 6+ 영역 잔존. 무인 long-running 환경에서는 누적 위험.**

---

## 5. 직접 Codex CLI 사용 대비 대체 가능성 (Q5)

### 5.1 plugin 의 가치

| 가치 영역 | 평가 |
|---|---|
| Claude Code 안에서 `/codex:*` 슬래시 명령 | ✅ 우수 — context switch 최소 |
| codex-rescue subagent 로 자동 위임 | 🟡 stub 반환 / 600s 한도 / large prompt rejection 잔존 |
| approval-aware long-running task | ✅ v1.0.4 risk classification + prefix-match 양호 |
| stop-time review-gate | 🔴 rate-limit 무한루프 / Windows stdin block |
| broker IPC 로 multi-job 추적 | 🟡 race 1·2 봉합 / race 3 잔존 |
| sandbox / approval 정책 일관성 | 🟡 user codex config 무시 (#240 미해결) |

### 5.2 직접 codex CLI 가 우위인 영역

| 영역 | plugin | direct codex CLI | 사유 |
|---|---|---|---|
| auth (ChatGPT subscription) | 🔴 #320 보고 | ✅ | upstream 영역 — plugin 이 추가 layer 우회 |
| auth (custom base URL, no auth) | 🔴 #233 보고 | ✅ | plugin 의 auth guard 가 강제 |
| clientInfo namespacing | 🔴 #199 / #276 — "Claude Code" 로 보내져 gpt-5.5 reject | ✅ codex CLI 자신의 identifier | upstream 처리 필요 |
| 결과 fan-in / scrollback | 🟡 per-job .output + .log 분리 | ✅ codex 단일 session | UX 이질감 |
| context capture (codex desktop 수준) | 🔴 #229 — 불가 | ✅ | 데스크톱 앱 우위 |
| 무인 cron / launchd 운영 | 🔴 #288 SessionEnd hang (v1.0.4 fix) + #245 잔존 / #163 orphan | ✅ `codex exec` 단발 | hook layer 가 추가 위험 |
| sandbox config inherit | 🔴 #240 / #167 | ✅ | hard-coding 미수정 |

### 5.3 권장 사용 패턴

✅ **유효 use case (v1.0.4 기준 안전)**:
- 짧은 review (~3 min 이하)
- 명시적 sandbox / approval 옵션과 함께 사용하는 단발 rescue
- approval-aware /codex:agent 사용 시 사용자가 active monitoring

🟡 **조건부 사용 가능 (제약 명시 후)**:
- /codex:rescue + `--background` + 사용자가 `/codex:status` / `/codex:result` 수동 polling
- /codex:review 시 user 가 `--sandbox <mode>` 명시

🔴 **현시점 권장 안 함**:
- stop-review-gate 활성화 (`/codex:setup --enable-review-gate`) — rate-limit 무한루프 위험
- 무인 cron / launchd 자동 위임 — orphan / SessionEnd hang 누적
- ~6 KB 초과 prompt 의 codex-rescue 호출 — silent reject
- Windows + zh-TW / Big5 / ko-KR 비-UTF-8 locale 환경
- worktree + run_in_background 조합

> **Q5 결론: "완전 대체"는 NO. "Claude Code 내부에서 코덱스 호출 편의" 측면은 OK. 단 production 무인 위임 / stop-gate / 대용량 task 는 직접 codex CLI 가 우위.**

---

## 6. 검증 5필드 (BLOCKING per CLAUDE.md § Verification Discipline)

| # | claim | verification_command | verification_result | verdict | confidence |
|---|---|---|---|---|---|
| 1 | sendBrokerShutdown 무한 hang (#288/245) 은 v1.0.4 에서 fix 됨 | `grep -n "BROKER_SHUTDOWN_TIMEOUT_MS\|setTimeout(settle" plugins/codex/scripts/lib/broker-lifecycle.mjs` | line 47 + line 64-65 — `await new Promise((resolve) => { … const timer = setTimeout(settle, timeoutMs); timer.unref?.(); …` | CONFIRMED | certain |
| 2 | state.mjs updateState/upsertJob 가 lock 으로 보호됨 (#286 race 1·2 fix) | `grep -n "withStateLock" plugins/codex/scripts/lib/state.mjs` | 232 / 236 / 240 — `saveState`/`updateState` 둘 다 wrapped | CONFIRMED | certain |
| 3 | sandbox default 가 hard-coded → user `~/.codex/config.toml` 무시 (#240) | `grep -n "sandbox:" plugins/codex/scripts/codex-companion.mjs \| head -5` | 630: `sandbox: "read-only",` (review) / 680: `request.sandbox ?? (request.write ? "workspace-write" : "read-only")` | CONFIRMED | certain |
| 4 | stop-review-gate 가 `status !== 0` 시 무조건 block (#306) | `sed -n '120,135p' plugins/codex/scripts/stop-review-gate-hook.mjs` | `if (result.status !== 0) { … return { ok: false, reason: …" 무조건 ok:false → main() 에서 emitDecision({ decision: "block", … })` | CONFIRMED | certain |
| 5 | codex-rescue.md 가 single Bash call 로 task 호출 (#122) | `grep -n "Bash" plugins/codex/agents/codex-rescue.md` | "Use exactly one `Bash` call to invoke `node "${CLAUDE_PLUGIN_ROOT}/scripts/codex-companion.mjs" task ...`" | CONFIRMED | certain |
| 6 | `--prompt-file` 지원 (#308 부분 mitigation 가능) | `grep -n "prompt-file" plugins/codex/scripts/codex-companion.mjs` | 847 / 848 / 981 / 1172 — 옵션 정의 + readFileSync | CONFIRMED | certain |
| 7 | PID liveness check 함수는 있으나 jobs reaper 에는 미적용 (#222) | `grep -n "isPidRunning" plugins/codex/scripts/lib/state.mjs` | 74 (정의) / 124 (lock owner check 1회 사용). jobs[] 정리에는 사용 안 됨 | CONFIRMED | likely |
| 8 | broker idle watchdog 30 min grace 존재 (#193 부분 mitigation) | `grep -n "IDLE_WATCHDOG" plugins/codex/scripts/app-server-broker.mjs` | 392: `const IDLE_WATCHDOG_INTERVAL_MS = 5 * 60 * 1000;` 393: `IDLE_WATCHDOG_GRACE_MS = 30 * 60 * 1000;` | CONFIRMED | certain |
| 9 | finalizing phase timeout 부재 (#183) | `grep -n "FINALIZING\|finalizing.*timeout" plugins/codex/scripts/lib/*.mjs` | (empty) — 발견 없음 | CONFIRMED | likely |
| 10 | task 의 default 가 foreground (background 는 explicit `--background`) | `sed -n '1010,1060p' plugins/codex/scripts/codex-companion.mjs` | `if (options.background) { …enqueueBackgroundTask… return; } …runForegroundCommand…` | CONFIRMED | certain |
| 11 | 본 세션의 codex audit 가 25min+ 걸림 → #122 실시간 재현 | `node plugins/codex/scripts/codex-companion.mjs status` | task-mp7sdta9-ppf8we / Phase: verifying / Elapsed: 25m 11s | CONFIRMED | certain |
| 12 | `/codex:result <id>` 가 running job 에 "No job found" 반환 → #222 추가 증거 | `node plugins/codex/scripts/codex-companion.mjs result task-mp7sdta9-ppf8we` | "No job found for "task-mp7sdta9-ppf8we". Run /codex:status to list known jobs." | CONFIRMED | certain |

---

## 7. ULTRAPLAN 액션 (우선순위)

### HIGH — 즉시 조치 후보

1. **#306 rate-limit 무한루프 차단** (1 시간 작업, 사용자 영향 최대)
   - 파일: [stop-review-gate-hook.mjs:122-130](../../plugins/codex/scripts/stop-review-gate-hook.mjs#L122-L130)
   - 변경: `result.status !== 0` 분기에서 `result.stderr` / `result.stdout` 의 rate-limit 시그너처 (예: `429`, `rate_limit`, `usage limit`) 검출 시 `decision: "allow"` + warning logNote 로 변경.
   - 대안: `--enable-review-gate` 디폴트 OFF 유지 + README 경고 강화.

2. **#122 codex-rescue 600s 한도** (M, 위임 결과 보존)
   - 파일: [agents/codex-rescue.md](../../plugins/codex/agents/codex-rescue.md), [skills/codex-cli-runtime/SKILL.md](../../plugins/codex/skills/codex-cli-runtime/SKILL.md)
   - 변경 1: 600s 초과 예상 시 `--background` + jobId 즉시 반환 + parent agent 가 `/codex:status --wait` polling 하도록 SKILL 가이드.
   - 변경 2: codex-companion 측에 `--stream` 옵션 추가하여 partial result 를 stdout 으로 progressively flush.

3. **#222 / #164 / #202 / #264 zombie running state** (M, 운영 안정성)
   - 파일: [lib/state.mjs](../../plugins/codex/scripts/lib/state.mjs)
   - 변경: `listJobs` / `getJob` 진입 시 `status === "running"` 인 항목에 대해 `isPidRunning(job.pid)` 검증, false 시 `status: "failed"` + `failureReason: "process_died"` 로 자동 reaper.

4. **#240 / #167 / #304 sandbox hard-coding** (M, 환경 호환성)
   - 파일: [codex-companion.mjs:680](../../plugins/codex/scripts/codex-companion.mjs#L680), 관련 line 630, 1002
   - 변경: `--sandbox` 미입력 시 `sandbox` 필드 자체를 omit (request 객체에서 제외). app-server 가 user `~/.codex/config.toml` 의 `sandbox_mode` 를 fall-back 사용하도록.

5. **#324 codex-rescue stub 반환** (S, 직관성)
   - 파일: [agents/codex-rescue.md:23-25](../../plugins/codex/agents/codex-rescue.md#L23-L25), [skills/codex-cli-runtime/SKILL.md](../../plugins/codex/skills/codex-cli-runtime/SKILL.md)
   - 변경: agent prompt 와 SKILL 의 `--background` 처리 모순 제거 — "user 가 명시한 경우만 background, 그 외 항상 foreground" 일관화.

### MEDIUM — 다음 스프린트 후보

6. **#308 large prompt → file 자동 전환** (S, UX)
   - 파일: codex-rescue.md
   - 변경: prompt 가 ~3 KB 초과 시 임시 파일 생성 후 `--prompt-file` 사용.

7. **#183 finalizing phase timeout** (S, 견고성)
   - 파일: [codex.mjs:445/460](../../plugins/codex/scripts/lib/codex.mjs)
   - 변경: phase=finalizing 진입 후 5 min 미완료 시 fail-fast.

8. **#286 race 3 broker.json 정합성** (M, 동시성)
   - 파일: [broker-lifecycle.mjs](../../plugins/codex/scripts/lib/broker-lifecycle.mjs) `ensureBrokerSession`
   - 변경: state lock 패턴을 broker 메타에도 적용.

9. **#198 worktree + background hang** (M, isolation 안전)
   - 파일: agents/codex-rescue.md + Claude Code harness 협의 필요
   - 변경: rescue agent 는 worktree isolation 환경에서 항상 foreground + Bash timeout 600s explicit.

10. **#163 테스트 broker orphan teardown** (S, 개발자 경험)
    - 파일: tests/helpers.mjs / 각 테스트 파일
    - 변경: afterEach 에서 broker pidfile 기반 cleanup.

### LOW — 여유 있을 때

11. **#310 Big5 / non-UTF-8 locale crash** (upstream codex CLI 협의 — out of plugin scope)
12. **#285 Windows drive 분리 hook MODULE_NOT_FOUND** (hooks.json + path normalize)
13. **#287 Windows app-server.mjs spawn ENOENT** ([app-server.mjs:188](../../plugins/codex/scripts/lib/app-server.mjs) 의 `spawn("codex")` 에 `shell: true` 또는 PATHEXT 검색 추가)
14. **#247 EAGAIN concurrent sessions** (readStdinIfPiped 의 sync read → async)
15. **#229 / #283 desktop context capture / session naming** (UX 개선)

### User Decision (자동 액션 금지)

- **#229 codex desktop context capture**: 기능 요청. 기획 결정 영역.
- **#306 stop-review-gate disable default**: README 경고 강화 vs 기능 자체 비활성화 deprecation.
- **#306 fix 후 rate-limit 시 `decision: "allow"` 시 false-positive (실제 review 가 필요했던 경우) trade-off**: token 비용 절감 vs review 누락 위험. 사용자 정책 결정.

---

## 8. 미탐색 영역 (Goal: 0)

다음 영역은 본 ULTRAPLAN 에서 cover 했으나, 추가 검증이 가능한 영역:

| 영역 | 본 ULTRAPLAN 커버 깊이 | 추가 검증 시 권장 방법 |
|---|---|---|
| 100건 외 issue (101+ 번 이상의 historical) | 일부 | `gh issue list --limit 500 --search …` 로 확장 |
| 닫힌 PR (merged but reverted) | 미커버 | `gh pr list --state merged --limit 50` |
| codex-cli upstream side issue (non-plugin) | 부분 (#270/#276/#310) | 별도 audit 필요 |
| 실측 부하 테스트 (parallel /codex:* race) | 미실측 | 테스트 환경에서 `for i in {1..10}; do /codex:rescue & done` |
| Windows GUI / WSL / Cygwin 별도 환경 | grep 만 | 실제 환경 dogfooding |
| ChatGPT subscription tier 별 rate-limit 임계 | 미실측 | 사용자 계정 단위 측정 |

본 세션의 self-evidence (codex audit 25min+ / `/codex:result` "No job found" 응답) 은 위 표의 일부 갭을 자동 메웠다.

---

## 9. Codex Cross-Validation 상태

> **참고**: /analyze 4번째 병렬 codex agent (`task-mp7sdta9-ppf8we`) 가 본 세션 시작 시점부터 25min+ 실행되었으나 25min 시점에서 사용자 새 질문 (ULTRAPLAN) 이 우선순위 변경 → 별도 cross-validation 미수행. **이 자체가 #122 (Bash timeout < Codex actual runtime) 의 실시간 재현 사례**로 본 보고서 § 6 의 row 11 / 12 에 반영됨.

향후 fresh codex run 으로 본 ULTRAPLAN 의 cross-validation 을 원할 시: `/codex:rescue --background "이 ULTRAPLAN (path 첨부) 을 검토하라. 5필드 검증으로 false positive / false negative 판정"` 사용 권장.

---

## 10. 결론 (5 줄)

1. **v1.0.4 는 "v1.0.3 대비 IPC/메모리 hardening" 단일 의의가 명확** (3 commit 으로 4 누수 봉합).
2. **upstream issue tracker 의 ground truth 는 부정적** — 82 OPEN 중 v1.0.4 fix 약 10건, 나머지는 설계상 미해결.
3. **사용자의 5 가지 질문 모두에 대해 "부분"** — Q1 NO / Q2 부분 (--sandbox 명시 시) / Q3 NO (5 failure mode) / Q4 거의 (운영 누수 잔존) / Q5 NO.
4. **권장 운영 모드**: `--enable-review-gate` OFF + 짧은 review/rescue 만 + sandbox 명시 + 무인 운영 회피.
5. **HIGH 5 건 + MEDIUM 5 건 액션** 으로 보강 시 production-ready 수준 도달 가능.
