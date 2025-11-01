# File: whisper_api/app.py
import os
import tempfile
import uuid
import traceback
import subprocess
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from faster_whisper import WhisperModel
import os, subprocess, uuid, pathlib
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://host.docker.internal:11434")


PIPER_BIN   = os.getenv("PIPER_BIN", "/usr/local/bin/piper")
PIPER_MODEL = os.getenv("PIPER_MODEL", "/models/en_US-amy-medium.onnx")
ESPEAK_DATA = os.getenv("ESPEAK_DATA", "/usr/share/espeak-ng-data")

# ------------------------------------------------------------------
# Prevent duplicate OpenMP runtime warnings on Windows
os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"

# ------------------------------------------------------------------
# Flask setup
app = Flask(__name__, static_folder="static")
CORS(app)

# Ensure static folders exist
os.makedirs(os.path.join(app.static_folder, "tts"), exist_ok=True)

# ------------------------------------------------------------------
# Whisper model (Speech → Text)
print("Loading Whisper model...")
model = WhisperModel("small", device="cpu", compute_type="int8")
print("Whisper model loaded!")

@app.post("/transcribe")
def transcribe_audio():
    """Receive an audio file and return its transcription text."""
    if "file" not in request.files:
        return jsonify({"error": "No audio file provided"}), 400

    audio = request.files["file"]
    fd, tmp_path = tempfile.mkstemp(suffix=".m4a")
    os.close(fd)
    try:
        audio.save(tmp_path)
        segments, _ = model.transcribe(tmp_path)
        text = " ".join(seg.text for seg in segments)
        return jsonify({"text": text})
    except Exception as e:
        print("TRANSCRIBE ERROR:", e)
        traceback.print_exc()
        return jsonify({"error": "transcription_failed", "detail": str(e)}), 500
    finally:
        try:
            os.remove(tmp_path)
        except Exception:
            pass

# ------------------------------------------------------------------
# Piper model (Text → Speech)
PIPER_EXE  = r"C:\Tools\Piper\piper.exe"
VOICE_PATH = r"C:\Tools\Piper\en_US-amy-medium.onnx"
ESPEAK_DIR = r"C:\Tools\Piper\espeak-ng-data"  # optional, if exists

@app.route("/tts", methods=["POST"])
def tts():
    import os, subprocess, uuid, pathlib, shutil
    from flask import request, jsonify

    text = (request.get_json() or {}).get("text", "").strip()
    if not text:
        return jsonify({"error": "no text"}), 400

    PIPER_BIN   = os.getenv("PIPER_BIN", "/usr/local/bin/piper")
    PIPER_MODEL = os.getenv("PIPER_MODEL", "/models/en_US-amy-medium.onnx")
    ESPEAK_DATA = os.getenv("ESPEAK_DATA", "/usr/share/espeak-ng-data")

    # --- sanity checks (fail fast with clear messages) ---
    if not os.path.isfile(PIPER_BIN):
        return jsonify({"error": "piper binary not found", "path": PIPER_BIN}), 500
    if not os.access(PIPER_BIN, os.X_OK):
        try:
            os.chmod(PIPER_BIN, 0o755)
        except Exception as e:
            return jsonify({"error": "piper not executable", "detail": str(e)}), 500
    if not os.path.isfile(PIPER_MODEL):
        return jsonify({"error": "piper model not found", "path": PIPER_MODEL}), 500
    if not os.path.isdir(ESPEAK_DATA):
        return jsonify({"error": "espeak data not found", "path": ESPEAK_DATA}), 500

    # output dir inside the app
    out_dir = pathlib.Path(app.root_path) / "static" / "tts"
    out_dir.mkdir(parents=True, exist_ok=True)

    fname = f"{uuid.uuid4().hex}.wav"
    out_path = str(out_dir / fname)

    # run Piper with stdin
    cmd = [PIPER_BIN, "-m", PIPER_MODEL, "-f", out_path, "--espeak-data", ESPEAK_DATA]
    try:
        proc = subprocess.Popen(
            cmd, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE
        )
        stdout, stderr = proc.communicate(text.encode("utf-8"))
        if proc.returncode != 0 or not os.path.exists(out_path):
            # surface Piper error text to logs and response
            err = (stderr or b"").decode("utf-8", errors="ignore")
            print("PIPER_CMD:", " ".join(cmd))
            print("PIPER_STDERR:", err[:1000])
            return jsonify({"error": "piper failed", "detail": err[:500]}), 500
    except Exception as e:
        return jsonify({"error": "tts exception", "detail": str(e)}), 500

    return jsonify({"url": f"static/tts/{fname}"})


import requests
import json

@app.post("/chat")
def chat():
    """
    Use a local LLM (Ollama) to generate an empathetic, context-aware coaching reply.
    """
    try:
        data = request.get_json(force=True)
        user_text = (data.get("user_text") or "").strip()
        conversation = (data.get("conversation") or "").strip()
        feeling = (data.get("feeling") or "").strip()
        focus = data.get("focus")

        # normalize focus to a list
        focus_list = []
        if isinstance(focus, list):
            focus_list = focus
        elif isinstance(focus, str):
            try:
                focus_list = json.loads(focus)
                if not isinstance(focus_list, list):
                    focus_list = []
            except Exception:
                focus_list = []

        # Build a compact context string
        context_bits = []
        if conversation:
            context_bits.append(f"Meeting type: {conversation}")
        if feeling:
            context_bits.append(f"User feeling: {feeling}")
        if focus_list:
            context_bits.append("Focus points: " + "; ".join(focus_list))
        context_str = "\n".join(context_bits)

        system_prompt = (
            "You are an empathetic, practical career coach. "
            "Goal: help the user prepare for a manager conversation (appraisals, promotion, feedback, conflict, etc.). "
            "Reply concisely in 4–7 short bullet points max. "
            "Start with one validating line, then actionable steps tailored to the user's input. "
            "Avoid therapy/medical/legal advice; focus on workplace communication, de-escalation, and structure. "
            "If conflict or misbehavior is involved, emphasize safety, accountability, and professional next steps. "
            "Keep tone calm, non-judgmental, solution-oriented."
        )

        user_prompt = f"""Context:\n{context_str or '(none)'}\n\nUser said:\n{user_text}\n\nGive a concise, tailored coaching response."""

        # Call Ollama locally
        ollama_url = f"{OLLAMA_URL}/api/chat"
        payload = {
            "model": "qwen2:0.5b",
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "stream": False,
            "options": {
                "temperature": 0.6,
                "num_predict": 300
            }
        }

        r = requests.post(ollama_url, json=payload, timeout=300)
        if r.status_code != 200:
            return jsonify({"error": "ollama_failed", "detail": r.text[:500]}), 500

        data = r.json()
        # Ollama chat response shape: { "message": {"content": "..."} , ... }
        reply = (data.get("message") or {}).get("content", "").strip()
        if not reply:
            reply = "I couldn’t generate a response. Try rephrasing your question."

        return jsonify({"reply": reply})

    except Exception as e:
        print("CHAT ERROR:", e)
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

# --- Conversation Analysis via Ollama (JSON mode) -------------------
import requests, json, re

@app.post("/analyze")
def analyze():
    try:
        data = request.get_json(force=True)

        convo_type = (data.get("conversation") or "").strip()
        feeling    = (data.get("feeling") or "").strip()
        focus      = data.get("focus")
        turns      = data.get("turns") or []

        # normalize focus -> list[str]
        focus_list = []
        if isinstance(focus, list):
            focus_list = focus
        elif isinstance(focus, str):
            try:
                focus_list = json.loads(focus)
                if not isinstance(focus_list, list):
                    focus_list = []
            except Exception:
                focus_list = []

        # compact turns
        convo_lines = []
        for t in turns[:200]:
            role = (t.get("role") or "").lower()
            text = (t.get("text") or "").strip().replace("\n", " ")
            if not text:
                continue
            if role not in ("user", "assistant"):
                role = "user"
            convo_lines.append(f"{role}> {text}")

        context = []
        if convo_type: context.append(f"Meeting type: {convo_type}")
        if feeling:    context.append(f"User feeling: {feeling}")
        if focus_list: context.append("Focus points: " + "; ".join(focus_list))

        system_prompt = (
            "You are an expert communication coach. Analyze the conversation and return STRICT JSON only.\n"
            "Use 0-10 integer scores. Keep bullets short (≤12 words). No text outside JSON.\n"
            "JSON schema:\n"
            "{\n"
            '  "scores": {"clarity":int,"assertiveness":int,"empathy":int,"structure":int},\n'
            '  "summary": "one-sentence overview",\n'
            '  "highlights": [ "bullet", ... ],\n'
            '  "improvements": [ "bullet", ... ],\n'
            '  "next_steps": [ "bullet", ... ],\n'
            '  "rationale": "120-180 words",\n'
            '  "what_went_well_desc": "2-4 sentences",\n'
            '  "what_to_improve_desc": "2-4 sentences",\n'
            '  "next_steps_desc": "2-4 sentences"\n'
            "}\n"
        )

        user_prompt = (
            "Context:\n" + ("\n".join(context) if context else "(none)") +
            "\n\nConversation turns (chronological, compact):\n" +
            ("\n".join(convo_lines) if convo_lines else "(no turns)") +
            "\n\nReturn STRICT JSON only (no backticks, no prose)."
        )

        payload = {
            "model": "qwen2:0.5b",
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user",   "content": user_prompt}
            ],
            "stream": False,
            # 👇 Force JSON output
            "format": "json",
            "options": {
                "temperature": 0.2,
                "num_predict": 400,
            }
        }

        r = requests.post(f"{OLLAMA_URL}/api/chat", json=payload, timeout=300)
        if r.status_code != 200:
            return jsonify({"error": "ollama_failed", "detail": r.text[:500]}), 500

        resp = r.json()
        raw = (resp.get("message") or {}).get("content", "").strip()

        # Try parse; if model added anything odd, extract the first JSON object
        def _parse_json(s: str):
            try:
                return json.loads(s)
            except Exception:
                m = re.search(r"\{.*\}", s, flags=re.S)
                if m:
                    try:
                        return json.loads(m.group(0))
                    except Exception:
                        return None
                return None

        report = _parse_json(raw) or {}

        # guardrails + defaults
        report.setdefault("scores", {})
        for k in ("clarity","assertiveness","empathy","structure"):
            try:
                report["scores"][k] = int(report["scores"].get(k, 5))
            except Exception:
                report["scores"][k] = 5

        report.setdefault("summary", "Analysis unavailable. Please try again.")
        report.setdefault("highlights", [])
        report.setdefault("improvements", [])
        report.setdefault("next_steps", [])
        report.setdefault("rationale", "")
        report.setdefault("what_went_well_desc", "")
        report.setdefault("what_to_improve_desc", "")
        report.setdefault("next_steps_desc", "")

        return jsonify(report)

    except Exception as e:
        print("ANALYZE ERROR:", e)
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


# ------------------------------------------------------------------
# Health check and static serving
@app.get("/ping")
def ping():
    return {"ok": True}

@app.route("/static/tts/<path:filename>")
def serve_tts(filename):
    return send_from_directory(os.path.join(app.static_folder, "tts"), filename)

# ------------------------------------------------------------------
if __name__ == "__main__":
    print("Server running at http://0.0.0.0:5001")
    app.run(host="0.0.0.0", port=5001, threaded=True)
