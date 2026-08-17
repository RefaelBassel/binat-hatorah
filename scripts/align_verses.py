#!/usr/bin/env python3
"""Build a verse-level timestamp map for the Shmuelof chapter recordings.

Approach (no ASR needed):
 1. Fetch the chapter's Hebrew verse texts from the Sefaria API and use each
    verse's consonantal length as a duration weight (one narrator, steady
    pace -> verse audio duration is nearly proportional to text length).
 2. Detect silences in the chapter MP3 with ffmpeg silencedetect; the pauses
    between verses (sof pasuk) are boundary CANDIDATES.
 3. Dynamic programming picks N-1 of the M candidate silences so that the
    resulting verse durations best match the text-length proportions
    (squared relative error), with a small bonus for longer silences.
 4. Emits public/audio/tanach/audio-map.json + a per-chapter QA report.

Usage:  python scripts/align_verses.py <path-to-ffmpeg.exe>
"""

import json
import re
import subprocess
import sys
import urllib.request
from pathlib import Path

AUDIO_DIR = Path(__file__).resolve().parent.parent / "public" / "audio" / "tanach"
OUT_PATH = AUDIO_DIR / "audio-map.json"

# Strip nikud, taamim and Hebrew punctuation to get a consonantal weight.
MARKS = re.compile(r"[֑-ׇ׳״‏‎־|׀]")
TAGS = re.compile(r"<[^>]+>")


def fetch_verses(sefaria_ref: str) -> list[str]:
    url = f"https://www.sefaria.org/api/texts/{sefaria_ref}?context=0&commentary=0"
    with urllib.request.urlopen(url, timeout=30) as r:
        data = json.load(r)
    verses = data["he"]
    if not isinstance(verses, list):
        raise RuntimeError(f"unexpected he payload for {sefaria_ref}")
    return [TAGS.sub("", v) for v in verses]


def weight(verse: str) -> float:
    bare = MARKS.sub("", verse)
    # collapse whitespace; spaces still count a little (word pauses)
    bare = re.sub(r"\s+", " ", bare).strip()
    letters = sum(1 for c in bare if c != " ")
    spaces = bare.count(" ")
    return letters + 0.5 * spaces + 6.0  # +6: fixed per-verse overhead (breath)


def detect_silences(ffmpeg: str, mp3: Path, noise_db: int, min_d: float):
    """Return (total_duration, [(silence_start, silence_end), ...])."""
    proc = subprocess.run(
        [ffmpeg, "-hide_banner", "-i", str(mp3), "-af",
         f"silencedetect=noise={noise_db}dB:d={min_d}", "-f", "null", "-"],
        capture_output=True, text=True, encoding="utf-8", errors="replace",
    )
    log = proc.stderr
    dur = None
    m = re.search(r"Duration:\s*(\d+):(\d+):(\d+\.\d+)", log)
    if m:
        dur = int(m.group(1)) * 3600 + int(m.group(2)) * 60 + float(m.group(3))
    starts = [float(x) for x in re.findall(r"silence_start:\s*([\d.]+)", log)]
    ends = [float(x) for x in re.findall(r"silence_end:\s*([\d.]+)", log)]
    pairs = list(zip(starts, ends))
    if len(starts) == len(ends) + 1:  # file ends inside a silence
        pairs = list(zip(starts, ends + [dur]))
    return dur, pairs


def align_chapter(ffmpeg: str, mp3: Path, verses: list[str]):
    n = len(verses)
    w = [weight(v) for v in verses]
    total_w = sum(w)

    # find a silence threshold that yields a comfortable surplus of
    # candidates (the DP needs freedom to choose); noisier tapes need a
    # higher noise floor and shorter minimum pause
    attempts = [(-35, 0.30), (-35, 0.22), (-32, 0.20), (-30, 0.18),
                (-28, 0.16), (-26, 0.14), (-24, 0.12), (-22, 0.10)]
    dur = None
    sil = []
    best = (None, [])
    for noise, d in attempts:
        dur, sil = detect_silences(ffmpeg, mp3, noise, d)
        if dur and len(sil) > len(best[1]):
            best = (dur, sil)
        if dur and len(sil) >= 2 * n:  # comfortable surplus — stop here
            break
    else:
        dur, sil = best

    if not dur:
        raise RuntimeError(f"could not read duration of {mp3.name}")

    # speech span: skip leading/trailing silence
    speech_start = 0.0
    speech_end = dur
    inner = list(sil)
    if inner and inner[0][0] < 0.8:
        speech_start = inner[0][1]
        inner = inner[1:]
    if inner and inner[-1][1] > dur - 0.4:
        speech_end = inner[-1][0]
        inner = inner[:-1]

    if len(inner) < n - 1:
        return None, f"only {len(inner)} candidate pauses for {n} verses"

    # Some recordings open with a spoken chapter announcement ("...פרק")
    # before verse 1. Try treating the first 0/1/2 pauses as the end of such
    # a preamble and keep the variant whose verse pacing is most stable.
    variants = []
    for skip in (0, 1, 2):
        if len(inner) - skip < n - 1:
            break
        vs_start = inner[skip - 1][1] if skip else speech_start
        variants.append((skip, vs_start, inner[skip:]))
    return pick_best_variant(variants, speech_end, n, w, total_w)


def pick_best_variant(variants, speech_end, n, w, total_w):
    best = None
    for skip, speech_start, inner in variants:
        result = solve_dp(speech_start, speech_end, inner, n, w, total_w)
        if result is None:
            continue
        spans, report = result
        report["preamble_pauses_skipped"] = skip
        score = (len(report["pace_outliers"]), -(report["consensus"] or 0))
        if best is None or score < best[0]:
            best = (score, spans, report)
    if best is None:
        return None, "no viable alignment variant"
    return best[1], best[2]


def solve_dp(speech_start, speech_end, inner, n, w, total_w):
    m = len(inner)
    if m < n - 1:
        return None

    speech_total = speech_end - speech_start
    # expected cumulative end-time of verse i (0-based), in seconds
    cum = []
    acc = 0.0
    for wi in w:
        acc += wi
        cum.append(speech_start + speech_total * (acc / total_w))

    # candidate boundary times: midpoint of each inner silence,
    # plus (start,end) so a chosen boundary can split the pause cleanly
    cands = [(s, e, (s + e) / 2, e - s) for (s, e) in inner]
    max_sil = max(c[3] for c in cands) or 1.0

    # DP: pick indices j_1 < j_2 < ... < j_{n-1} from cands minimizing a
    # position error normalized per verse, minus a strong bonus for long
    # pauses (sof-pasuk pauses are systematically longer than mid-verse
    # etnachta pauses).
    INF = float("inf")
    # cost of assigning candidate j as the boundary after verse i
    def cost(i: int, j: int) -> float:
        diff = cands[j][2] - cum[i]
        sigma = max(1.2, 0.30 * speech_total * (w[i] / total_w))
        return (diff / sigma) ** 2 - 2.0 * (cands[j][3] / max_sil)

    prev = [[-1] * m for _ in range(n - 1)] if n > 1 else []
    dp_prev = [cost(0, j) for j in range(m)]
    for i in range(1, n - 1):
        dp_cur = [INF] * m
        best_val, best_j = INF, -1
        for j in range(i, m - (n - 2 - i)):
            if dp_prev[j - 1] < best_val:
                best_val, best_j = dp_prev[j - 1], j - 1
            c = cost(i, j)
            if best_val + c < dp_cur[j]:
                dp_cur[j] = best_val + c
                prev[i][j] = best_j
        dp_prev = dp_cur

    if n == 1:
        chosen = []
    else:
        j_last = min(range(n - 2, m), key=lambda j: dp_prev[j])
        chosen = [j_last]
        for i in range(n - 2, 0, -1):
            j_last = prev[i][j_last]
            chosen.append(j_last)
        chosen.reverse()

    # build [start, end] per verse: end = silence_start of the chosen pause,
    # next start = silence_end of that pause
    spans = []
    cur_start = speech_start
    for j in chosen:
        s, e, _, _ = cands[j]
        spans.append([round(cur_start, 2), round(s, 2)])
        cur_start = e
    spans.append([round(cur_start, 2), round(speech_end, 2)])

    # QA 1: pace per verse (seconds per weight unit) should be stable
    paces = [(sp[1] - sp[0]) / wi for sp, wi in zip(spans, w)]
    mean_pace = sum(paces) / len(paces)
    outliers = [i + 1 for i, p in enumerate(paces)
                if abs(p - mean_pace) > 0.45 * mean_pace]

    # QA 2: consensus with an independent heuristic — take the n-1 LONGEST
    # inner silences as boundaries; count how many DP boundaries agree
    # (within 0.35s). High agreement = high confidence.
    agree = None
    if n > 1:
        longest = sorted(range(len(cands)), key=lambda j: -cands[j][3])[: n - 1]
        longest_mids = sorted(cands[j][2] for j in longest)
        chosen_mids = [cands[j][2] for j in chosen]
        hits = 0
        for cmid in chosen_mids:
            if any(abs(cmid - lm) <= 0.35 for lm in longest_mids):
                hits += 1
        agree = round(100 * hits / (n - 1))

    report = {
        "verses": n,
        "candidates": m,
        "pace_outliers": outliers,
        "consensus": agree,
    }
    return spans, report


BOOK_FILES = {
    "Numbers": ["09", "10", "11", "12", "13", "14", "15", "16", "17",
                 "19", "20", "21", "25", "27", "28", "29", "32", "36"],
    "I_Kings": ["03", "12", "18", "21"],
    "II_Kings": ["17"],
}
SEFARIA_BOOK = {"Numbers": "Numbers", "I_Kings": "I_Kings", "II_Kings": "II_Kings"}


def main():
    ffmpeg = sys.argv[1] if len(sys.argv) > 1 else "ffmpeg"
    out = {}
    problems = []
    for book, chapters in BOOK_FILES.items():
        for ch in chapters:
            mp3 = AUDIO_DIR / f"{book}.{ch}.mp3"
            ref = f"{SEFARIA_BOOK[book]}.{int(ch)}"
            verses = fetch_verses(ref)
            spans, report = align_chapter(ffmpeg, mp3, verses)
            if spans is None:
                problems.append(f"{ref}: {report}")
                print(f"FAIL {ref}: {report}")
                continue
            out[ref] = {"file": f"/audio/tanach/{book}.{ch}.mp3", "verses": spans}
            flag = f"  !! outliers {report['pace_outliers']}" if report["pace_outliers"] else ""
            print(f"OK   {ref}: {report['verses']} verses, "
                  f"{report['candidates']} pauses, consensus {report['consensus']}%, "
                  f"preamble {report['preamble_pauses_skipped']}{flag}")
    OUT_PATH.write_text(json.dumps(out, ensure_ascii=False), encoding="utf-8")
    print(f"\nwrote {OUT_PATH} ({len(out)} chapters)")
    if problems:
        print("PROBLEMS:")
        for p in problems:
            print(" -", p)
        sys.exit(1)


if __name__ == "__main__":
    main()
