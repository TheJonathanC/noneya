"""severity.py - zone-based severity + pilot-batch gate for the casting impeller demo.
Pure numpy/scipy, no torch. Input: anomaly map (H x W, square, part roughly centred) + classifier prob.
ZONE FRACTIONS ARE ESTIMATES from one 512px image: overlay circles on a few images and tune them."""
import numpy as np
from scipy import ndimage as ndi
from scipy.stats import beta

PART_R = 0.40           # part radius as a fraction of image size (tune: ROI is 0.44)
# (name, r_in, r_out, weight); radii are fractions of the part radius
ZONES = [
    ("hub",          0.00, 0.30, 1.0),   # central hub / shaft area
    ("vane_cavity",  0.30, 0.65, 0.8),   # dark vane passages
    ("cavity_edge",  0.65, 0.75, 1.0),   # sealing ring around the cavity
    ("shroud_face",  0.75, 0.95, 0.6),   # wide flange face
    ("outer_rim",    0.95, 1.30, 0.4),   # rim edge
]
LEVELS = [(0.20, "Low"), (0.40, "Medium"), (0.60, "High"), (9.0, "Critical")]
NB = 26                                   # radial bins

def _radius(h, w):
    yy, xx = np.mgrid[0:h, 0:w]
    return np.hypot(xx - w / 2, yy - h / 2) / (PART_R * w)

def _bins(r):
    return np.clip((r / 1.3 * NB).astype(int), 0, NB - 1)

def zone_of(r):
    for name, lo, hi, wt in ZONES:
        if lo <= r < hi:
            return name, wt
    return ZONES[-1][0], ZONES[-1][3]

def _zmap(m, calib):
    b = _bins(_radius(*m.shape))
    return (m - calib["mean"][b]) / calib["std"][b]

def calibrate(ok_maps, pct=95):
    """Learn per-radius mean/std from OK-part maps; set the hotspot threshold so ~(100-pct)% of OK parts false-flag."""
    h, w = ok_maps[0].shape
    b = _bins(_radius(h, w)).ravel()
    stack = np.stack([m.ravel() for m in ok_maps])
    mean, std = np.zeros(NB), np.ones(NB)
    for k in range(NB):
        v = stack[:, b == k]
        if v.size:
            mean[k], std[k] = v.mean(), max(v.std(), 1e-6)
    calib = {"mean": mean, "std": std}
    maxz = [_zmap(m, calib).max() for m in ok_maps]
    calib["z_thr"] = float(max(3.0, np.percentile(maxz, pct)))
    return calib

def find_hotspots(m, calib, min_area_frac=0.0005):
    z = _zmap(m, calib)
    lab, n = ndi.label(z > calib["z_thr"])
    h, w = m.shape
    r = _radius(h, w)
    spots = []
    for i in range(1, n + 1):
        mask = lab == i
        area = mask.sum() / (h * w)
        if area < min_area_frac:
            continue
        peak = float(z[mask].max())
        cy, cx = ndi.center_of_mass(mask)
        zone, wt = zone_of(r[int(cy), int(cx)])
        score = wt * (0.6 * min(peak / (2 * calib["z_thr"]), 1) + 0.4 * min(area / 0.01, 1))
        level = next(l for t, l in LEVELS if score < t)
        spots.append(dict(zone=zone, peak_z=round(peak, 2), area_frac=round(float(area), 5),
                          x=round(cx / w, 3), y=round(cy / h, 3), score=round(float(score), 3), severity=level))
    return sorted(spots, key=lambda s: -s["score"])

ORDER = ["None", "Low", "Medium", "High", "Critical"]

def inspect_part(amap, clf_prob, calib, clf_thr=0.5):
    spots = find_hotspots(amap, calib)
    clf_flag, pc_flag = clf_prob >= clf_thr, len(spots) > 0
    verdict = "confirmed" if (clf_flag and pc_flag) else "review" if (clf_flag or pc_flag) else "ok"
    if spots:
        sev = spots[0]["severity"]
    else:
        sev = "Medium" if clf_flag else "None"       # classifier-only: defect not localised
    return dict(verdict=verdict, severity=sev, clf_prob=round(float(clf_prob), 3), hotspots=spots,
                note="classifier-only flag, defect not localised" if (clf_flag and not pc_flag) else "")

CHECKS = ["Check pour temperature against setpoint", "Check mould moisture / drying",
          "Check mould venting and gating", "Inspect mould for wear or damage"]

def pilot_gate(parts, rate_limit=0.25, crit_p=0.85):
    """GO / ADJUST / CRITICAL STOP. Review parts count as defects (conservative).
    Posterior: Beta(1+k, 1+n-k) on the true defect rate; p_exceed = P(rate > rate_limit)."""
    n = len(parts)
    k = sum(p["verdict"] in ("confirmed", "review") for p in parts)
    a, b = 1 + k, 1 + n - k
    p_exceed = float(1 - beta.cdf(rate_limit, a, b))
    worst = max((p["severity"] for p in parts), key=ORDER.index)
    if (worst == "Critical" and k >= 2) or p_exceed >= crit_p:
        decision = "CRITICAL STOP"
        action = "Halt production and call a process engineer."
    elif k >= 1:
        decision = "ADJUST"
        action = "Reject the flagged part(s) and correct the process before the full run."
    else:
        decision, action = "GO", "Start production."
    reject = [i for i, p in enumerate(parts) if p["verdict"] != "ok"]
    return dict(decision=decision, action=action, defects=k, n=n, worst_severity=worst, reject_parts=reject,
                p_rate_exceeds_limit=round(p_exceed, 3), rate_limit=rate_limit,
                checks=CHECKS if decision != "GO" else [])
