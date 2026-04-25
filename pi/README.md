# Punchi — Edge Agent

Python agent that runs on a Raspberry Pi Zero 2 W with a ReSpeaker 2-Mics Pi
HAT. Listens for the "Hey Punchi" wakeword, records the follow-on utterance with
RMS-based VAD, and POSTs the WAV to the orchestrator. A WebSocket connection
receives LED-state and TTS-playback commands.

## Hardware

- Raspberry Pi Zero 2 W (Raspberry Pi OS Bookworm)
- ReSpeaker 2-Mics Pi HAT (3× APA102 LEDs, dual mics, 3.5 mm I2S audio out)
- Speaker on the 3.5 mm jack

The HAT's `seeed-voicecard` driver must be installed and active before
running. See https://github.com/respeaker/seeed-voicecard.

## Setup

### 1. Install system packages (apt — outside the venv)

```bash
sudo apt update
sudo apt install -y portaudio19-dev mpg123 libatlas-base-dev
```

> **Why apt and not pip?**  These three are not Python packages — a venv only
> isolates Python imports, not system binaries or C libraries.
>
> - `portaudio19-dev` — C headers + shared library that the `pyaudio` wheel
>   links against when pip compiles it. Without this, `pip install pyaudio`
>   fails with `portaudio.h: No such file or directory`.
> - `mpg123` — standalone CLI binary. `main.py` calls it via `subprocess` to
>   play MP3s through the I2S DAC. It needs to be on `$PATH`, which means
>   installed system-wide.
> - `libatlas-base-dev` — BLAS/LAPACK shared libraries that NumPy (a transitive
>   dep of `pvporcupine`) loads at runtime on ARM. Same story: shared `.so`
>   files in `/usr/lib`, not Python.
>
> A venv could only "contain" these if you bundled the entire system into it,
> which defeats the point. The standard pattern is **system libs via apt,
> Python libs via pip-in-venv**.

### 2. Create a virtualenv and install Python deps

```bash
cd pi
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

### 3. Configure environment

```bash
cp .env.example .env
# then edit .env:
#   PORCUPINE_ACCESS_KEY   — get one at https://console.picovoice.ai
#   PORCUPINE_KEYWORD_PATH — path to your "Hey Punchi" .ppn (or leave blank
#                            and rely on PORCUPINE_BUILTIN_KEYWORD=computer)
#   ORCHESTRATOR_URL       — http://<vultr-ip>:3000 in prod
#   WS_URL                 — ws://<vultr-ip>:3000/edge in prod
#   AUTH0_DEVICE_TOKEN     — paste the token from the device-pairing flow
#   PUNCHI_USER_ID         — temporary, until the orchestrator validates the bearer
```

`pi/.env` is gitignored at the repo root.

### 4. Run

```bash
source .venv/bin/activate
python main.py
```

You should see:

```
[hardware] (or LED log lines if the APA102 driver isn't loaded)
[ws] connected
[main] listening for wakeword (rate=16000, frame=512)
```

Say the wakeword. LEDs go cyan while recording, white-spinning while
uploading, green on success / red on failure, then back to blue idle.

## Configuration knobs (`.env`)

| Variable                  | Default                         | Notes |
|---------------------------|---------------------------------|-------|
| `ORCHESTRATOR_URL`        | `http://localhost:3000`         | Phase 2 backend root |
| `WS_URL`                  | `ws://localhost:3000/edge`      | TODO: orchestrator WS server is not yet implemented |
| `AUTH0_DEVICE_TOKEN`      | `MOCK_TOKEN_FOR_NOW`            | TODO: replace with real device-grant token |
| `PUNCHI_USER_ID`          | empty                           | Temp header until bearer validation lands |
| `PORCUPINE_ACCESS_KEY`    | empty                           | **Required** — agent refuses to start without it |
| `PORCUPINE_KEYWORD_PATH`  | empty                           | Path to "Hey Punchi" `.ppn`; falls back to built-in if blank |
| `PORCUPINE_BUILTIN_KEYWORD` | `computer`                    | Dev fallback keyword |
| `SILENCE_RMS_THRESHOLD`   | `500`                           | Below this RMS = silence |
| `SILENCE_TAIL_SECONDS`    | `2.5`                           | Required quiet duration to end recording |
| `MAX_RECORDING_SECONDS`   | `60`                            | Hard failsafe |

### Tuning VAD

If the recording cuts off mid-sentence: lower `SILENCE_RMS_THRESHOLD` (e.g.
to 250) or raise `SILENCE_TAIL_SECONDS` (e.g. to 3.5).

If the recording keeps going past the speaker stopping: raise the threshold
(e.g. to 800) or shorten the tail (e.g. to 1.5).

A quick way to find the right threshold is to drop a `print(rms)` inside
`record_with_vad()` and watch values during a test recording.

## Auto-start on boot (optional)

Create `/etc/systemd/system/punchi-edge.service`:

```ini
[Unit]
Description=Punchi Edge Agent
After=network-online.target sound.target
Wants=network-online.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/punchi/pi
EnvironmentFile=/home/pi/punchi/pi/.env
ExecStart=/home/pi/punchi/pi/.venv/bin/python /home/pi/punchi/pi/main.py
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now punchi-edge.service
journalctl -u punchi-edge.service -f   # tail logs
```

## Troubleshooting

| Symptom | Likely cause |
|---------|--------------|
| `portaudio.h: No such file or directory` during pip install | Skipped the apt step — install `portaudio19-dev` first |
| `OSError: [Errno -9996] Invalid input device` | Wrong card index; run `arecord -l` and verify the seeed-voicecard is the default. Set `default` in `/etc/asound.conf` if needed. |
| `mpg123: command not found` when `play_summary` fires | Skipped the apt step — install `mpg123` |
| Wakeword never fires | Bad `PORCUPINE_ACCESS_KEY`, or the `.ppn` was trained for a different SDK version |
| LEDs log `[led] solid cyan` instead of lighting up | `apa102_pi` failed to import or SPI isn't enabled. `sudo raspi-config` → Interface → SPI → enable, then reboot |
| `[upload] failed 400: transcript field required` | Expected for now — orchestrator-side STT is a TODO (see `main.py` upload site) |
