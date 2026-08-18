#!/usr/bin/env python3
"""Targeted repair of flagged verse spans, driven by machine-listening.

Takes chapter:verse lists from the audit (verify_spans.py), nudges each
flagged boundary in the direction its verdict implies, re-listens, and
keeps the first adjustment the judge calls CLEAN.

Usage:
  python scripts/repair_spans.py <ffmpeg> Numbers.17:17 I_Kings.3:13,14,28
"""

import json
import subprocess
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from align_verses import AUDIO_DIR, OUT_PATH, fetch_verses  # noqa: E402
import verify_spans as vs  # noqa: E402
from asr_align_verses import norm  # noqa: E402


def judge(model, ffmpeg, mp3, verses, span, i, n_spans):
    """Cut one span and return the judge's verdict for verse i."""
    with tempfile.TemporaryDirectory() as td:
        seg = Path(td) / "v.wav"
        vs.cut_wav(ffmpeg, mp3, span[0], span[1], seg)
        segments, _ = model.transcribe(
            str(seg), language="he", word_timestamps=False,
            condition_on_previous_text=False, beam_size=3,
        )
        heard = []
        for sg in segments:
            heard.extend(norm(w) for w in sg.text.split())
        heard = [w for w in heard if w]

    expect = [norm(w) for w in verses[i].split()]
    expect = [w for w in expect if w]
    H = vs.joined(heard)
    E = vs.joined(expect)
    prev_words = []
    if i > 0:
        pw = [norm(w) for w in verses[i - 1].split()]
        prev_words = [w for w in pw if w]
    next_words = []
    if i + 1 < len(verses):
        nw = [norm(w) for w in verses[i + 1].split()]
        next_words = [w for w in nw if w]

    if len(H) < 4:
        return "MUTE/ODD"
    K = 18
    s_clean = vs.chunk_sim(H[:K], E[:K])
    s_best, s_who = s_clean, "CLEAN"
    cands = {
        "CLIPPED-START": vs.joined(expect[1:])[:K],
        "LEAKS-PREV": (vs.joined(prev_words[-3:]) + E)[:K] if prev_words else None,
    }
    for who, hyp in cands.items():
        if hyp:
            sc = vs.chunk_sim(H[:K], hyp)
            if sc > s_best + 0.12:
                s_best, s_who = sc, who
    if s_who != "CLEAN":
        return s_who
    e_clean = vs.chunk_sim(H[-K:], E[-K:])
    e_best, e_who = e_clean, "CLEAN"
    cands = {
        "CLIPPED-END": vs.joined(expect[:-1])[-K:] if len(expect) > 1 else None,
        "LEAKS-NEXT": (E + vs.joined(next_words[:3]))[-K:] if next_words else None,
    }
    for who, hyp in cands.items():
        if hyp:
            sc = vs.chunk_sim(H[-K:], hyp)
            if sc > e_best + 0.12:
                e_best, e_who = sc, who
    return e_who


# per-verdict boundary nudges to try, in order
NUDGES = {
    "CLIPPED-START": [(-0.35, 0), (-0.7, 0), (-1.1, 0), (-1.6, 0)],
    "LEAKS-PREV": [(0.35, 0), (0.7, 0), (1.1, 0), (1.6, 0)],
    "CLIPPED-END": [(0, 0.35), (0, 0.7), (0, 1.1), (0, 1.6)],
    "LEAKS-NEXT": [(0, -0.35), (0, -0.7), (0, -1.1), (0, -1.6)],
    "MUTE/ODD": [(-0.5, 0.5), (-1.0, 1.0)],
}


def main():
    from faster_whisper import WhisperModel
    ffmpeg = sys.argv[1]
    targets: list[tuple[str, list[int]]] = []
    for arg in sys.argv[2:]:
        ref, nums = arg.split(":")
        targets.append((ref, [int(x) - 1 for x in nums.split(",")]))

    model = WhisperModel("small", device="cpu", compute_type="int8")
    m = json.loads(OUT_PATH.read_text(encoding="utf-8"))

    for ref, idxs in targets:
        entry = m[ref]
        verses = fetch_verses(ref)
        mp3 = AUDIO_DIR / entry["file"].rsplit("/", 1)[-1]
        spans = entry["verses"]
        for i in idxs:
            span = list(spans[i])
            verdict = judge(model, ffmpeg, mp3, verses, span, i, len(spans))
            if verdict == "CLEAN":
                print(f"{ref}:{i+1} already CLEAN", flush=True)
                continue
            fixed = False
            for ds, de in NUDGES.get(verdict, []):
                cand = [max(0.0, span[0] + ds), span[1] + de]
                # keep inside neighbors' words (allow eating into pauses)
                if i > 0 and cand[0] < spans[i - 1][1] - 1.2:
                    continue
                if i + 1 < len(spans) and cand[1] > spans[i + 1][0] + 1.2:
                    continue
                v2 = judge(model, ffmpeg, mp3, verses, cand, i, len(spans))
                if v2 == "CLEAN":
                    spans[i] = [round(cand[0], 2), round(cand[1], 2)]
                    print(f"{ref}:{i+1} {verdict} -> CLEAN with ({ds:+},{de:+})",
                          flush=True)
                    fixed = True
                    break
            if not fixed:
                print(f"{ref}:{i+1} {verdict} — NOT fixed automatically", flush=True)
        OUT_PATH.write_text(json.dumps(m, ensure_ascii=False), encoding="utf-8")

    print("map updated:", OUT_PATH)


if __name__ == "__main__":
    main()
