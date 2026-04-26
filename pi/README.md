# Punchi — Edge Agent

Python voice agent running on a Raspberry Pi 4B. Listens continuously for a
wakeword, journals spoken fragments throughout the day, and can read back a
synthesized narrative on demand.

## Hardware

| Component | Role |
|-----------|------|
| Raspberry Pi 4 Model B | Runs the agent |
| Jabra Speak2 75 (USB) | Microphone input + speaker output |
| Grove LED (GPIO 12, 5V) | Visual state indicator |

## File Structure

```
pi/
  main.py               # Entry point — state machine
  requirements.txt      # Python dependencies
  .env.example          # Environment variable template
  utils/
    jabra.py            # Jabra device detection, recording, playback
    led.py              # Grove LED controller (GPIO 12)
  scripts/
    check_rms.py        # Dev: verify mic + STT are working
    test_pipeline.py    # Dev: end-to-end pipeline smoke test
```

## Setup

### 1. System packages (apt — outside the venv)

```bash
sudo apt update
sudo apt install -y portaudio19-dev mpg123 libatlas-base-dev
```

> `portaudio19-dev` — C headers required to compile `pyaudio`
> `mpg123` — CLI binary used to play MP3s on Linux/Pi
> `libatlas-base-dev` — BLAS/LAPACK libs required by NumPy on ARM

### 2. Python environment

```bash
cd pi
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

### 3. Environment variables

```bash
cp .env.example .env
# Edit .env — set ORCHESTRATOR_URL and PUNCHI_USER_ID at minimum
```

| Variable | Default | Notes |
|---|---|---|
| `ORCHESTRATOR_URL` | `http://localhost:3000` | URL of the Node.js orchestrator |
| `PUNCHI_USER_ID` | *(required)* | User ID sent as `x-user-id` header |
| `SILENCE_RMS_THRESHOLD` | `500` | Below this RMS = silence |
| `SILENCE_TAIL_SECONDS` | `2.5` | Quiet duration required to end recording |
| `MAX_RECORDING_SECONDS` | `60` | Hard cap on recording length |

### 4. Run

```bash
source .venv/bin/activate
python main.py
```

## Voice Commands

Punchi listens continuously. Only utterances that match a trigger are acted on.

| What you say | Effect |
|---|---|
| `"Punchy, [anything]"` | Stores a journal fragment for today |
| `"Punchy"` alone | Ignored — no content to store |
| `"Read my journal"` | Reads today's journal aloud, then waits for save/discard |
| `"Punchy read me my journal"` | Same as above |
| After hearing journal: `"Save"` / `"Yes"` / `"Publish"` | Saves journal to feed (IS_READY=TRUE) |
| After hearing journal: `"No"` / `"Cancel"` / `"Stop"` | Cancels — draft kept but not published |
| After hearing journal: *(30 s silence)* | Auto-saves |

## LED States

| Pattern | State | Meaning |
|---|---|---|
| Off | `idle` | Listening passively |
| Solid on | `listening` | Wakeword detected |
| Fast blink (4 Hz) | `thinking` | Waiting on server / Gemma |
| Medium blink (1 Hz) | `speaking` | Playing audio |
| Slow pulse (0.5 Hz) | `saving` | Journal published |
| Rapid blink (8 Hz) | `error` | Something failed |

## Dev Scripts

```bash
# Verify the Jabra mic + STT are working
python scripts/check_rms.py

# Full pipeline smoke test (set STUB_MODE=True to skip live recording)
python scripts/test_pipeline.py

# Jabra hardware info / record test / playback test
python utils/jabra.py info
python utils/jabra.py record
python utils/jabra.py play <file.mp3>
```

## Auto-start on Boot (optional)

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
journalctl -u punchi-edge.service -f
```

## Troubleshooting

| Symptom | Fix |
|---|---|
| `portaudio.h: No such file or directory` during pip install | `sudo apt install portaudio19-dev` |
| `OSError: [Errno -9996] Invalid input device` | Wrong device index; run `python utils/jabra.py info` to confirm |
| `mpg123: command not found` | `sudo apt install mpg123` |
| Jabra not found | Unplug and replug USB; check `aplay -l` lists a Jabra card |
| Agent stores bare "punchy" as a fragment | Upgrade to latest `main.py` — bare wakewords are now filtered |
