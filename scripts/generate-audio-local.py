#!/usr/bin/env python3
"""Generate the Marathi speech clips locally with an open-source model.

No cloud account or API key: this synthesizes every string the app can speak
with AI4Bharat Indic-TTS (FastPitch + HiFi-GAN, Marathi "female" and "male"
speakers) and by default writes public/audio-backup/<key>.mp3 plus
manifest.json: the BACKUP voice. The primary clips in public/audio come from
the cloud generator (scripts/generate-audio.mjs) and are never touched unless
you point --out-dir at them. Commit the result; for each text the app plays
the primary clip, else the backup clip (also when the primary one fails to
load), else the device's Marathi voice (src/lib/speech.js).

The list of clips and their keys comes from the Node generator
(`node scripts/generate-audio.mjs --list`), so keys are never recomputed here
and always match src/lib/audioKey.js.

Setup (once; CPU only, no GPU needed; about 5.5 GB of disk during setup, 4 GB after)
------------------------------------------------------------------------------------
Needs Node 18+ (for the clip list), ffmpeg with libmp3lame, and Python 3.9-3.11.
The Coqui `TTS` package does not install on Python 3.12+, so make a dedicated
environment outside the repo. With uv (https://docs.astral.sh/uv/):

    uv venv --python 3.10 ~/.venvs/indic-tts
    source ~/.venvs/indic-tts/bin/activate
    uv pip install torch==2.1.2 torchaudio==2.1.2 --index-url https://download.pytorch.org/whl/cpu
    uv pip install TTS==0.22.0 "transformers<4.40" "setuptools<70"

(or `python3.10 -m venv ...` and the same two `pip install` lines). Install
torch and torchaudio first, from the CPU index: otherwise PyPI supplies a CUDA
build that will not load without a GPU stack. The other two pins are the
versions this was tested with: transformers 5.x is newer than TTS 0.22 expects,
and setuptools 80+ no longer ships pkg_resources, which librosa imports. Then fetch
the Marathi checkpoint, a 1.5 GB zip holding mr/fastpitch and mr/hifigan, and
unzip it so that ~/.cache/indic-tts/mr/fastpitch/best_model.pth exists:

    mkdir -p ~/.cache/indic-tts && cd ~/.cache/indic-tts
    curl -LO https://github.com/AI4Bharat/Indic-TTS/releases/download/v1-checkpoints-release/mr.zip
    unzip mr.zip && rm mr.zip

Use another folder with --model-dir (or the INDIC_TTS_MODEL_DIR variable).

Usage (from the repo root, inside that environment)
---------------------------------------------------
    python scripts/generate-audio-local.py                   female voice, only missing clips
    python scripts/generate-audio-local.py --speaker male    switches voice: regenerates all
    python scripts/generate-audio-local.py --force           regenerate every clip
    python scripts/generate-audio-local.py --rate 0.9        10% slower than the natural pace (regenerates all)
    python scripts/generate-audio-local.py --dry-run         show the plan, load no model
    python scripts/generate-audio-local.py --out-dir DIR     write somewhere else than public/audio-backup

--out-dir public/audio would replace the primary cloud clips with this voice
(a different provider means everything there is regenerated and the old clips
removed), so only do that on purpose.

Re-runs are incremental, like `npm run audio`: a clip that is already on disk
is kept as long as provider, voice and rate in manifest.json are unchanged, and
clips whose text no longer exists in the course are deleted. Run it after
adding or editing lessons (`npm run check` says how many spoken items have no
clip in public/audio-backup). Pass --force after changing the text preparation
or post-processing in this file. Commit public/audio-backup afterwards.

What happens to each text
-------------------------
* Devanagari/ASCII digits are spelled as Marathi number words (१० -> दहा). A
  digit that the text already spells out right after it ("१ एक") is dropped
  instead, so the number is not said twice. Numbers above 100 are read digit
  by digit.
* " / " (alternative forms, e.g. "कसा / कशी") becomes a comma, i.e. a pause.
* Characters outside the model's vocabulary are removed, and reported.
* A one-character input ("अ", "क") crashes this FastPitch (its duration
  predictor squeezes a length-1 sequence away), so those get a final "." and
  the silence trimmer then removes whatever pause that adds.
* The waveform is trimmed to its speech plus 50 ms either side, levelled to a
  common speaking volume (RMS of the voiced frames, peak-limited) and encoded
  by ffmpeg to mono MP3, 22.05 kHz, 48 kbps. Trimming and levelling are done
  on the samples rather than with ffmpeg's silenceremove/loudnorm, because
  absolute silence thresholds eat the onset of the very quiet single-letter
  clips and loudnorm cannot measure clips shorter than 400 ms.
* Clips that look wrong (near-silent, shorter than 0.15 s, far longer than
  their text warrants) are retried with other paddings and, if they still look
  wrong, listed at the end. They are still written; check them by ear.

Licence: the AI4Bharat Indic-TTS repository is MIT-licensed
(Copyright (c) 2023 AI4Bhārat), and its model metadata lists the Marathi
models as MIT too; see README -> Audio voices.
"""

from __future__ import annotations

import argparse
import contextlib
import io
import json
import os
import re
import shutil
import statistics
import subprocess
import sys
import tempfile
import time
from pathlib import Path

import numpy as np

REPO = Path(__file__).resolve().parent.parent
DEFAULT_OUT_DIR = REPO / "public" / "audio-backup"  # the backup set; public/audio is the cloud voice
DEFAULT_MODEL_DIR = Path(os.environ.get("INDIC_TTS_MODEL_DIR") or "~/.cache/indic-tts/mr").expanduser()

PROVIDER = "ai4bharat-indic-tts"
CREDIT = (
    "Voice: AI4Bharat Indic-TTS (FastPitch + HiFi-GAN, Marathi), "
    "trained on the IIT Madras SMT Lab Indic TTS speech corpus. "
    "Code and models: https://github.com/AI4Bharat/Indic-TTS (MIT License, Copyright (c) 2023 AI4Bhārat)."
)

MP3_BITRATE = "48k"
PAD_S = 0.05            # silence kept before and after the speech
FADE_S = 0.005          # click guard on the outer edges
TRIM_DB = -42.0         # frames this far below the loudest frame count as silence
LEVEL_DBFS = -19.0      # target RMS of the voiced frames
CEILING_DBFS = -1.5     # peak limit (MP3 encoding can overshoot a little)
FRAME_S = 0.010

# QA thresholds (see qa_flags). Speech length in this voice is close to
# 0.08 s + 0.09 s per input character (measured over the whole course: every
# clip lands between 0.5x and 1.6x of that), so 2.2x plus slack is a clip that
# went wrong, not a slow word.
MIN_SPEECH_S = 0.15
MIN_RAW_PEAK = 0.02     # raw synth output; healthy clips peak at 0.038 or more
EXPECT_BASE_S = 0.08
EXPECT_PER_CHAR_S = 0.09
LONG_FACTOR = 2.2
LONG_SLACK_S = 0.3

# ---------- text preparation ----------

# Marathi number words 0-100 (the same table the Indic-TTS repo's own text
# normaliser uses, from the indic-numtowords package).
NUM_WORDS = (
    "शून्य एक दोन तीन चार पाच सहा सात आठ नऊ दहा "
    "अकरा बारा तेरा चौदा पंधरा सोळा सतरा अठरा एकोणीस वीस "
    "एकवीस बावीस तेवीस चोवीस पंचवीस सव्वीस सत्तावीस अठ्ठावीस एकोणतीस तीस "
    "एकतीस बत्तीस तेहेतीस चौतीस पस्तीस छत्तीस सदतीस अडतीस एकोणचाळीस चाळीस "
    "एक्केचाळीस बेचाळीस त्रेचाळीस चव्वेचाळीस पंचेचाळीस सेहेचाळीस सत्तेचाळीस अठ्ठेचाळीस एकोणपन्नास पन्नास "
    "एक्कावन्न बावन्न त्रेपन्न चौपन्न पंचावन्न छप्पन्न सत्तावन्न अठ्ठावन्न एकोणसाठ साठ "
    "एकसष्ट बासष्ट त्रेसष्ट चौसष्ट पासष्ट सहासष्ट सदुसष्ट अडुसष्ट एकोणसत्तर सत्तर "
    "एकाहत्तर बाहत्तर त्र्याहत्तर चौऱ्याहत्तर पंचाहत्तर शाहत्तर सत्त्याहत्तर अठ्ठ्याहत्तर एकोणऐंशी ऐंशी "
    "एक्याऐंशी ब्याऐंशी त्र्याऐंशी चौऱ्याऐंशी पंचाऐंशी शहाऐंशी सत्त्याऐंशी अठ्ठ्याऐंशी एकोणनव्वद नव्वद "
    "एक्याण्णव ब्याण्णव त्र्याण्णव चौऱ्याण्णव पंचाण्णव शहाण्णव सत्त्याण्णव अठ्ठ्याण्णव नव्याण्णव शंभर"
).split()
assert len(NUM_WORDS) == 101

DIGIT_RE = re.compile(r"[०-९0-9]+")
DIGIT_TO_ASCII = {ord(c): str(i) for i, c in enumerate("०१२३४५६७८९")}


def number_words(digits: str) -> str:
    ascii_digits = digits.translate(DIGIT_TO_ASCII)
    n = int(ascii_digits)
    if n <= 100 and not (len(ascii_digits) > 1 and ascii_digits[0] == "0"):
        return NUM_WORDS[n]
    return " ".join(NUM_WORDS[int(d)] for d in ascii_digits)  # long numbers and "007": digit by digit


def spell_numbers(text: str) -> str:
    def repl(m: re.Match) -> str:
        words = number_words(m.group())
        rest = text[m.end():].lstrip()
        # "१ एक": the word that follows already says it.
        if rest.startswith(words) and not re.match(r"[\u0900-\u097F]", rest[len(words):len(words) + 1] or " "):
            return ""
        return words

    return DIGIT_RE.sub(repl, text)


def vocabulary(config: dict) -> set[str]:
    chars = config.get("characters") or {}
    return set((chars.get("characters") or "") + (chars.get("punctuations") or ""))


def prepare(text: str, vocab: set[str] | None) -> tuple[str, set[str]]:
    """Text as the model should hear it, and the characters that were dropped."""
    out = spell_numbers(text)
    out = re.sub(r"\s*/\s*", ", ", out)
    dropped: set[str] = set()
    if vocab is not None:
        dropped = {c for c in out if c not in vocab and not c.isspace()}
        out = "".join(c for c in out if c in vocab or c.isspace())
    out = re.sub(r"\s+", " ", out).strip()
    return out, dropped


def vocabulary_gaps(texts, vocab: set[str]) -> dict[str, tuple[int, str]]:
    """Characters of the course text the model has no symbol for -> (count, what we do about it)."""
    gaps: dict[str, tuple[int, str]] = {}
    for text in texts:
        for c in text:
            if c.isspace() or c in vocab:
                continue
            n, _ = gaps.get(c, (0, ""))
            how = "spelled as a Marathi number word" if DIGIT_RE.fullmatch(c) else "removed"
            gaps[c] = (n + 1, how)
    return gaps


def padding_variants(tts_text: str) -> list[str]:
    """Inputs to try, best first. A single token crashes the model, so it
    always gets a final full stop (see the header). The other endings are only
    for clips that fail the checks as first rendered."""
    if tts_text.endswith(("?", "!")):
        return [tts_text]
    variants = [tts_text + "." if len(tts_text) < 2 else tts_text]
    base = tts_text.rstrip(".।,") or tts_text
    for alt in (base + ".", base + "।", base + " .", base + ","):
        if len(alt) >= 2 and alt not in variants:
            variants.append(alt)
    return variants


# ---------- audio ----------

def frame_rms(x: np.ndarray, sr: int) -> np.ndarray:
    n = max(1, int(sr * FRAME_S))
    m = len(x) // n
    if m == 0:
        return np.array([float(np.sqrt(np.mean(x ** 2))) if len(x) else 0.0])
    return np.sqrt(np.mean(x[: m * n].reshape(m, n) ** 2, axis=1))


def db(x: float) -> float:
    return 20.0 * np.log10(max(x, 1e-9))


def process(raw: np.ndarray, sr: int):
    """Trim, level and report. Returns (samples or None, stats)."""
    raw = np.asarray(raw, dtype=np.float32)
    stats = {"raw_s": len(raw) / sr, "raw_peak": float(np.abs(raw).max()) if len(raw) else 0.0}
    env = frame_rms(raw, sr)
    top = float(env.max()) if len(env) else 0.0
    stats["raw_rms_db"] = db(top)
    if top < 1e-4:
        return None, {**stats, "speech_s": 0.0, "out_s": 0.0}
    voiced = np.flatnonzero(env >= top * 10 ** (TRIM_DB / 20))
    hop = max(1, int(sr * FRAME_S))
    pad = int(PAD_S * sr)
    first, last = int(voiced[0]) * hop, (int(voiced[-1]) + 1) * hop
    speech_s = (last - first) / sr
    # Speech plus 50 ms either side; where the model output starts or ends
    # abruptly there is less than that to keep, so add true silence instead.
    x = np.concatenate([
        np.zeros(max(0, pad - first), dtype=np.float32),
        raw[max(0, first - pad):min(len(raw), last + pad)],
        np.zeros(max(0, last + pad - len(raw)), dtype=np.float32),
    ])

    # Level on the voiced frames only (so pauses inside a phrase don't count).
    env2 = frame_rms(x, sr)
    gate = env2 >= env2.max() * 10 ** (-25 / 20)
    n = max(1, int(sr * FRAME_S))
    frames = x[: len(env2) * n].reshape(len(env2), n)[gate] if len(x) >= n else x[None, :]
    rms = float(np.sqrt(np.mean(frames ** 2)))
    gain = 10 ** (LEVEL_DBFS / 20) / max(rms, 1e-9)
    gain = min(gain, 10 ** (CEILING_DBFS / 20) / max(float(np.abs(x).max()), 1e-9))
    x *= gain

    fade = min(int(FADE_S * sr), len(x) // 2)
    if fade:
        ramp = np.linspace(0.0, 1.0, fade, dtype=np.float32)
        x[:fade] *= ramp
        x[-fade:] *= ramp[::-1]
    stats.update(speech_s=speech_s, out_s=len(x) / sr, gain_db=db(gain), out_peak=float(np.abs(x).max()))
    return x, stats


def encode_mp3(samples: np.ndarray, sr: int, path: Path) -> None:
    tmp = path.with_name(path.name + ".tmp")
    cmd = [
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
        "-f", "f32le", "-ar", str(sr), "-ac", "1", "-i", "pipe:0",
        "-codec:a", "libmp3lame", "-b:a", MP3_BITRATE, "-ar", str(sr), "-ac", "1",
        "-f", "mp3", str(tmp),
    ]
    proc = subprocess.run(cmd, input=samples.astype("<f4").tobytes(), capture_output=True)
    if proc.returncode != 0:
        tmp.unlink(missing_ok=True)
        raise RuntimeError(f"ffmpeg failed: {proc.stderr.decode('utf8', 'replace').strip()}")
    os.replace(tmp, path)


def check_encoder() -> None:
    """Exit unless ffmpeg can write MP3 here (it needs libmp3lame)."""
    if not shutil.which("ffmpeg"):
        sys.exit("✗ ffmpeg not found. Install it (with libmp3lame); see the header of this file.")
    with tempfile.TemporaryDirectory() as tmp:
        try:
            encode_mp3(np.zeros(2205, dtype=np.float32), 22050, Path(tmp) / "test.mp3")
        except RuntimeError as err:
            sys.exit(f"✗ ffmpeg cannot encode MP3 (it needs libmp3lame): {err}")


def qa_flags(tts_text: str, stats: dict, rate: float | None = None) -> list[str]:
    flags = []
    pace = 1.0 / (rate or 1.0)
    if stats["out_s"] == 0.0 or stats["raw_peak"] < MIN_RAW_PEAK:
        flags.append(f"near-silent (raw peak {stats['raw_peak']:.3f})")
    if stats["speech_s"] < MIN_SPEECH_S * pace:
        flags.append(f"too short ({stats['speech_s']:.2f} s of speech)")
    expected = (EXPECT_BASE_S + EXPECT_PER_CHAR_S * len(tts_text)) * pace
    if stats["speech_s"] > LONG_FACTOR * expected + LONG_SLACK_S:
        flags.append(f"too long ({stats['speech_s']:.2f} s for {len(tts_text)} characters, expected about {expected:.2f})")
    return flags


# ---------- model ----------

def load_synthesizer(model_dir: Path, rate: float | None = None):
    """Load the FastPitch + HiFi-GAN pair once. Returns (synthesizer, vocab, sample rate)."""
    for need in ("fastpitch/best_model.pth", "fastpitch/config.json", "fastpitch/speakers.pth",
                 "hifigan/best_model.pth", "hifigan/config.json"):
        if not (model_dir / need).is_file():
            sys.exit(f"✗ {model_dir / need} not found. Unzip mr.zip there, or pass --model-dir (see the header of this file).")
    try:
        import torch
        from TTS.utils.synthesizer import Synthesizer
    except ImportError as err:
        sys.exit(f"✗ Cannot import the Coqui TTS package ({err}). Use the Python 3.10 environment from the header of this file.")

    config = json.loads((model_dir / "fastpitch" / "config.json").read_text(encoding="utf8"))
    # The checkpoint's config names its speakers file by a path relative to the
    # author's training directory. Point it at the real one in a temporary copy
    # of the config, so the downloaded files stay untouched.
    speakers = str(model_dir / "fastpitch" / "speakers.pth")
    config["speakers_file"] = speakers
    if isinstance(config.get("model_args"), dict):
        config["model_args"]["speakers_file"] = speakers
    with tempfile.TemporaryDirectory() as tmp:
        patched = Path(tmp) / "config.json"
        patched.write_text(json.dumps(config), encoding="utf8")
        with contextlib.redirect_stdout(io.StringIO()):
            synth = Synthesizer(
                tts_checkpoint=str(model_dir / "fastpitch" / "best_model.pth"),
                tts_config_path=str(patched),
                tts_speakers_file=speakers,
                tts_languages_file=None,
                vocoder_checkpoint=str(model_dir / "hifigan" / "best_model.pth"),
                vocoder_config=str(model_dir / "hifigan" / "config.json"),
                encoder_checkpoint="",
                encoder_config="",
                use_cuda=False,
            )
    torch.set_grad_enabled(False)
    if rate:
        synth.tts_model.length_scale = 1.0 / rate  # FastPitch stretches its predicted durations
    return synth, vocabulary(config), int(synth.output_sample_rate)


def synthesize(synth, text: str, speaker: str) -> np.ndarray:
    # Coqui prints a few progress lines per call; keep the console readable.
    with contextlib.redirect_stdout(io.StringIO()):
        try:
            wav = synth.tts(text, speaker_name=speaker, style_wav="")
        except Exception:
            # Sentence splitting can leave a one-token piece; try the text whole.
            wav = synth.tts(text, speaker_name=speaker, style_wav="", split_sentences=False)
    return np.asarray(wav, dtype=np.float32)


# ---------- files ----------

def read_clip_list() -> list[dict]:
    node = shutil.which("node")
    if not node:
        sys.exit("✗ Node.js is needed for the clip list (node scripts/generate-audio.mjs --list).")
    proc = subprocess.run([node, str(REPO / "scripts" / "generate-audio.mjs"), "--list"], capture_output=True, text=True, encoding="utf-8", cwd=REPO)
    if proc.returncode != 0:
        sys.exit(f"✗ clip list failed:\n{proc.stderr.strip()}")
    clips = json.loads(proc.stdout)
    if not clips:
        sys.exit("✗ the course has no spoken text")
    return clips


def read_manifest(out_dir: Path):
    try:
        return json.loads((out_dir / "manifest.json").read_text(encoding="utf8"))
    except (OSError, ValueError):
        return None


def write_manifest(out_dir: Path, voice: str, rate: float | None, keys) -> None:
    body = {"voice": voice, "provider": PROVIDER, "rate": rate, "keys": sorted(keys), "credit": CREDIT}
    path = out_dir / "manifest.json"
    tmp = path.with_name(path.name + ".tmp")
    tmp.write_text(json.dumps(body, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf8")
    os.replace(tmp, path)


def human(n: int) -> str:
    return f"{n / 1024:.0f} KB" if n < 1024 * 1024 else f"{n / 1024 / 1024:.1f} MB"


# ---------- main ----------

def main() -> int:
    ap = argparse.ArgumentParser(description="Generate Marathi speech clips locally with AI4Bharat Indic-TTS.")
    ap.add_argument("--speaker", choices=("female", "male"), default="female", help="Marathi speaker (default: female)")
    ap.add_argument("--model-dir", type=Path, default=DEFAULT_MODEL_DIR, help=f"unzipped mr.zip (default: {DEFAULT_MODEL_DIR})")
    ap.add_argument("--out-dir", type=Path, default=DEFAULT_OUT_DIR, help="where to write clips and manifest.json (default: public/audio-backup)")
    ap.add_argument("--rate", type=float, default=None, help="speaking rate, e.g. 0.9 for 10%% slower (default: the voice's natural pace); changing it regenerates all")
    ap.add_argument("--force", action="store_true", help="regenerate every clip")
    ap.add_argument("--dry-run", action="store_true", help="show what would be done; load no model, write nothing")
    args = ap.parse_args()

    if args.rate is not None and not 0.5 <= args.rate <= 1.5:
        ap.error("--rate must be between 0.5 and 1.5")
    voice = f"mr-{args.speaker}"
    out_dir = args.out_dir.resolve()
    clips = read_clip_list()
    keys = [c["key"] for c in clips]
    text_of = {c["key"]: c["text"] for c in clips}

    prev = read_manifest(out_dir)
    on_disk = {p.stem for p in out_dir.glob("*.mp3")} if out_dir.is_dir() else set()
    reuse = (
        not args.force
        and prev is not None
        and prev.get("provider") == PROVIDER
        and prev.get("voice") == voice
        and prev.get("rate") == args.rate
    )
    cached = [k for k in keys if reuse and k in on_disk]
    todo = [k for k in keys if k not in set(cached)]
    stale = {k for k in on_disk if k not in text_of or not reuse}

    print(f"{PROVIDER} · {voice} · {'default pace' if args.rate is None else f'rate {args.rate}'}")
    print(f"{len(keys)} unique clips · already on disk: {len(cached)} · to generate: {len(todo)}")
    if prev and not reuse and on_disk:
        print(f"existing audio is from {prev.get('provider')} / {prev.get('voice')} — all of it will be regenerated")
    if args.dry_run:
        if stale:
            print(f"would remove {len(stale)} stale clip(s)")
        return 0

    # Check the encoder and load the model before touching any file, so a
    # broken setup cannot cost the clips that are already there.
    if todo:
        check_encoder()
        t0 = time.time()
        synth, vocab, sr = load_synthesizer(args.model_dir, args.rate)
        print(f"model loaded in {time.time() - t0:.0f} s · {sr} Hz → MP3 {MP3_BITRATE} mono")
        gaps = vocabulary_gaps(text_of.values(), vocab)
        if gaps:
            print("characters in the course text that the model has no symbol for:")
            for c, (n, how) in sorted(gaps.items()):
                print(f"  {c!r} U+{ord(c):04X} ×{n} → {how}")
        spelled = sum(1 for t in text_of.values() if DIGIT_RE.search(t))
        if spelled:
            print(f"{spelled} text(s) contain digits; all digits are read as Marathi number words")
    if stale:
        print(f"removing {len(stale)} stale clip(s)")
    out_dir.mkdir(parents=True, exist_ok=True)
    for p in out_dir.iterdir():
        if (p.suffix == ".mp3" and p.stem in stale) or p.suffix == ".tmp":
            p.unlink()
    # Record the settings first, so an interrupted run can tell what is reusable.
    write_manifest(out_dir, voice, args.rate, cached)
    if not todo:
        print("✓ audio is up to date")
        return 0

    flagged: list[tuple[str, str, list[str]]] = []
    retried: list[str] = []
    done = set(cached)
    t1 = time.time()
    try:
        for i, key in enumerate(todo, 1):
            text = text_of[key]
            tts_text, _ = prepare(text, vocab)
            if not tts_text:
                flagged.append((key, text, ["nothing left to say after preparation"]))
                continue

            best = None  # (n_flags, -speech_s, samples, stats, flags)
            for variant in padding_variants(tts_text):
                try:
                    samples, stats = process(synthesize(synth, variant, args.speaker), sr)
                except Exception as err:  # a variant the model cannot take
                    print(f"  ! {variant!r}: {err}", file=sys.stderr)
                    continue
                flags = qa_flags(variant, stats, args.rate)
                cand = (len(flags), -stats["speech_s"], samples, stats, flags)
                if best is None or cand[:2] < best[:2]:
                    best, best_variant = cand, variant
                if not flags:
                    break
            if best is None or best[2] is None:
                flagged.append((key, text, ["could not be synthesized"]))
                continue
            _, _, samples, stats, flags = best
            if best_variant != padding_variants(tts_text)[0]:
                retried.append(text)
            encode_mp3(samples, sr, out_dir / f"{key}.mp3")
            done.add(key)
            if flags:
                flagged.append((key, text, flags))
            if i % 50 == 0 or i == len(todo):
                print(f"  {i}/{len(todo)}  ({time.time() - t1:.0f} s)")
    finally:
        # Even if interrupted, the manifest lists exactly the clips on disk.
        write_manifest(out_dir, voice, args.rate, done)

    secs = time.time() - t1
    size = sum(p.stat().st_size for p in out_dir.glob("*.mp3"))
    print(f"{len(done) - len(cached)} generated in {secs:.0f} s · {len(done)}/{len(keys)} clips available · {human(size)}")
    if retried:
        print(f"{len(retried)} clip(s) failed the checks as first rendered and were re-rendered with another final mark: {' '.join(retried)}")
    if flagged:
        print(f"⚠ {len(flagged)} clip(s) to check by ear:")
        for key, text, flags in flagged:
            print(f"  {key}  {text!r}: {'; '.join(flags)}")
    if len(done) < len(keys):
        print(f"✗ {len(keys) - len(done)} clip(s) missing from {out_dir.name}/ — they have no clip in this set")
        return 1
    print("✓ audio is up to date" + (" (with the warnings above)" if flagged else ""))
    return 0


if __name__ == "__main__":
    sys.exit(main())
