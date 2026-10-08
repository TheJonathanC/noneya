"""process_sim.py - simulated casting process data + drift detection, risk model, root cause,
what-if projection and blast radius. Needs numpy, pandas, scikit-learn only.
ALL PROCESS DATA IS SIMULATED. Causal links come from casting knowledge, not from the Kaggle images."""
import numpy as np, pandas as pd
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.metrics import roc_auc_score

FACTORS = ["pour_temp", "mould_moisture", "gas_level", "pour_speed", "cooling_rate"]
BASE = dict(pour_temp=1420.0, mould_moisture=3.0, gas_level=1.0, pour_speed=2.0, cooling_rate=5.0)
SD   = dict(pour_temp=6.0,    mould_moisture=0.25, gas_level=0.08, pour_speed=0.12, cooling_rate=0.35)
UNIT = dict(pour_temp="°C", mould_moisture="%", gas_level="a.u.", pour_speed="kg/s", cooling_rate="°C/s")
HARM = dict(pour_temp=0, mould_moisture=1, gas_level=1, pour_speed=-1, cooling_rate=1)   # +1 high bad, -1 low bad, 0 both
WEIGHT = dict(pour_temp=0.55, mould_moisture=0.8, gas_level=0.6, pour_speed=0.5, cooling_rate=0.7)
MACHINES = ["M-01", "M-02", "M-03", "M-04", "M-05"]
STEP_MIN = 2                                    # one part every 2 minutes

FIXES = {  # factor -> (what is wrong, corrective action)
    "pour_temp": ("Pouring temperature is outside its normal band", "Inspect the furnace / temperature control and re-set the pouring temperature before continuing"),
    "mould_moisture": ("Mould moisture is high", "Dry or replace the mould sand and check the moisture control before the next pour"),
    "gas_level": ("Dissolved gas / fume level is high", "Degas the melt and check mould venting"),
    "pour_speed": ("Pour speed is too low", "Check the ladle / pouring mechanism and gating for blockage"),
    "cooling_rate": ("Cooling rate is too fast", "Check the cooling circuit flow and mould pre-heat"),
}

def _excess(f, z):
    d = HARM[f]
    e = np.abs(z) if d == 0 else d * z
    return np.maximum(0.0, e - 1.5)

def p_defect_true(z):                           # z: dict factor -> array of z-scores
    s = sum(WEIGHT[f] * 1.5 * _excess(f, z[f]) for f in FACTORS)
    return 1 / (1 + np.exp(-(-4.0 + s)))

def default_faults(seed):
    r = np.random.default_rng(1000 + seed)
    machines = r.permutation(len(MACHINES))[:3]
    spec = [("pour_temp", "ramp", 8.0), ("mould_moisture", "step", 6.0), ("cooling_rate", "step", 6.0)]
    out = []
    for m, (f, shape, mag) in zip(machines, spec):
        start = int(r.integers(100, 350)); dur = int(r.integers(150, 260))
        out.append(dict(machine=MACHINES[m], factor=f, shape=shape, mag=mag, start=start, end=start + dur))
    return out

def simulate(seed=0, n_parts=300, faults=None):
    r = np.random.default_rng(seed)
    faults = default_faults(seed) if faults is None else faults
    rows = []
    for mi, mach in enumerate(MACHINES):
        t = np.arange(n_parts) * STEP_MIN
        z = {f: r.normal(0, 1, n_parts) for f in FACTORS}
        cause = np.array(["none"] * n_parts, dtype=object)
        for fl in [x for x in faults if x["machine"] == mach]:
            active = (t >= fl["start"]) & (t < fl["end"])
            ramp = np.clip((t - fl["start"]) / max(fl["end"] - fl["start"], 1), 0, 1) if fl["shape"] == "ramp" else 1.0
            eff = fl["mag"] * ramp * active
            z[fl["factor"]] = z[fl["factor"]] + (eff if HARM[fl["factor"]] >= 0 else -eff)
            cause[eff >= 2.0] = fl["factor"]
        p = p_defect_true(z)
        df = pd.DataFrame({"serial": [f"{mach}-{i:04d}" for i in range(n_parts)], "machine_id": mach,
                           "batch_id": [f"B{100 + (i // 20) * 5 + mi}" for i in range(n_parts)], "t": t})
        for f in FACTORS:
            df[f] = BASE[f] + SD[f] * z[f]
        df["p_true"] = p
        df["defect"] = (r.random(n_parts) < p).astype(int)
        df["fault_cause"] = cause
        rows.append(df)
    out = pd.concat(rows, ignore_index=True)
    out.attrs["faults"] = faults
    return out

# ---------- features ----------
def add_z(df):
    for f in FACTORS:
        df["z_" + f] = (df[f] - BASE[f]) / SD[f]
    return df

def feature_frame(zdf):
    """zdf: z_ columns for ONE machine in time order. Returns current z, 5-part mean, 9-part slope per factor."""
    out = {}
    for f in FACTORS:
        z = zdf["z_" + f]
        out["z_" + f] = z
        out["r5_" + f] = z.rolling(5, min_periods=1).mean()
        out["s9_" + f] = ((z - z.shift(9)) / 9).fillna(0)
    return pd.DataFrame(out)

FEATS = [p + f for f in FACTORS for p in ("z_", "r5_", "s9_")]

def build_xy(df):
    df = add_z(df.copy()); X, y, meta = [], [], []
    for mach, g in df.groupby("machine_id", sort=False):
        g = g.sort_values("t").reset_index(drop=True)
        ff = feature_frame(g)
        X.append(ff.iloc[:-1]); y.append(g["defect"].shift(-1).iloc[:-1].astype(int))   # target = NEXT part defective
        m = g.iloc[:-1][["serial", "machine_id", "t", "defect", "fault_cause"]].copy()
        m["p_next"] = g["p_true"].shift(-1).iloc[:-1].values
        meta.append(m)
    return pd.concat(X, ignore_index=True), pd.concat(y, ignore_index=True), pd.concat(meta, ignore_index=True)

def train_risk(dfs):
    """dfs: one simulated run or a list of runs (more runs = better coverage of ramps and spikes)."""
    dfs = [dfs] if isinstance(dfs, pd.DataFrame) else list(dfs)
    parts = [build_xy(d) for d in dfs]
    X, y = pd.concat([p[0] for p in parts], ignore_index=True), pd.concat([p[1] for p in parts], ignore_index=True)
    m = GradientBoostingClassifier(n_estimators=150, max_depth=3, learning_rate=0.08, random_state=0)
    return m.fit(X[FEATS].values, y.values)

def risk(model, feats):
    return model.predict_proba(feats[FEATS].values)[:, 1]

# ---------- root cause (counterfactual attribution) ----------
def root_cause(model, row, min_risk=0.15):
    """row: Series of FEATS. Replace one factor at a time by its baseline; the drop in risk is that factor's share."""
    p0 = risk(model, row.to_frame().T)[0]
    drops = {}
    for f in FACTORS:
        r2 = row.copy()
        for pre in ("z_", "r5_", "s9_"):
            r2[pre + f] = 0.0
        drops[f] = float(p0 - risk(model, r2.to_frame().T)[0])
    pos = {f: max(d, 0.0) for f, d in drops.items()}; tot = sum(pos.values())
    ranked = sorted(pos, key=pos.get, reverse=True)
    top = ranked[0]
    share = pos[top] / tot if tot > 1e-9 else 0.0
    if p0 < min_risk:       # attributions at near-zero risk are noise
        return dict(risk=float(p0), cause=None, confidence=0.0, ranked=ranked, drops=drops,
                    what="Process within normal limits", action="No action needed")
    return dict(risk=float(p0), cause=top, confidence=round(float(share), 3), ranked=ranked, drops=drops,
                what=FIXES[top][0], action=FIXES[top][1])

# ---------- drift / changepoint ----------
ALPHA = 0.2
EW_THR = 4 * np.sqrt(ALPHA / (2 - ALPHA))       # 4-sigma EWMA limit in z units (~1.33): few false alarms over long runs

def drift_report(g, min_t=0):
    """g: one machine's rows in time order, with z_ columns. Returns per-factor first alarm + estimated change start."""
    rep = {}
    for f in FACTORS:
        e = pd.concat([pd.Series([0.0]), g["z_" + f]], ignore_index=True).ewm(alpha=ALPHA, adjust=False).mean().values[1:]   # start EWMA at 0
        hot = np.where((np.abs(e) > EW_THR) & (g["t"].values >= min_t))[0]
        if len(hot):
            a = hot[0]; c = a
            while c > 0 and abs(e[c]) > 0.35:
                c -= 1
            rep[f] = dict(alarm_idx=int(a), alarm_t=int(g["t"].iloc[a]), change_idx=int(c), change_t=int(g["t"].iloc[c]))
    return rep

def blast_radius(g, rep_f, model=None, min_risk=0.2):
    """Parts made from the estimated change point until the first confirmed defect after it (visually clean ones are at risk)."""
    c = rep_f["change_idx"]
    after = np.where(g["defect"].values[c:] == 1)[0]
    end = c + (after[0] if len(after) else len(g) - 1 - c)
    seg = g.iloc[c:end + 1].copy()
    if model is not None:
        seg["risk"] = risk(model, feature_frame(g).iloc[c:end + 1])
        seg["at_risk"] = (seg["defect"] == 0) & (seg["risk"] >= min_risk)
    return seg

# ---------- closed-loop projection ----------
def project(g, model, steps=25, fix_after=3, recover=0.6):
    """Risk for the next `steps` parts if left alone vs if the corrective action is applied after `fix_after` parts."""
    hist = g[["z_" + f for f in FACTORS]].tail(12).reset_index(drop=True)
    slope = {f: float(np.clip((hist["z_" + f].iloc[-1] - hist["z_" + f].iloc[-6]) / 5, -0.5, 0.5)) for f in FACTORS}
    def run(fix):
        h = hist.copy(); out = []
        for k in range(1, steps + 1):
            nxt = {}
            for f in FACTORS:
                last = h["z_" + f].iloc[-1]
                nxt["z_" + f] = last * recover if (fix and k > fix_after) else last + slope[f]
            h = pd.concat([h, pd.DataFrame([nxt])], ignore_index=True)
            out.append(float(risk(model, feature_frame(h).iloc[[-1]])[0]))
        return out
    return dict(left_alone=run(False), after_fix=run(True), fix_after=fix_after)

# ---------- validation (train on one simulated run, test on another with different faults) ----------
def validate(seed_test=1, train_seeds=range(100, 108), verbose=True):
    te = simulate(seed_test)
    model = train_risk([simulate(s) for s in train_seeds])
    X, y, meta = build_xy(te)
    p = risk(model, X)
    auc = roc_auc_score(y, p)
    # root-cause accuracy on defective parts made while a planted fault was strongly active
    idx = np.where((meta["defect"] == 1) & (meta["fault_cause"] != "none"))[0]
    hits = [root_cause(model, X.iloc[i])["cause"] == meta["fault_cause"].iloc[i] for i in idx]
    # drift alarms: lead time vs first defect inside each planted fault window; false alarms elsewhere
    tez = add_z(te.copy()); leads, missed, false_alarms, series = [], 0, 0, 0
    flt = te.attrs["faults"]
    for mach, g in tez.groupby("machine_id", sort=False):
        g = g.sort_values("t").reset_index(drop=True); rep_all = drift_report(g)
        mf = {x["factor"]: x for x in flt if x["machine"] == mach}
        for f in FACTORS:
            series += 1
            if f in rep_all and (f not in mf or rep_all[f]["alarm_t"] < mf[f]["start"]):
                false_alarms += 1
        for f, x in mf.items():
            rep = drift_report(g, min_t=x["start"])
            win = g[(g["t"] >= x["start"]) & (g["t"] < x["end"]) & (g["defect"] == 1)]
            if f in rep and len(win):
                leads.append(dict(factor=f, shape=x["shape"], minutes_before_first_defect=int(win["t"].iloc[0] - rep[f]["alarm_t"])))
            elif len(win):
                missed += 1
    ceiling = roc_auc_score(y, meta["p_next"])
    res = dict(next_part_auc=round(float(auc), 3), ceiling_auc=round(float(ceiling), 3), defect_rate=round(float(te["defect"].mean()), 3),
               root_cause_top1=round(float(np.mean(hits)), 3) if hits else None, n_rc=len(hits),
               drift_leads=leads, missed_alarms=missed, false_alarm_series=f"{false_alarms}/{series}", faults=flt)
    if verbose:
        for k, v in res.items():
            print(k, ":", v)
    return model, res

if __name__ == "__main__":
    validate()
