"""
Grove LED controller — GPIO 12.

States
------
idle       LED off          (not listening)
listening  solid on         (wakeword detected, processing)
thinking   fast blink 4 Hz  (waiting on server / Gemma)
speaking   medium blink 1 Hz (playing audio)
saving     slow pulse 0.5 Hz (journal published)
error      rapid blink 8 Hz  (something failed)

Falls back to print() on non-Pi platforms where RPi.GPIO is unavailable.
"""

from __future__ import annotations

try:
    import RPi.GPIO as GPIO
    GPIO.setmode(GPIO.BCM)
    GPIO.setup(12, GPIO.OUT)
    _GPIO_AVAILABLE = True
except Exception:
    _GPIO_AVAILABLE = False

_pwm: object = None


def _solid(on: bool) -> None:
    global _pwm
    if _pwm:
        try:
            _pwm.stop()
        except Exception:
            pass
        _pwm = None
    if not _GPIO_AVAILABLE:
        print(f"[led] {'ON' if on else 'OFF'}")
        return
    GPIO.output(12, GPIO.HIGH if on else GPIO.LOW)


def _blink(hz: float) -> None:
    global _pwm
    if not _GPIO_AVAILABLE:
        print(f"[led] BLINK {hz}Hz")
        return
    if _pwm:
        try:
            _pwm.stop()
        except Exception:
            pass
    p = GPIO.PWM(12, hz)
    p.start(50)
    _pwm = p


def set_state(state: str) -> None:
    """Set the LED to a named state (idle | listening | thinking | speaking | saving | error)."""
    if state == "idle":
        _solid(False)
    elif state == "listening":
        _solid(True)
    elif state == "thinking":
        _blink(4.0)
    elif state == "speaking":
        _blink(1.0)
    elif state == "saving":
        _blink(0.5)
    elif state == "error":
        _blink(8.0)


def cleanup() -> None:
    """Call on shutdown to release GPIO resources."""
    _solid(False)
    if _GPIO_AVAILABLE:
        GPIO.cleanup()
