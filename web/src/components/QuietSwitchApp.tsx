"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CHAIN_ID,
  CONTRACT_ADDRESS,
  CONTRACT_REPO,
  DEFAULT_INTERVAL,
  DEMO_HEARTBEAT,
  DEMO_NOTE,
  DEMO_RULE,
  DEMO_STALE,
  EXPLORER,
  GITHUB,
  txUrl,
} from "@/lib/config";
import {
  arm,
  check,
  disarm,
  getCadence,
  getEvents,
  getOwner,
  getStats,
  getSwitch,
  listIds,
  rearm,
  type Cadence,
  type EventRow,
  type Stats,
  type SwitchRow,
} from "@/lib/contracts";
import { fundWithTestGen, getNativeBalance, type TxStage } from "@/lib/genlayer";
import { useWallet } from "./WalletProvider";

const short = (h: string, n = 10) => (h ? `${h.slice(0, n)}…${h.slice(-4)}` : "—");
const shortHash = (h: string) => (h ? `${h.slice(0, 16)}…` : "—");

const RESULT: Record<string, { text: string; tone: string }> = {
  armed: { text: "armed", tone: "neutral" },
  outage_noted: { text: "outage noted · not counted", tone: "broken" },
  alive: { text: "proof of life", tone: "ok" },
  missed: { text: "missed a check-in", tone: "broken" },
  unreachable: { text: "heartbeat unreadable", tone: "broken" },
  fired: { text: "fired", tone: "broken" },
  disarmed: { text: "disarmed", tone: "neutral" },
};

/** Hero illustration: a pulse that fades, and a handover that waits behind it. */
function Pulse() {
  return (
    <div className="pulsebox" aria-hidden="true">
      <svg viewBox="0 0 320 90" className="trace">
        <path
          className="line"
          d="M0 60 H60 l10 -34 l12 52 l10 -18 H150 l10 -22 l12 34 l10 -12 H320"
          fill="none"
        />
      </svg>
      <div className="handover">
        <span className="who holder">holder</span>
        <span className="track">
          <span className="dot" />
        </span>
        <span className="who successor">successor</span>
      </div>
      <div className="verdicts">
        <span className="alive">check-in seen</span>
        <span className="silent">silence → handover</span>
      </div>
    </div>
  );
}

export function QuietSwitchApp() {
  const { address, provider, connect, error: walletError } = useWallet();
  const [rows, setRows] = useState<SwitchRow[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [owner, setOwner] = useState("");
  const [gen, setGen] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [ok, setOk] = useState(false);
  const [tx, setTx] = useState("");
  const [stage, setStage] = useState<TxStage | "">("");

  const [switchId, setSwitchId] = useState("keys/demo");
  const [heartbeatUrl, setHeartbeatUrl] = useState(DEMO_HEARTBEAT);
  const [rule, setRule] = useState(DEMO_RULE);
  const [successor, setSuccessor] = useState("");
  const [note, setNote] = useState(DEMO_NOTE);
  const [misses, setMisses] = useState("2");
  const [interval, setInterval] = useState(DEFAULT_INTERVAL);
  const [cadence, setCadence] = useState<Record<string, Cadence>>({});

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [ids, o, s, ev] = await Promise.all([
        listIds(),
        getOwner(),
        getStats(),
        getEvents(),
      ]);
      setOwner(o);
      setStats(s);
      setEvents(ev.slice(-8).reverse());
      const loaded = await Promise.all(ids.map((id) => getSwitch(id)));
      setRows((loaded.filter(Boolean) as SwitchRow[]).reverse());
      const cadences = await Promise.all(ids.map((id) => getCadence(id)));
      setCadence(
        Object.fromEntries(
          cadences.filter(Boolean).map((c) => [(c as Cadence).switch_id, c as Cadence]),
        ),
      );
      if (address) setGen(await getNativeBalance(address));
    } catch (e) {
      setMsg(`Error: ${e instanceof Error ? e.message : "read failed"}`);
      setOk(false);
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /** ACCEPTED and FINALIZED are different guarantees, so the UI shows both. */
  const onStage = (next: TxStage, hash: string) => {
    setTx(hash);
    setStage(next);
    if (next === "finalized") void refresh();
  };

  const run = async (name: string, fn: () => Promise<string | void>) => {
    if (!address || !provider) {
      setMsg("Connect MetaMask for writes");
      setOk(false);
      return;
    }
    setBusy(name);
    setMsg("");
    setStage("");
    try {
      const hash = await fn();
      if (hash) setTx(hash);
      await refresh();
      setMsg(`${name}: accepted by consensus`);
      setOk(true);
    } catch (e) {
      setMsg(`Error: ${e instanceof Error ? e.message : String(e)}`);
      setOk(false);
    } finally {
      setBusy("");
    }
  };

  const acct = address as `0x${string}`;
  const disabled = !!busy || !address;

  return (
    <main className="wrap">
      <section className="hero">
        <div>
          <h1>
            Quiet<span className="accent">Switch</span>
          </h1>
          <p className="lede">
            A dead-man&apos;s switch nobody has to be trusted to operate. You arm it with a
            liveness page, the freshness rule it must satisfy, and who inherits. Anyone can ask
            the network to check — and GenLayer validators, reading{" "}
            <strong>the page you committed</strong>, agree on one thing: is this still proof of
            life?
          </p>
          <div className="chips">
            <span className="chip">
              chain <b>{CHAIN_ID}</b>
            </span>
            {stats && (
              <>
                <span className="chip">
                  switches <b>{stats.switches}</b>
                </span>
                <span className="chip">
                  armed <b>{stats.armed}</b>
                </span>
                <span className="chip hot">
                  fired <b>{stats.fired}</b>
                </span>
                <span className="chip">
                  checks <b>{stats.checks}</b>
                </span>
              </>
            )}
          </div>
          <p className="muted" style={{ marginTop: "0.8rem" }}>
            Contract <a href={EXPLORER}>{short(CONTRACT_ADDRESS, 12)}</a> · owner{" "}
            <code>{short(owner)}</code> · <a href={CONTRACT_REPO}>contract source</a> ·{" "}
            <a href={GITHUB}>this console</a>
          </p>
          <div>
            {!address ? (
              <button onClick={() => void connect()}>Connect MetaMask</button>
            ) : (
              <span className="pill">
                <span className="dot" /> {short(address)} · {gen || "?"} GEN
              </span>
            )}
            {address && (
              <button
                className="ghost"
                style={{ marginLeft: "0.5rem" }}
                disabled={!!busy}
                onClick={() =>
                  void run("Get test GEN", async () => {
                    await fundWithTestGen(acct);
                  })
                }
              >
                Get test GEN
              </button>
            )}
          </div>
          {walletError && <p className="msg">{walletError}</p>}
          {msg && <p className={ok ? "okmsg" : "msg"}>{msg}</p>}
          {tx && (
            <p className="tx muted">
              last tx <a href={txUrl(tx)}>{short(tx, 14)}</a>{" "}
              {stage === "finalized" ? (
                <span className="stagepill final">finalized</span>
              ) : (
                <span className="stagepill accepted">accepted — awaiting finalization</span>
              )}
            </p>
          )}
        </div>
        <Pulse />
      </section>

      <div className="row">
        <section className="card">
          <h2>1 · Arm a switch</h2>
          <p className="muted">
            The page, the rule, the successor and the number of consecutive misses are all fixed
            here, by you. Nothing about the firing condition can be chosen later — not by the
            successor, not by the contract owner.
          </p>
          <label htmlFor="switchId">Switch id</label>
          <input id="switchId" value={switchId} onChange={(e) => setSwitchId(e.target.value)} />
          <label htmlFor="heartbeatUrl">Heartbeat page (https)</label>
          <input
            id="heartbeatUrl"
            value={heartbeatUrl}
            onChange={(e) => setHeartbeatUrl(e.target.value)}
          />
          <p className="muted">
            Demo pages:{" "}
            <button
              className="ghost tiny"
              onClick={() => setHeartbeatUrl(DEMO_HEARTBEAT)}
            >
              fresh check-in
            </button>
            <button className="ghost tiny" onClick={() => setHeartbeatUrl(DEMO_STALE)}>
              stale check-in
            </button>
          </p>
          <label htmlFor="rule">Freshness rule</label>
          <textarea id="rule" rows={2} value={rule} onChange={(e) => setRule(e.target.value)} />
          <label htmlFor="successor">Successor address</label>
          <input
            id="successor"
            value={successor}
            onChange={(e) => setSuccessor(e.target.value)}
            placeholder="0x…"
          />
          <label htmlFor="note">Handover note</label>
          <textarea id="note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          <label htmlFor="misses">Consecutive misses before it fires</label>
          <input id="misses" value={misses} onChange={(e) => setMisses(e.target.value)} />
          <label htmlFor="interval">Observation interval (seconds)</label>
          <input id="interval" value={interval} onChange={(e) => setInterval(e.target.value)} />
          <p className="muted">
            The cadence a counted miss must respect. The chain clock is split into windows of
            this length and each window yields at most one counted observation, so nobody can
            turn one outage into a handover by calling check repeatedly. {misses} misses
            therefore need {misses} separated windows — and a transient outage needs two of
            them, because the first is only noted.
          </p>
          <button
            disabled={disabled || !switchId || !successor || !rule}
            onClick={() =>
              void run("arm", () =>
                arm(
                  acct,
                  provider,
                  switchId,
                  heartbeatUrl,
                  rule,
                  successor,
                  note,
                  misses,
                  interval,
                  onStage,
                ),
              )
            }
          >
            {busy === "arm" ? (
              <span className="working">
                <span className="spinner" /> arming…
              </span>
            ) : (
              "arm the switch"
            )}
          </button>
        </section>

        <section className="card">
          <h2>2 · What a check decides</h2>
          <ul className="decide">
            <li>
              <span className="tag ok">proof of life</span> the page states a check-in that
              satisfies the rule: the miss counter resets to zero.
            </li>
            <li>
              <span className="tag broken">missed</span> the page exists but does not satisfy the
              rule — a stale date, a placeholder, an error message.
            </li>
            <li>
              <span className="tag broken">outage noted</span> the first unreachable observation
              is recorded without counting: a two-minute blip is not silence.
            </li>
            <li>
              <span className="tag broken">heartbeat unreadable</span> gone or empty. A heartbeat
              nobody can read is not a heartbeat, so it counts as silence — with the reason
              recorded.
            </li>
            <li>
              <span className="tag broken">fired</span> enough consecutive misses: the successor
              becomes the holder and the handover note is theirs.
            </li>
          </ul>
          <p className="muted">
            Firing takes something away from the current holder, so the fail-safe direction is the
            opposite of a monitor: a malformed model answer, a model error or a consensus failure
            <strong> reverts the transaction</strong>. Not even a miss is recorded when the
            pipeline misbehaves — and a second check inside the same observation window reverts
            before the page is even fetched, so the same outage cannot be replayed into extra
            misses.
          </p>
        </section>
      </div>

      <section style={{ marginTop: "2rem" }}>
        <h2>Switches on chain {loading && <span className="spinner" />}</h2>
        {rows.length === 0 && !loading && <p className="muted">No switches yet.</p>}
        {rows.map((r) => {
          const res = RESULT[r.last_result] || { text: r.last_result, tone: "neutral" };
          return (
            <article key={r.switch_id} className={`card claim ${res.tone}`}>
              <div className="head">
                <span className="id">{r.switch_id}</span>
                <span className={`verdict ${res.tone}`}>{res.text}</span>
                <span className="muted">
                  {r.misses}/{r.misses_required} misses · {r.checks} checks · {r.status}
                </span>
              </div>
              <p className="claimtext">“{r.rule}”</p>
              <p className="hashline">
                heartbeat <a href={r.heartbeat_url}>{r.heartbeat_url}</a>
              </p>
              <p className="hashline">
                every {Math.round((r.observation_interval || 86400) / 60)} min at most ·{" "}
                {cadence[r.switch_id]
                  ? cadence[r.switch_id].open_now
                    ? "a new observation window is open"
                    : `window closed until ${new Date(
                        cadence[r.switch_id].next_window_opens_at * 1000,
                      ).toISOString().replace("T", " ").slice(0, 16)} UTC`
                  : "cadence loading…"}
                {r.outage_pending && " · one outage noted, not yet counted"}
              </p>
              <p className="hashline">
                holder <code>{short(r.holder)}</code> → successor{" "}
                <code>{short(r.successor)}</code>
                {r.last_page_hash && (
                  <>
                    {" "}
                    · last page sha-256 <code>{shortHash(r.last_page_hash)}</code>
                  </>
                )}
              </p>
              {r.last_detail && <p className="hashline">{r.last_detail}</p>}
              {r.status === "fired" && (
                <p className="verdictbox">
                  <strong>fired.</strong> The handover note is now the successor&apos;s:{" "}
                  “{r.note}”
                </p>
              )}
              {r.injection_flags?.length > 0 && (
                <p className="hashline flagged">
                  injection phrasing seen on the page: {r.injection_flags.join(", ")}
                </p>
              )}
              <button
                className="ghost"
                disabled={
                  disabled ||
                  r.status !== "armed" ||
                  (cadence[r.switch_id] ? !cadence[r.switch_id].open_now : false)
                }
                onClick={() => void run("check", () => check(acct, provider, r.switch_id, onStage))}
              >
                {cadence[r.switch_id] && !cadence[r.switch_id].open_now
                  ? "window closed"
                  : "check liveness"}
              </button>
              {address && address.toLowerCase() === r.holder.toLowerCase() && (
                <button
                  className="ghost"
                  style={{ marginLeft: "0.5rem" }}
                  disabled={disabled || r.status === "fired"}
                  onClick={() =>
                    void run(r.status === "armed" ? "disarm" : "rearm", () =>
                      r.status === "armed"
                        ? disarm(acct, provider, r.switch_id, onStage)
                        : rearm(acct, provider, r.switch_id, onStage),
                    )
                  }
                >
                  {r.status === "armed" ? "disarm" : "re-arm"}
                </button>
              )}
            </article>
          );
        })}
      </section>

      <section style={{ marginTop: "2rem" }}>
        <h2>Recent events</h2>
        {events.length === 0 ? (
          <p className="muted">No events yet.</p>
        ) : (
          <ul className="timeline">
            {events.map((e, i) => (
              <li key={i} className={e.kind === "Fired" || e.kind === "Missed" ? "broken" : ""}>
                <strong>{String(e.kind)}</strong>{" "}
                <span className="muted">
                  {[e.id, e.misses ? `${e.misses} miss(es)` : null, e.detail]
                    .filter(Boolean)
                    .map(String)
                    .join(" · ")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <footer className="foot">
        QuietSwitch on GenLayer Studio Dev (chain {CHAIN_ID}). Reads work without a wallet; writes
        need MetaMask and test GEN for fees. The demo heartbeat pages are files in this repository,
        so every check-in and every silence is a public commit. Contract source:{" "}
        <a href={CONTRACT_REPO}>QuietSwitchCore</a>.
      </footer>
    </main>
  );
}
