FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    KMP_DUPLICATE_LIB_OK=TRUE \
    PIPER_BIN=/usr/local/bin/piper \
    PIPER_MODEL=/models/en_US-amy-medium.onnx \
    ESPEAK_DATA=/usr/share/espeak-ng-data

RUN apt-get update && apt-get install -y \
    ffmpeg curl ca-certificates unzip wget espeak-ng-data \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN pip install --no-cache-dir \
    flask flask-cors gunicorn requests \
    faster-whisper numpy soundfile pydub

# --- Install Piper binary (Linux x86_64) ---
RUN wget -q https://github.com/rhasspy/piper/releases/latest/download/piper_linux_x86_64.tar.gz \
 && tar -xzf piper_linux_x86_64.tar.gz \
 && mv piper /usr/local/bin/piper \
 && chmod +x /usr/local/bin/piper \
 && rm -f piper_linux_x86_64.tar.gz

# Models will be mounted from Windows
RUN mkdir -p /models

# Backend code
COPY whisper_api/ /app/

EXPOSE 5001
CMD ["gunicorn", "-b", "0.0.0.0:5001", "app:app", "--workers", "1", "--threads", "4"]
