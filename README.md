# QuietSwitch

<p align="center">
  <strong>A dead-man's switch nobody has to be trusted to operate.</strong>
</p>

<p align="center">
  <a href="https://valentinzubok.github.io/QuietSwitch/"><img src="https://img.shields.io/badge/Live-Console-22d3ee?style=flat-square" alt="Live console" /></a>
  <a href="https://github.com/valentinzubok/QuietSwitch/actions/workflows/ci.yml"><img src="https://github.com/valentinzubok/QuietSwitch/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <img src="https://img.shields.io/badge/GenLayer-Studio%20Dev%2061997-22d3ee?style=flat-square" alt="Studio Dev" />
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue?style=flat-square" alt="MIT" /></a>
</p>

---

## The trust problem

Succession plans need someone to decide that the moment has come. A lawyer, a co-signer, a
platform — whoever holds that judgement can act early, or refuse to act at all. Automating it with
a timer is worse: the holder is one missed reminder away from losing their keys, and a timer cannot
tell a fresh check-in from an abandoned status page that still returns 200.

**QuietSwitch makes "is this still proof of life?" a consensus question.**

```
arm(switch_id, heartbeat_url, rule, successor, note, misses_required, observation_interval)
      the page, the freshness rule, the successor, the number of consecutive misses and the
      interval between checks are all fixed here, by the holder. Nothing about the firing
      condition can be chosen later.

check(switch_id)                     anyone may call it — a switch only the holder can check
                                     is not a dead-man's switch — but an accepted check must
                                     come at least observation_interval seconds after the
                                     previous accepted one (and after arming); an early call
                                     reverts before the page is even fetched
      validators fetch THE COMMITTED PAGE (this function takes no URL), freeze it under
      eq_principle.strict_eq, and agree on one boolean: does it show proof of life that
      satisfies the rule?
        alive        -> the miss counter resets to zero
        not alive    -> one miss; after `misses_required` consecutive misses the switch FIRES
                        and the successor becomes the holder of the handover note
        unreachable  -> the FIRST outage is only noted, never counted; an outage still
                        there a full interval later counts, because a blip is not silence

disarm / rearm(switch_id)            the current holder only — the contract has no owner and
                                     no admin; a fired switch cannot be disarmed or rearmed
```

### Why it fails the way it does

Firing takes something away from the current holder, so the fail-safe direction is the **opposite**
of a monitoring alert: a malformed model answer, a model error or a consensus failure **reverts the
transaction**. Not even a miss is recorded when the pipeline misbehaves.

| Risk | What stops it |
|---|---|
| The successor points the check at a blank page | `check()` takes no URL and no rule; both are fixed at `arm()`. |
| Hammering `check()` to hurry a handover | Every switch carries an `observation_interval` fixed at `arm()` and a `cadence_anchor` stored on chain: the transaction datetime of the last accepted check (or of arm/rearm). A check earlier than `cadence_anchor + observation_interval` reverts *before* the page is fetched. |
| Two calls a second apart, either side of a window boundary | The separation is elapsed time between accepted checks, not a calendar window (`now // interval`), so there is no boundary to straddle. Firing takes at least `misses_required × observation_interval` from arming. |
| An administrator disarming a switch to suppress the handover, or rearming it to wipe the misses | There is no administrator. The contract has no owner, no admin and no ownership transfer; `disarm` and `rearm` accept the current holder of that switch and nobody else. The deployer is an ordinary account. |
| A transient outage firing an irreversible handover | The first unreachable observation is `outage_noted`, not counted; only an outage still there a full interval later costs a miss, and a page that returns clears it. |
| Paying a fee for a call that cannot count | `get_cadence(switch_id)` is a free view: whether a check is accepted now, `next_check_at`, `seconds_until_open`, the pending-outage flag. |
| A single bad model answer fires the switch | `misses_required` consecutive misses, each a full interval apart, each with its own transaction and its own consensus. |
| `bool("")` is `False` | `literal_bool()` accepts only JSON `true`/`false`; anything else reverts, recording nothing. |
| An abandoned page that still returns 200 | The rule is judged on substance — a stale date, a placeholder or an error message is not proof of life. |
| A holder faking liveness at the model | The page and the rule are fenced as untrusted data, inner fences neutralized, and injection phrasing is flagged to the model and stored on the switch. |
| Only the top of a long page being read | The whole document is hashed; the model reads ≤4000 chars from the head plus non-overlapping windows around the rule's own words. |
| Consensus quietly degrading | No fallback: if `prompt_comparative` cannot run, the transaction reverts. (`principle` is positional-only in GenVM v0.3 — the keyword form silently pushed earlier contracts onto `strict_eq`.) |

## Live

| | |
|---|---|
| Console | **https://valentinzubok.github.io/QuietSwitch/** (reads work with no wallet) |
| Network | GenLayer Studio Dev / Studio Next — chain `61997` |
| Contract | [`0x32732ab3C6F1a5cA92d9ab96746F1D17b6B95F7F`](https://explorer-studio-dev.genlayer.com/address/0x32732ab3C6F1a5cA92d9ab96746F1D17b6B95F7F) |
| Contract-only repo | [QuietSwitchCore](https://github.com/valentinzubok/QuietSwitchCore) |
| Deploy record | [`STUDIO_DEV_DEPLOY.md`](STUDIO_DEV_DEPLOY.md) |

`scripts/verify_deployment.py` runs in CI and fails the build if the deployed bytes stop matching
[`contracts/QuietSwitch.py`](contracts/QuietSwitch.py).

## The heartbeat pages are files in this repository

- [`web/public/fixtures/heartbeat.html`](web/public/fixtures/heartbeat.html) — a fresh check-in.
- [`web/public/fixtures/stale.html`](web/public/fixtures/stale.html) — a page that is up, looks
  maintained, and last checked in during 2019. This is the case a plain uptime monitor cannot see.

Going quiet in the demo therefore means a real commit that removes a real check-in, not a story in
a README.

## The console

[`web/`](web/) — Next.js 16 + `genlayer-js` 2.0.0-rc.1 + MetaMask, exported statically to Pages.
It reads switches and events from chain without a wallet, writes `arm` / `check` / `disarm` /
`rearm` through MetaMask with Studio Dev fees, and distinguishes `ACCEPTED` from `FINALIZED`
rather than presenting acceptance as completion.

```bash
cd web
npm install
npm run dev      # http://localhost:3015
```

## Tests

```bash
pip install -r requirements-dev.txt
python3 -m pytest -q      # 50 tests
```

`tests/test_adversarial.py` is the half that matters: twelve malformed or non-boolean model
outputs, model errors, a consensus failure on a switch that is one miss from firing, the successor
trying to disarm or redirect the check, prompt injection on the heartbeat page and in the rule, a
check-in buried 6 KB into a document, digest bounds and determinism, a stale check-in — and the two
groups a handover depends on:

- **It cannot be accelerated.** A check one second before a window boundary followed by calls just
  after it, from four different accounts, counts once; a caller hammering every 7 seconds across
  six boundaries only ever gets accepted checks a full interval apart; the first check waits a full
  interval after arming; a successor calling every hour cannot fire a 3-miss daily switch in under
  three days; rearming restarts the cadence; and an early call fetches nothing and spends no model.
- **It cannot be suppressed.** The deploying account cannot disarm or rearm a switch held by
  someone else, cannot rearm one the holder disarmed, and the handover still fires afterwards; the
  contract exposes no owner, admin or ownership transfer; after firing, neither the previous holder
  nor the deployer has any say.

## License

[MIT](LICENSE) © 2026 Valentyn Zubok
