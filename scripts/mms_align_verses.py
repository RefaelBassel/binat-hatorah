#!/usr/bin/env python3
"""Forced alignment of the ACTUAL verse text to the Shmuelof recordings.

Replaces the ASR-guessing pipeline: torchaudio's MMS_FA aligner pins every
word of the true (vocalized) verse text to its exact position in the audio,
so verse boundaries fall out directly — no transcription errors, no
timestamp lag. A star token absorbs the spoken chapter announcement at the
start (and anything untranscribed at the end).

Usage:  python scripts/mms_align_verses.py <ffmpeg.exe> [refs...]
"""

import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

import torch
import torchaudio
import uroman as ur

sys.path.insert(0, str(Path(__file__).resolve().parent))
from align_verses import (  # noqa: E402
    AUDIO_DIR, OUT_PATH, BOOK_FILES, SEFARIA_BOOK,
    fetch_verses, detect_silences,
)

URO = ur.Uroman()
TAAMIM = re.compile(r"[֑-ֽֿ֯]")  # cantillation etc.
PAREN = re.compile(r"[({\[][^)}\]]*[)}\]]")          # ketiv/qere doublets
NON_HEB = re.compile(r"[^ְ-ׇּׁׂא-ת ]")
DIVINE = re.compile(r"יְ?הֹ?וָ?ה")


def verse_to_words(text: str) -> list[str]:
    t = PAREN.sub(" ", text)
    t = TAAMIM.sub("", t)
    t = t.replace("־", " ").replace("׀", " ")
    t = DIVINE.sub("אֲדֹנָי", t)  # narrated as Adonai
    t = NON_HEB.sub(" ", t)
    return [w for w in t.split() if any("א" <= c <= "ת" for c in w)]


def romanize(word: str, dictionary: dict[str, int]) -> list[int]:
    r = str(URO.romanize_string(word)).lower()
    return [dictionary[c] for c in r if c in dictionary]


def decode_wav(ffmpeg: str, mp3: Path, out_wav: Path):
    subprocess.run(
        [ffmpeg, "-v", "error", "-err_detect", "ignore_err",
         "-i", str(mp3), "-ar", "16000", "-ac", "1", "-y", str(out_wav)],
        capture_output=True, check=True,
    )


def align_chapter(bundle, model, dictionary, ffmpeg: str, mp3: Path,
                  verses: list[str]):
    n = len(verses)
    verse_words = [verse_to_words(v) for v in verses]
    words = ["*"]
    verse_of: list[int] = [-1]
    for vi, ws in enumerate(verse_words):
        words.extend(ws)
        verse_of.extend([vi] * len(ws))
    words.append("*")
    verse_of.append(-1)

    star_id = dictionary["*"]
    tokens_per_word = []
    for w in words:
        if w == "*":
            tokens_per_word.append([star_id])
        else:
            toks = romanize(w, dictionary)
            tokens_per_word.append(toks if toks else [star_id])

    with tempfile.TemporaryDirectory() as td:
        wav_path = Path(td) / "c.wav"
        decode_wav(ffmpeg, mp3, wav_path)
        # torchaudio.load now needs torchcodec; plain 16-bit PCM WAV is
        # trivial to read with the stdlib instead
        import wave
        with wave.open(str(wav_path), "rb") as wf:
            assert wf.getframerate() == 16000 and wf.getnchannels() == 1
            raw = wf.readframes(wf.getnframes())
    import array
    pcm = array.array("h")
    pcm.frombytes(raw)
    waveform = torch.tensor(pcm, dtype=torch.float32).unsqueeze(0) / 32768.0

    with torch.inference_mode():
        emission, _ = model(waveform)

    flat = [t for toks in tokens_per_word for t in toks]
    targets = torch.tensor([flat], dtype=torch.int32)
    aligned, scores = torchaudio.functional.forced_align(
        emission, targets, blank=0
    )
    token_spans = torchaudio.functional.merge_tokens(aligned[0], scores[0])
    # spans of real (non-blank) target tokens, in target order
    spans = [s for s in token_spans if s.token != 0]
    if len(spans) != len(flat):
        return None, f"aligner returned {len(spans)} spans for {len(flat)} tokens"

    ratio = waveform.size(1) / emission.size(1) / 16000
    # word time ranges
    word_times = []
    idx = 0
    for toks in tokens_per_word:
        chunk = spans[idx: idx + len(toks)]
        idx += len(toks)
        word_times.append((
            chunk[0].start * ratio,
            chunk[-1].end * ratio,
            sum(s.score for s in chunk) / len(chunk),
        ))

    # verse ranges from word times
    v_start = [None] * n
    v_end = [None] * n
    v_score: list[list[float]] = [[] for _ in range(n)]
    for (ws, we, sc), vi in zip(word_times, verse_of):
        if vi < 0:
            continue
        if v_start[vi] is None:
            v_start[vi] = ws
        v_end[vi] = we
        v_score[vi].append(sc)

    # CTC alignment bites into word onsets, so pad generously into the
    # inter-verse pause: the end of verse i gets a tail, the start of
    # verse i+1 gets a lead-in, both proportional to the available gap.
    spans_out: list[list[float]] = []
    for i in range(n):
        s = v_start[i]
        e = v_end[i]
        # lead-in before the first word
        gap_before = s - (v_end[i - 1] if i > 0 else 0.0)
        lead = min(0.45, max(0.15, gap_before * 0.45))
        # tail after the last word
        gap_after = (v_start[i + 1] - e) if i + 1 < n else 1.0
        tail = min(0.5, max(0.18, gap_after * 0.55))
        spans_out.append([round(max(0.0, s - lead), 2), round(e + tail, 2)])

    for i in range(1, n):
        if spans_out[i][0] < spans_out[i - 1][1] - 0.35:
            spans_out[i][0] = spans_out[i - 1][1] - 0.1
        if spans_out[i][1] <= spans_out[i][0]:
            spans_out[i][1] = spans_out[i][0] + 1.0

    import math
    mean_scores = [
        math.exp(sum(s) / len(s)) if s else 0.0 for s in v_score
    ]
    weak = [i + 1 for i, m in enumerate(mean_scores) if m < 0.35]
    report = {
        "verses": n,
        "avg_score": round(sum(mean_scores) / n, 3),
        "weak_verses": weak,
    }
    return spans_out, report


def main():
    ffmpeg = sys.argv[1] if len(sys.argv) > 1 else "ffmpeg"
    only = set(sys.argv[2:])

    bundle = torchaudio.pipelines.MMS_FA
    model = bundle.get_model(with_star=True)
    model.eval()
    dictionary = bundle.get_dict(star="*")

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
            try:
                spans, report = align_chapter(
                    bundle, model, dictionary, ffmpeg, mp3, verses)
            except Exception as exc:  # keep going; keep previous spans
                spans, report = None, repr(exc)
            if spans is None:
                problems.append(f"{ref}: {report}")
                print(f"KEEP {ref}: {report}", flush=True)
                continue
            existing[ref] = {"file": f"/audio/tanach/{book}.{ch}.mp3",
                             "verses": spans}
            flag = f"  !! weak {report['weak_verses']}" if report["weak_verses"] else ""
            print(f"OK   {ref}: {report['verses']} verses, "
                  f"avg score {report['avg_score']}{flag}", flush=True)
            OUT_PATH.write_text(json.dumps(existing, ensure_ascii=False),
                                encoding="utf-8")

    print(f"\nwrote {OUT_PATH} ({len(existing)} chapters)")
    if problems:
        print("KEPT PREVIOUS SPANS FOR:")
        for p in problems:
            print(" -", p)


if __name__ == "__main__":
    main()
