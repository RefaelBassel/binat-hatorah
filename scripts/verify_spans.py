#!/usr/bin/env python3
"""Closed-loop QA for the verse-audio map: cut every verse span out of the
chapter MP3, transcribe the cut segment, and check it against the real
verse text — i.e., machine-listen to exactly what a student will hear.

Verdicts per verse:
  CLEAN         first words match the verse opening, no neighbor leakage
  CLIPPED-START opening words of the verse are missing
  LEAKS-PREV    segment starts with the previous verse's ending
  LEAKS-NEXT    segment ends with the next verse's opening
  MUTE/ODD      transcription empty or unrecognizable

Usage: python scripts/verify_spans.py <ffmpeg> [refs...]
"""

import json
import subprocess
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from align_verses import AUDIO_DIR, OUT_PATH, fetch_verses  # noqa: E402
from asr_align_verses import norm, bigrams, sim  # noqa: E402


def cut_wav(ffmpeg: str, mp3: Path, start: float, end: float, out: Path):
    subprocess.run(
        [ffmpeg, "-v", "error", "-ss", f"{start:.2f}", "-to", f"{end:.2f}",
         "-i", str(mp3), "-ar", "16000", "-ac", "1", "-y", str(out)],
        capture_output=True,
    )


def words_sim(a: list[str], b: list[str]) -> float:
    if not a or not b:
        return 0.0
    k = min(len(a), len(b))
    tot = 0.0
    for x, y in zip(a[:k], b[:k]):
        tot += sim(x, y, bigrams(x), bigrams(y))
    return tot / k


# ASR splits and merges words freely ("וי דבר", "משהל מור"), so all
# comparisons run on JOINED consonantal strings, not word-by-word.
def joined(words: list[str]) -> str:
    return "".join(words)


def chunk_sim(a: str, b: str) -> float:
    if not a or not b:
        return 0.0
    k = min(len(a), len(b))
    a, b = a[:k], b[:k]
    grams = lambda s: {s[i:i + 2] for i in range(len(s) - 1)} or {s}
    ga, gb = grams(a), grams(b)
    return len(ga & gb) / (len(ga | gb) or 1)


def verify_chapter(model, ffmpeg: str, ref: str, entry: dict):
    verses = fetch_verses(ref)
    book_ch = entry["file"].rsplit("/", 1)[-1]
    mp3 = AUDIO_DIR / book_ch
    spans = entry["verses"]
    results = []
    with tempfile.TemporaryDirectory() as td:
        for i, (s, e) in enumerate(spans):
            seg = Path(td) / f"v{i}.wav"
            cut_wav(ffmpeg, mp3, s, e, seg)
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
            H = joined(heard)
            E = joined(expect)
            prev_words = []
            if i > 0:
                pw = [norm(w) for w in verses[i - 1].split()]
                prev_words = [w for w in pw if w]
            next_words = []
            if i + 1 < len(verses):
                nw = [norm(w) for w in verses[i + 1].split()]
                next_words = [w for w in nw if w]

            # Best-explanation judging: ASR noise hits every hypothesis
            # equally, so RELATIVE comparison is stable where absolute
            # thresholds are not. A challenger must beat "clean" clearly.
            verdict = "CLEAN"
            if len(H) < 4:
                verdict = "MUTE/ODD"
            else:
                K = 18
                start_hyp = {
                    "CLEAN": E[:K],
                    "CLIPPED-START": joined(expect[1:])[:K],
                    "LEAKS-PREV": (joined(prev_words[-3:]) + E)[:K]
                    if prev_words else None,
                }
                s_clean = chunk_sim(H[:K], start_hyp["CLEAN"])
                s_best, s_who = s_clean, "CLEAN"
                for who in ("CLIPPED-START", "LEAKS-PREV"):
                    hyp = start_hyp[who]
                    if hyp:
                        sc = chunk_sim(H[:K], hyp)
                        if sc > s_best + 0.12:
                            s_best, s_who = sc, who

                end_hyp = {
                    "CLEAN": E[-K:],
                    "CLIPPED-END": joined(expect[:-1])[-K:] if len(expect) > 1 else None,
                    "LEAKS-NEXT": (E + joined(next_words[:3]))[-K:]
                    if next_words else None,
                }
                e_clean = chunk_sim(H[-K:], end_hyp["CLEAN"])
                e_best, e_who = e_clean, "CLEAN"
                for who in ("CLIPPED-END", "LEAKS-NEXT"):
                    hyp = end_hyp[who]
                    if hyp:
                        sc = chunk_sim(H[-K:], hyp)
                        if sc > e_best + 0.12:
                            e_best, e_who = sc, who

                if s_who != "CLEAN":
                    verdict = s_who
                elif e_who != "CLEAN":
                    verdict = e_who
            results.append(verdict)
    return results


def main():
    from faster_whisper import WhisperModel
    ffmpeg = sys.argv[1] if len(sys.argv) > 1 else "ffmpeg"
    only = set(sys.argv[2:])
    model = WhisperModel("small", device="cpu", compute_type="int8")
    m = json.loads(OUT_PATH.read_text(encoding="utf-8"))
    grand = {"CLEAN": 0}
    for ref, entry in m.items():
        if only and ref not in only:
            continue
        results = verify_chapter(model, ffmpeg, ref, entry)
        bad = {i + 1: v for i, v in enumerate(results) if v != "CLEAN"}
        for v in results:
            grand[v] = grand.get(v, 0) + 1
        pct = round(100 * results.count("CLEAN") / len(results))
        print(f"{ref}: {pct}% clean" + (f"  issues: {bad}" if bad else ""),
              flush=True)
    total = sum(grand.values())
    print("\nTOTAL:", {k: v for k, v in sorted(grand.items())},
          f"({round(100 * grand.get('CLEAN', 0) / max(1, total))}% clean)")


if __name__ == "__main__":
    main()
