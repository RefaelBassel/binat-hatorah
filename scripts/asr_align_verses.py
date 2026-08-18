#!/usr/bin/env python3
"""ASR-anchored verse alignment for the Shmuelof chapter recordings.

Refines align_verses.py: transcribes each chapter with faster-whisper
(word timestamps), aligns the ASR word stream to the Sefaria verse text
with a banded sequence alignment, derives verse boundaries from the
aligned words, and snaps each boundary to the enclosing silence so
playback starts/ends cleanly. Verses that fail to anchor are
interpolated proportionally between their anchored neighbors.

Usage:  python scripts/asr_align_verses.py <ffmpeg.exe> [model] [refs...]
        model defaults to "small"; refs like Numbers.17 limit the run.
"""

import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from align_verses import (  # noqa: E402
    AUDIO_DIR, OUT_PATH, BOOK_FILES, SEFARIA_BOOK,
    MARKS, fetch_verses, detect_silences, weight,
)

NON_LETTER = re.compile(r"[^א-ת]")
FINALS = str.maketrans("םןץףך", "מנצפכ")


def norm(word: str) -> str:
    w = MARKS.sub("", word)
    w = NON_LETTER.sub("", w).translate(FINALS)
    if w in ("יהוה", "אדוני"):
        w = "אדני"
    return w


def bigrams(w: str) -> set[str]:
    if len(w) < 2:
        return {w} if w else set()
    return {w[i:i + 2] for i in range(len(w) - 1)}


def sim(a: str, b: str, ba: set[str], bb: set[str]) -> float:
    if not a or not b:
        return 0.0
    if a == b:
        return 1.0
    inter = len(ba & bb)
    union = len(ba | bb) or 1
    return inter / union


def band_align(text_words: list[str], asr_words: list[str], band: int = 90):
    """Banded Needleman-Wunsch; returns mapping text_idx -> asr_idx (or -1)."""
    n, m = len(text_words), len(asr_words)
    tb = [bigrams(w) for w in text_words]
    ab = [bigrams(w) for w in asr_words]
    GAP = -0.45
    NEG = float("-inf")

    # dp[i][j] over band around the diagonal j ≈ i*m/n
    def jrange(i: int):
        center = int(i * m / max(1, n))
        return max(0, center - band), min(m, center + band)

    score = {}
    back = {}
    score[(0, 0)] = 0.0
    lo0, hi0 = jrange(0)
    for i in range(n + 1):
        lo, hi = jrange(i) if i < n else jrange(n - 1)
        for j in range(lo, hi + 1):
            if i == 0 and j == 0:
                continue
            best, arrow = NEG, None
            if i > 0 and (i - 1, j) in score:
                v = score[(i - 1, j)] + GAP
                if v > best:
                    best, arrow = v, "up"
            if j > 0 and (i, j - 1) in score:
                v = score[(i, j - 1)] + GAP
                if v > best:
                    best, arrow = v, "left"
            if i > 0 and j > 0 and (i - 1, j - 1) in score:
                s = sim(text_words[i - 1], asr_words[j - 1], tb[i - 1], ab[j - 1])
                v = score[(i - 1, j - 1)] + (s * 2 - 0.9)
                if v > best:
                    best, arrow = v, "diag"
            if arrow:
                score[(i, j)] = best
                back[(i, j)] = arrow

    # find best endpoint on the last row within band
    lo, hi = jrange(n - 1)
    end = max(((n, j) for j in range(lo, hi + 1) if (n, j) in score),
              key=lambda k: score[k], default=None)
    mapping = [-1] * n
    if end is None:
        return mapping
    i, j = end
    while (i, j) in back:
        a = back[(i, j)]
        if a == "diag":
            s = sim(text_words[i - 1], asr_words[j - 1], tb[i - 1], ab[j - 1])
            if s >= 0.34:
                mapping[i - 1] = j - 1
            i, j = i - 1, j - 1
        elif a == "up":
            i -= 1
        else:
            j -= 1
    return mapping


CACHE_DIR = Path(__file__).resolve().parent / ".asr-cache"


def transcribe_words(model, ffmpeg: str, source: Path):
    segments, _ = model.transcribe(
        str(source), language="he", word_timestamps=True,
        condition_on_previous_text=False,
        initial_prompt="וידבר יהוה אל משה לאמר",
        vad_filter=True,
        vad_parameters={"min_silence_duration_ms": 700},
    )
    words = []
    for seg in segments:
        for w in seg.words or []:
            nw = norm(w.word)
            if nw:
                words.append((nw, w.start, w.end))
    return words


# Transcription is by far the slowest step (~real-time on CPU); cache the
# word list per chapter so boundary-logic iterations re-run in seconds.
def transcribe_words_cached(model, ffmpeg: str, mp3: Path, ref: str):
    CACHE_DIR.mkdir(exist_ok=True)
    cache = CACHE_DIR / f"{ref}.json"
    if cache.exists():
        return [tuple(w) for w in json.loads(cache.read_text(encoding="utf-8"))]
    asr = transcribe_words(model, ffmpeg, mp3)
    if asr:
        cache.write_text(json.dumps(asr, ensure_ascii=False), encoding="utf-8")
    return asr


def align_chapter_asr(model, ffmpeg: str, mp3: Path, verses: list[str], ref: str):
    n = len(verses)
    # verse word streams (normalized, empty words dropped)
    verse_words = []
    for v in verses:
        ws = [norm(w) for w in v.split()]
        verse_words.append([w for w in ws if w])
    flat = [w for ws in verse_words for w in ws]
    v_of = []
    for vi, ws in enumerate(verse_words):
        v_of.extend([vi] * len(ws))

    asr = transcribe_words_cached(model, ffmpeg, mp3, ref)
    if len(asr) < len(flat) * 0.5:
        # PyAV chokes on corrupt frames some source MP3s carry — decode to a
        # temp WAV with the (more tolerant) ffmpeg CLI and retry
        import subprocess
        import tempfile
        with tempfile.TemporaryDirectory() as td:
            wav = Path(td) / "chapter.wav"
            subprocess.run(
                [ffmpeg, "-v", "error", "-err_detect", "ignore_err",
                 "-i", str(mp3), "-ar", "16000", "-ac", "1", "-y", str(wav)],
                capture_output=True,
            )
            if wav.exists():
                asr = transcribe_words(model, ffmpeg, wav)
                if len(asr) >= len(flat) * 0.5:
                    (CACHE_DIR / f"{ref}.json").write_text(
                        json.dumps(asr, ensure_ascii=False), encoding="utf-8")
    if len(asr) < len(flat) * 0.5:
        return None, f"ASR too sparse ({len(asr)} words vs {len(flat)} in text)"

    mapping = band_align(flat, [a[0] for a in asr])

    # per verse: first/last anchored ASR word
    starts = [None] * n
    ends = [None] * n
    matched = [0] * n
    for ti, ai in enumerate(mapping):
        if ai < 0:
            continue
        vi = v_of[ti]
        matched[vi] += 1
        st, en = asr[ai][1], asr[ai][2]
        if starts[vi] is None or st < starts[vi]:
            starts[vi] = st
        if ends[vi] is None or en > ends[vi]:
            ends[vi] = en
    anchored = [i for i in range(n)
                if starts[i] is not None and matched[i] >= min(2, len(verse_words[i]))]
    if len(anchored) < 0.7 * n:
        return None, f"only {len(anchored)}/{n} verses anchored"

    # enforce monotonicity: drop anchors that go backwards
    mono = []
    for i in anchored:
        if not mono or starts[i] > starts[mono[-1]] and ends[i] > ends[mono[-1]]:
            mono.append(i)
        # else skip — will be interpolated
    anchored_set = set(mono)

    # interpolate missing verses by text weight between anchored neighbors
    w = [weight(v) for v in verses]
    est_start = [None] * n
    est_end = [None] * n
    for i in anchored_set:
        est_start[i], est_end[i] = starts[i], ends[i]
    i = 0
    while i < n:
        if est_start[i] is not None:
            i += 1
            continue
        run_start = i
        while i < n and est_start[i] is None:
            i += 1
        run_end = i  # exclusive
        left_t = est_end[run_start - 1] if run_start > 0 else 0.0
        right_t = est_start[run_end] if run_end < n else None
        if right_t is None:
            # tail: pace-extrapolate from the left
            pace = 0.55  # s per weight unit, rough fallback
            t = left_t
            for k in range(run_start, run_end):
                est_start[k] = t + 0.3
                t = est_start[k] + w[k] * pace
                est_end[k] = t
            continue
        seg_w = sum(w[run_start:run_end])
        t = left_t
        span = right_t - left_t
        for k in range(run_start, run_end):
            est_start[k] = t + 0.15
            t = left_t + span * (sum(w[run_start:k + 1]) / seg_w)
            est_end[k] = t - 0.15

    # Boundaries come from the AUDIO, not from ASR times: whisper word
    # timestamps lag systematically (students heard verse starts clipped
    # and the next verse's opening leak in). For each consecutive pair,
    # the true boundary is the LONGEST pause found between the two verses'
    # anchor words — the window is widened backwards to compensate the lag.
    dur, sil = detect_silences(ffmpeg, str(mp3), -30, 0.15)
    LAG = 0.45  # typical whisper-small timestamp lag, seconds

    def longest_pause(lo: float, hi: float):
        best = None
        for ss, se in sil:
            mid = (ss + se) / 2
            if lo <= mid <= hi:
                if best is None or (se - ss) > (best[1] - best[0]):
                    best = (ss, se)
        return best

    bounds: list[tuple[float, float]] = []  # (end of verse i, start of i+1)
    for i in range(n - 1):
        left = est_end[i]
        right = est_start[i + 1]
        pause = longest_pause(min(left, right) - 1.9, max(left, right) + 0.5)
        if pause:
            bounds.append((pause[0], pause[1]))
        else:
            mid = (left + right) / 2 - LAG
            bounds.append((mid, mid))

    # first verse start: latest pause that ends shortly before its first word.
    # Soft onsets (ו, מ, נ...) cross the silence threshold LATE, so never
    # start at the detected silence end — back off well into the pause.
    first_start = max(0.0, est_start[0] - LAG)
    lead = longest_pause(est_start[0] - 2.2, est_start[0] + 0.4)
    if lead:
        first_start = max(lead[0] + 0.1, lead[1] - 0.4)
    # last verse end: first pause after its last word (or the word end + tail)
    last_end = est_end[n - 1] + 0.3
    for ss, se in sil:
        if est_end[n - 1] - 0.8 <= ss <= est_end[n - 1] + 2.0:
            last_end = ss
            break
    if dur:
        last_end = min(last_end, dur)

    spans = []
    cur = first_start
    for i in range(n - 1):
        end_i, next_start = bounds[i]
        spans.append([round(max(0, cur - 0.1), 2), round(end_i + 0.12, 2)])
        # same soft-onset compensation at every verse start: begin well
        # inside the pause, not at its detected end
        cur = max(end_i + 0.15, next_start - 0.4)
    spans.append([round(max(0, cur - 0.1), 2), round(last_end + 0.12, 2)])

    # monotonic sanity
    for i in range(1, n):
        if spans[i][0] < spans[i - 1][0] + 0.4:
            spans[i][0] = spans[i - 1][0] + 0.4
        if spans[i][1] <= spans[i][0]:
            spans[i][1] = spans[i][0] + 1.0

    total_words = len(flat)
    hit = sum(1 for x in mapping if x >= 0)
    report = {
        "verses": n,
        "anchored": len(anchored_set),
        "word_match": round(100 * hit / total_words),
    }
    return spans, report


def main():
    from faster_whisper import WhisperModel
    ffmpeg = sys.argv[1] if len(sys.argv) > 1 else "ffmpeg"
    model_name = sys.argv[2] if len(sys.argv) > 2 else "small"
    only = set(sys.argv[3:])

    model = WhisperModel(model_name, device="cpu", compute_type="int8")
    existing = {}
    if OUT_PATH.exists():
        existing = json.loads(OUT_PATH.read_text(encoding="utf-8"))

    problems = []
    for book, chapters in BOOK_FILES.items():
        for ch in chapters:
            ref = f"{SEFARIA_BOOK[book]}.{int(ch)}"
            if only and ref not in only:
                continue
            mp3 = AUDIO_DIR / f"{book}.{ch}.mp3"
            verses = fetch_verses(ref)
            spans, report = align_chapter_asr(model, ffmpeg, mp3, verses, ref)
            if spans is None:
                problems.append(f"{ref}: {report} (kept previous spans)")
                print(f"KEEP {ref}: {report}", flush=True)
                continue
            existing[ref] = {"file": f"/audio/tanach/{book}.{ch}.mp3",
                             "verses": spans}
            print(f"OK   {ref}: {report['verses']} verses, "
                  f"anchored {report['anchored']}, "
                  f"word match {report['word_match']}%", flush=True)
            OUT_PATH.write_text(json.dumps(existing, ensure_ascii=False),
                                encoding="utf-8")

    print(f"\nwrote {OUT_PATH} ({len(existing)} chapters)")
    if problems:
        print("KEPT SILENCE-DP SPANS FOR:")
        for p in problems:
            print(" -", p)


if __name__ == "__main__":
    main()
