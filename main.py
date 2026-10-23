"""
DhruvaTwin Backend — AI-Powered Prediction Edition + Two-Way Telegram
The Groq LLM is the primary reasoning engine for both Q&A and what-if predictions.
Antarctica → India outbound is via satellite uplink; India → Antarctica inbound is
via a Telegram poller that injects replies into the dashboard inbox automatically.
"""
from dotenv import load_dotenv
load_dotenv()
from fastapi import FastAPI, WebSocket, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from contextlib import asynccontextmanager
from openai import AsyncOpenAI
import requests as http_requests

import random
import random as rnd
import hashlib
import os
import ssl
import sys
import socket
import subprocess
import threading
import time
import json
import asyncio
import re
import math
from datetime import datetime
from collections import deque
import paho.mqtt.client as mqtt


# ═══════════════════════════════════════════════════════════
#  PORT CLEANUP
# ═══════════════════════════════════════════════════════════
def _free_port(port: int) -> None:
    if os.name != "nt":
        return
    try:
        ps = (
            f"Get-NetTCPConnection -LocalPort {port} -ErrorAction SilentlyContinue "
            f"| Select-Object -ExpandProperty OwningProcess -Unique "
            f"| ForEach-Object {{ taskkill /PID $_ /F }}"
        )
        subprocess.run(["powershell", "-NoProfile", "-Command", ps],
                       capture_output=True, timeout=10)
        time.sleep(1)
    except Exception:
        pass


def _port_busy(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(("127.0.0.1", port)) == 0


# ═══════════════════════════════════════════════════════════
#  CONFIG
# ═══════════════════════════════════════════════════════════
# ═══════════════════════════════════════════════════════════
#  CONFIG
# ═══════════════════════════════════════════════════════════
MQTT_HOST     = os.environ.get("MQTT_HOST", "localhost")
MQTT_PORT     = int(os.environ.get("MQTT_PORT", "1883"))
MQTT_USERNAME = os.environ.get("MQTT_USERNAME", "") or None
MQTT_PASSWORD = os.environ.get("MQTT_PASSWORD", "") or None
MQTT_TLS      = os.environ.get("MQTT_TLS", "false").lower() == "true"
MQTT_TOPIC    = os.environ.get("MQTT_TOPIC", "polar/station/+/sensor/#")

# 🔒 Safe: keys are now ONLY read from environment variables
GROQ_API_KEY  = os.environ.get("GROQ_API_KEY", "").strip()
GROQ_MODEL    = os.environ.get("GROQ_MODEL", "openai/gpt-oss-120b").strip()

ENABLE_SIMULATOR   = os.environ.get("ENABLE_SIMULATOR", "true").lower() == "true"
SIMULATOR_INTERVAL = float(os.environ.get("SIMULATOR_INTERVAL", "2.0"))

# ── Satellite uplink config ──
TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
TELEGRAM_CHAT_ID   = os.environ.get("TELEGRAM_CHAT_ID", "").strip()

SATELLITE_WINDOW_INTERVAL = int(os.environ.get("SATELLITE_WINDOW_INTERVAL", "60"))
SATELLITE_WINDOW_DURATION = int(os.environ.get("SATELLITE_WINDOW_DURATION", "10"))


# ═══════════════════════════════════════════════════════════
#  GLOBALS
# ═══════════════════════════════════════════════════════════
main_event_loop = None
live_readings = deque(maxlen=500)
sensor_websockets = []
mqtt_connected = False

satellite_state = {
    "link_up": True,
    "window_started": time.time(),
    "last_window": None,
    "total_transmitted": 0,
}

india_messages = {
    "outbound_queue": [],
    "sent": [],
    "inbox": [],
}

# Cursor for the Telegram poller — remembers the last processed update
telegram_last_update_id = 0


# ═══════════════════════════════════════════════════════════
#  SATELLITE HELPERS — defined BEFORE lifespan
# ═══════════════════════════════════════════════════════════
def _send_to_india(text: str) -> dict:
    """Transmit a message from Antarctica to India via Telegram."""
    if not TELEGRAM_BOT_TOKEN or not TELEGRAM_CHAT_ID:
        return {"ok": False, "reason": "telegram_not_configured"}
    try:
        url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
        r = http_requests.post(url, json={
            "chat_id": TELEGRAM_CHAT_ID,
            "text": text,
            "parse_mode": "Markdown",
        }, timeout=10)
        return {"ok": r.status_code == 200, "status": r.status_code}
    except Exception as e:
        return {"ok": False, "reason": f"{type(e).__name__}: {e}"}


def _is_satellite_window_open() -> bool:
    """Return True if we're inside an active satellite pass."""
    now = time.time()
    elapsed = (now - satellite_state["window_started"]) % SATELLITE_WINDOW_INTERVAL
    return elapsed < SATELLITE_WINDOW_DURATION


def _seconds_until_next_window() -> int:
    """Countdown to the next satellite window."""
    now = time.time()
    elapsed = (now - satellite_state["window_started"]) % SATELLITE_WINDOW_INTERVAL
    if elapsed < SATELLITE_WINDOW_DURATION:
        return 0
    return int(SATELLITE_WINDOW_INTERVAL - elapsed)


def _transmit_queue() -> dict:
    """Flush all queued messages to India."""
    if not india_messages["outbound_queue"]:
        return {"transmitted": 0, "failed": 0}

    sent, failed = 0, 0
    remaining = []

    for msg in india_messages["outbound_queue"]:
        result = _send_to_india(msg["telegram_text"])
        if result.get("ok"):
            msg["status"] = "delivered"
            msg["delivered_at"] = datetime.now().strftime("%H:%M:%S")
            india_messages["sent"].append(msg)
            satellite_state["total_transmitted"] += 1
            sent += 1
        else:
            msg["status"] = "retry"
            msg["last_error"] = result.get("reason", "unknown")
            remaining.append(msg)
            failed += 1

    india_messages["outbound_queue"] = remaining
    if sent > 0:
        satellite_state["last_window"] = datetime.now().strftime("%H:%M:%S")
    return {"transmitted": sent, "failed": failed}


def _satellite_watcher():
    """Background thread — auto-transmits when the satellite window opens."""
    print("[SAT] 🛰 Satellite watcher thread started")
    was_open = False
    while True:
        try:
            is_open = _is_satellite_window_open()
            queue_len = len(india_messages["outbound_queue"])

            # Rising edge — window just opened
            if is_open and not was_open:
                print(f"[SAT] 🛰 Satellite window OPEN — queue has {queue_len} message(s)")
                result = _transmit_queue()
                if result.get("transmitted", 0) > 0:
                    print(f"[SAT] ✅ Auto-transmitted {result['transmitted']} message(s) to India")
                elif result.get("failed", 0) > 0:
                    print(f"[SAT] ⚠️ {result['failed']} message(s) failed — will retry")

            # Falling edge — window just closed
            elif not is_open and was_open:
                print(f"[SAT] Satellite window CLOSED — {queue_len} waiting")

            satellite_state["link_up"] = is_open
            was_open = is_open
        except Exception as e:
            print(f"[SAT] ❌ Watcher error: {type(e).__name__}: {e}")
        time.sleep(2)


def _telegram_poller():
    """Background thread — polls Telegram for replies from India and
    injects them into the dashboard inbox automatically."""
    global telegram_last_update_id

    if not TELEGRAM_BOT_TOKEN or not TELEGRAM_CHAT_ID:
        print("[TG] ⚠️ Telegram poller disabled — credentials missing")
        return

    print("[TG] 📱 Telegram poller started — listening for India replies")

    # On startup, skip old updates (only listen for new ones)
    try:
        url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/getUpdates"
        r = http_requests.get(url, params={"offset": -1, "timeout": 1}, timeout=8)
        if r.status_code == 200:
            data = r.json()
            if data.get("result"):
                telegram_last_update_id = data["result"][-1]["update_id"] + 1
                print(f"[TG] Skipped old updates up to id={telegram_last_update_id}")
    except Exception as e:
        print(f"[TG] Startup drain failed: {e}")

    while True:
        try:
            url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/getUpdates"
            r = http_requests.get(
                url,
                params={"offset": telegram_last_update_id, "timeout": 5},
                timeout=15,
            )
            if r.status_code != 200:
                time.sleep(3)
                continue

            data = r.json()
            for update in data.get("result", []):
                telegram_last_update_id = update["update_id"] + 1

                msg = update.get("message") or update.get("edited_message")
                if not msg:
                    continue

                # Only accept messages from the configured chat
                chat_id = str(msg.get("chat", {}).get("id", ""))
                if chat_id != str(TELEGRAM_CHAT_ID):
                    continue

                text = (msg.get("text") or "").strip()
                if not text:
                    continue

                reply = {
                    "id": f"REPLY-{int(datetime.now().timestamp() * 1000)}",
                    "ts": datetime.now().strftime("%H:%M:%S"),
                    "from": "INDIA",
                    "text": text,
                    "in_reply_to": None,
                    "source": "telegram",
                }

                # Match /approve or /deny to the most recent unreplied order
                lower = text.lower()
                target = None
                for m in reversed(india_messages["sent"]):
                    if m.get("reply") is None:
                        target = m
                        break

                if target:
                    reply["in_reply_to"] = target["id"]
                    if lower.startswith("/approve"):
                        target["reply"] = "APPROVED"
                    elif lower.startswith("/deny"):
                        target["reply"] = "DENIED"
                    else:
                        target["reply"] = text

                india_messages["inbox"].append(reply)
                print(f"[TG] 📥 Reply from India: {text[:60]}")

        except Exception as e:
            print(f"[TG] Poller error: {type(e).__name__}: {e}")

        time.sleep(3)


# ═══════════════════════════════════════════════════════════
#  MQTT
# ═══════════════════════════════════════════════════════════
def on_mqtt_message(client, userdata, message):
    try:
        payload = json.loads(message.payload.decode())
        payload["timestamp"] = datetime.now().strftime("%H:%M:%S")
        live_readings.append(payload)

        if payload.get("type") == "temperature" and payload.get("value", 0) < -50:
            add_block(payload.get("station", "maitri"),
                      f"CRITICAL SENSOR: {payload.get('sensor_id')} = {payload.get('value')}°C")

        print(f"📥 MQTT: {payload.get('sensor_id'):<16} → "
              f"{payload.get('value'):>7}{payload.get('unit', ''):<4} "
              f"[{payload.get('station','?')}]")

        if main_event_loop is not None:
            for ws in sensor_websockets.copy():
                try:
                    asyncio.run_coroutine_threadsafe(ws.send_json(payload), main_event_loop)
                except Exception:
                    if ws in sensor_websockets:
                        sensor_websockets.remove(ws)
    except Exception as e:
        print(f"❌ MQTT error: {e}")


def _connect_mqtt():
    global mqtt_connected
    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
    client.on_message = on_mqtt_message

    if MQTT_TLS:
        client.tls_set(cert_reqs=ssl.CERT_REQUIRED)
    if MQTT_USERNAME:
        client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD)

    try:
        client.connect(MQTT_HOST, MQTT_PORT, 60)
        client.subscribe(MQTT_TOPIC)
        client.loop_start()
        mqtt_connected = True
        print("=" * 60)
        print(f"✅ MQTT CONNECTED → {MQTT_HOST}:{MQTT_PORT}")
        print("=" * 60)
    except Exception as e:
        mqtt_connected = False
        print("=" * 60)
        print(f"⚠️  MQTT CONNECTION FAILED: {type(e).__name__}: {e}")
        print("=" * 60)
    return client


mqtt_client = _connect_mqtt()


# ═══════════════════════════════════════════════════════════
#  SENSOR SIMULATOR
# ═══════════════════════════════════════════════════════════
FAKE_SENSORS = [
    ("ESP32-FUEL-01",  "temperature", "°C",   -45.0,  8.0, "maitri"),
    ("ESP32-FUEL-02",  "level",       "%",     72.0,  5.0, "maitri"),
    ("ESP32-FUEL-03",  "pressure",    "kPa",  200.0, 15.0, "maitri"),
    ("ESP32-FUEL-04",  "leak",        "0/1",    0.0,  0.05,"maitri"),
    ("ESP32-ENV-01",   "temperature", "°C",   -25.0,  5.0, "maitri"),
    ("ESP32-ENV-02",   "humidity",    "%",     55.0, 10.0, "maitri"),
    ("ESP32-ENV-03",   "pressure",    "hPa",  985.0, 15.0, "maitri"),
    ("ESP32-ENV-04",   "wind",        "km/h",  45.0, 20.0, "maitri"),
    ("ESP32-PWR-01",   "voltage",     "V",    225.0,  5.0, "maitri"),
    ("ESP32-PWR-02",   "current",     "A",     10.0,  3.0, "maitri"),
    ("ESP32-PWR-03",   "load",        "kW",    65.0, 15.0, "maitri"),
    ("ESP32-PWR-04",   "frequency",   "Hz",    50.0,  0.3, "maitri"),
    ("ESP32-HT-01",    "temperature", "°C",     8.0,  4.0, "maitri"),
    ("ESP32-HT-02",    "flow",        "L/m",   15.0,  5.0, "maitri"),
    ("ESP32-GEN-01",   "vibration",   "mm/s",   2.0,  1.0, "maitri"),
    ("ESP32-GEN-02",   "rpm",         "rpm",  1450.0, 30.0, "maitri"),
    ("ESP32-GEN-03",   "temperature", "°C",     78.0, 10.0, "maitri"),
    ("ESP32-LIFE-01",  "co2",         "ppm",   400.0, 50.0, "maitri"),
    ("ESP32-LIFE-02",  "oxygen",      "%",     20.9,  0.5, "maitri"),
    ("ESP32-COMMS-01", "signal",      "dBm",   -85.0, 15.0, "maitri"),
    ("ESP32-SAFE-01",  "temperature", "°C",   -25.0,  5.0, "maitri"),
    ("ESP32-SAFE-02",  "smoke",       "0/1",    0.0,  0.05,"maitri"),
    ("ESP32-FUEL-11",  "temperature", "°C",   -42.0,  8.0, "bharati"),
    ("ESP32-FUEL-12",  "level",       "%",     78.0,  5.0, "bharati"),
    ("ESP32-ENV-11",   "temperature", "°C",   -22.0,  5.0, "bharati"),
    ("ESP32-ENV-12",   "humidity",    "%",     52.0, 10.0, "bharati"),
    ("ESP32-PWR-11",   "voltage",     "V",    224.0,  5.0, "bharati"),
    ("ESP32-PWR-12",   "load",        "kW",    72.0, 15.0, "bharati"),
]


def _background_sensor_publisher():
    print("=" * 60)
    print(f"✅ SENSOR SIMULATOR STARTED — every {SIMULATOR_INTERVAL}s")
    print("=" * 60)
    tick = 0
    while True:
        tick += 1
        try:
            for sid, stype, unit, base, var, station in FAKE_SENSORS:
                drift = math.sin(tick * 0.1 + hash(sid) % 10) * var * 0.3
                noise = (random.random() - 0.5) * 2 * var
                value = base + drift + noise
                if random.random() < 0.03:
                    value += (random.random() - 0.5) * var * 4
                if unit == "0/1":
                    value = 1.0 if random.random() < 0.05 else 0.0
                value = round(value, 2)
                payload = {"sensor_id": sid, "type": stype, "value": value,
                           "unit": unit, "station": station}
                topic = f"polar/station/{station}/sensor/{stype}"
                mqtt_client.publish(topic, json.dumps(payload))
        except Exception as e:
            print(f"⚠️  Sensor publisher error: {e}")
        time.sleep(SIMULATOR_INTERVAL)


# ═══════════════════════════════════════════════════════════
#  LIFESPAN — ONE yield, all three background threads spawned
# ═══════════════════════════════════════════════════════════
@asynccontextmanager
async def lifespan(app: FastAPI):
    global main_event_loop
    main_event_loop = asyncio.get_running_loop()
    print("✅ Event loop captured for MQTT bridge")

    # 1. Sensor simulator
    if ENABLE_SIMULATOR and mqtt_connected:
        threading.Thread(target=_background_sensor_publisher, daemon=True).start()

    # 2. Satellite watcher — Antarctica → India outbound
    threading.Thread(target=_satellite_watcher, daemon=True).start()
    print("✅ Satellite watcher thread spawned")

    # 3. Telegram poller — India → Antarctica inbound
    threading.Thread(target=_telegram_poller, daemon=True).start()
    print("✅ Telegram poller thread spawned")

    yield
    print("🛑 Shutting down...")


app = FastAPI(title="DhruvaTwin API", version="3.1.0", lifespan=lifespan)

_allowed = os.environ.get("ALLOWED_ORIGINS", "*").strip()
ALLOWED_ORIGINS = ["*"] if _allowed == "*" else [o.strip() for o in _allowed.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ═══════════════════════════════════════════════════════════
#  AI CLIENT
# ═══════════════════════════════════════════════════════════
ai_client = None
if not GROQ_API_KEY:
    print("⚠️  GROQ_API_KEY not set — AI prediction will fall back to local simulator.")
else:
    try:
        ai_client = AsyncOpenAI(
            base_url="https://api.groq.com/openai/v1",
            api_key=GROQ_API_KEY,
        )
        print(f"✅ Groq client ready (model={GROQ_MODEL})")
    except Exception as e:
        print(f"⚠️  Groq init failed: {e}")
        ai_client = None


# ═══════════════════════════════════════════════════════════
#  BLOCKCHAIN
# ═══════════════════════════════════════════════════════════
def make_genesis(name):
    return {
        "index": 0, "timestamp": str(datetime.now()),
        "data": f"Genesis Block - {name}", "previous_hash": "0",
        "hash": hashlib.sha256(f"Genesis-{name}".encode()).hexdigest(),
    }

blockchains = {
    "maitri":  [make_genesis("Maitri Station")],
    "bharati": [make_genesis("Bharati Station")],
}

def add_block(station, data):
    if station not in blockchains:
        station = "maitri"
    chain = blockchains[station]
    prev = chain[-1]
    new_hash = hashlib.sha256(f"{prev['hash']}{data}{datetime.now()}".encode()).hexdigest()
    new_block = {
        "index": len(chain), "timestamp": str(datetime.now()),
        "data": data, "previous_hash": prev["hash"], "hash": new_hash,
    }
    chain.append(new_block)
    return new_block


# ═══════════════════════════════════════════════════════════
#  HEALTH
# ═══════════════════════════════════════════════════════════
@app.get("/health")
def health():
    return {"status": "ok", "service": "dhruvatwin",
            "simulator": ENABLE_SIMULATOR, "mqtt_connected": mqtt_connected,
            "ai_enabled": bool(ai_client),
            "readings_buffered": len(live_readings),
            "time": datetime.now().isoformat()}


@app.get("/ready")
def ready():
    return {"ready": True, "mqtt_connected": mqtt_connected,
            "ai_configured": bool(GROQ_API_KEY), "simulator": ENABLE_SIMULATOR}


@app.get("/api/mqtt/status")
def mqtt_status():
    return {"connected": mqtt_connected, "host": MQTT_HOST, "port": MQTT_PORT,
            "topic": MQTT_TOPIC, "tls": MQTT_TLS,
            "readings_count": len(live_readings), "simulator_enabled": ENABLE_SIMULATOR}


@app.get("/api/iot/live")
def get_live_readings(limit: int = 100):
    return {"count": len(live_readings), "readings": list(live_readings)[-limit:]}


@app.websocket("/ws/sensors")
async def sensor_ws_endpoint(websocket: WebSocket):
    await websocket.accept()
    sensor_websockets.append(websocket)
    print(f"🔌 WebSocket connected ({len(sensor_websockets)} active)")
    try:
        for r in list(live_readings)[-20:]:
            await websocket.send_json(r)
    except Exception:
        pass
    try:
        while True:
            await websocket.receive_text()
    except Exception:
        if websocket in sensor_websockets:
            sensor_websockets.remove(websocket)


# ═══════════════════════════════════════════════════════════
#  ANTARCTICA → INDIA ENDPOINTS
# ═══════════════════════════════════════════════════════════
@app.get("/api/india/status")
def india_status():
    return {
        "link_up": _is_satellite_window_open(),
        "seconds_until_window": _seconds_until_next_window(),
        "window_duration": SATELLITE_WINDOW_DURATION,
        "window_interval": SATELLITE_WINDOW_INTERVAL,
        "last_window": satellite_state["last_window"],
        "total_transmitted": satellite_state["total_transmitted"],
        "queue_length": len(india_messages["outbound_queue"]),
        "sent_count": len(india_messages["sent"]),
        "inbox_count": len(india_messages["inbox"]),
        "telegram_enabled": bool(TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID),
    }


@app.post("/api/india/send-order")
async def india_send_order(request: Request):
    data = await request.json()
    item = data.get("item", "Unknown")
    qty = data.get("qty", 0)
    station = data.get("station", "maitri")
    priority = data.get("priority", "medium")

    telegram_text = (
        f"🇦🇶 *ANTARCTICA → INDIA* 🇮🇳\n"
        f"━━━━━━━━━━━━━━━━━━━━━\n"
        f"📍 Station: *{station.upper()}*\n"
        f"📦 Item: *{item}*\n"
        f"🔢 Quantity: {qty}\n"
        f"⚡ Priority: {priority.upper()}\n"
        f"🕐 Time: {datetime.now().strftime('%d %b %Y, %H:%M UTC')}\n"
        f"━━━━━━━━━━━━━━━━━━━━━\n"
        f"Reply with `/approve` or `/deny`"
    )

    msg = {
        "id": f"ORD-{int(datetime.now().timestamp() * 1000)}",
        "ts": datetime.now().strftime("%H:%M:%S"),
        "station": station,
        "item": item,
        "qty": qty,
        "priority": priority,
        "telegram_text": telegram_text,
        "status": "queued",
        "reply": None,
        "last_error": None,
        "delivered_at": None,
    }

    if _is_satellite_window_open():
        result = _send_to_india(telegram_text)
        if result.get("ok"):
            msg["status"] = "delivered"
            msg["delivered_at"] = datetime.now().strftime("%H:%M:%S")
            india_messages["sent"].append(msg)
            satellite_state["total_transmitted"] += 1
            return {"delivered": True, "message": msg, "reason": "window_open"}
        else:
            msg["status"] = "retry"
            msg["last_error"] = result.get("reason")
            india_messages["outbound_queue"].append(msg)
            return {"delivered": False, "message": msg, "reason": "send_failed"}

    india_messages["outbound_queue"].append(msg)
    return {
        "delivered": False,
        "message": msg,
        "reason": "offline_queued",
        "next_window_in": _seconds_until_next_window(),
    }


@app.post("/api/india/force-sync")
def india_force_sync():
    """Manual trigger — operator decides to transmit now."""
    satellite_state["window_started"] = time.time()
    result = _transmit_queue()
    return {"forced": True, **result}


@app.get("/api/india/messages")
def india_messages_get():
    return {
        "outbound_queue": india_messages["outbound_queue"],
        "sent": india_messages["sent"][-50:],
        "inbox": india_messages["inbox"][-50:],
    }


@app.post("/api/india/receive-reply")
async def india_receive_reply(request: Request):
    """Manual reply injection — also used by the frontend to simulate replies."""
    data = await request.json()
    reply_text = data.get("text", "")
    msg_id = data.get("id", None)

    reply = {
        "id": f"REPLY-{int(datetime.now().timestamp() * 1000)}",
        "ts": datetime.now().strftime("%H:%M:%S"),
        "from": "INDIA",
        "text": reply_text,
        "in_reply_to": msg_id,
        "source": "manual",
    }
    india_messages["inbox"].append(reply)

    if msg_id:
        for m in india_messages["sent"]:
            if m["id"] == msg_id:
                m["reply"] = reply_text
                break

    return {"ok": True, "reply": reply}


@app.post("/api/india/clear")
def india_clear():
    india_messages["outbound_queue"] = []
    india_messages["sent"] = []
    india_messages["inbox"] = []
    satellite_state["total_transmitted"] = 0
    return {"ok": True}


# ═══════════════════════════════════════════════════════════
#  STATION ENDPOINTS
# ═══════════════════════════════════════════════════════════
@app.get("/api/telemetry/{station}")
def get_telemetry(station: str):
    if station == "maitri":
        return {"station": "Maitri", "fuel_temp": random.randint(-60, -30),
                "fuel_level": random.randint(60, 85),
                "ice_thickness": round(random.uniform(0.5, 3.0), 2),
                "wind_speed": random.randint(10, 80),
                "satellite_link": random.choice(["Strong", "Intermittent", "Weak"]),
                "auto_heal": "Active",
                "ambient_temp": round(random.uniform(-30, -5), 1),
                "humidity": random.randint(40, 75), "pressure": random.randint(950, 1010),
                "radiation": round(random.uniform(0.05, 0.25), 3),
                "power_output": random.randint(80, 100), "personnel": random.randint(20, 26)}
    return {"station": "Bharati", "fuel_temp": random.randint(-55, -25),
            "fuel_level": random.randint(65, 90),
            "ice_thickness": round(random.uniform(0.3, 2.5), 2),
            "wind_speed": random.randint(5, 70),
            "satellite_link": random.choice(["Strong", "Intermittent", "Weak"]),
            "auto_heal": "Active",
            "ambient_temp": round(random.uniform(-40, 0), 1),
            "humidity": random.randint(35, 70), "pressure": random.randint(940, 1005),
            "radiation": round(random.uniform(0.15, 0.30), 3),
            "power_output": random.randint(85, 100), "personnel": random.randint(40, 47)}


@app.get("/api/ledger/{station}")
def get_ledger(station: str):
    chain = blockchains.get(station, [])
    return {"blocks": chain[-8:], "total_blocks": len(chain)}


@app.get("/api/station-info/{station}")
def get_station_info(station: str):
    if station == "bharati":
        return {"name": "Bharati", "hindi_name": "भारती",
                "coordinates": "69°24'41\"S, 76°11'72\"E", "elevation_m": 35,
                "commissioned": "18 March 2012",
                "region": "Larsemann Hills, East Antarctica",
                "capacity_main": 47, "capacity_total": 72,
                "communication": "Dedicated satellite", "power": "220V regulated",
                "built_from": "130+ shipping containers"}
    return {"name": "Maitri", "hindi_name": "मैत्री",
            "coordinates": "70°45'57\"S, 11°44'10\"E", "elevation_m": 120,
            "commissioned": "1989",
            "region": "Schirmacher Oasis, Queen Maud Land",
            "capacity_main": 26, "capacity_total": 46,
            "communication": "Satellite + HF radio", "power": "Diesel + solar",
            "built_from": "Modular prefabricated"}


@app.get("/api/system-health/{station}")
def get_system_health(station: str):
    return {"modules": [
        {"name": "Main Building Power", "status": "Online", "value": "220V"},
        {"name": "Water Supply", "status": "Online", "value": "Normal"},
        {"name": "Heating System", "status": "Online", "value": "Auto"},
        {"name": "Fuel Pump", "status": "Online", "value": "Active"},
        {"name": "Satellite Uplink", "status": "Intermittent", "value": "72%"},
        {"name": "Backup Generator", "status": "Standby", "value": "Ready"}]}


# ═══════════════════════════════════════════════════════════
#  IoT SENSOR CATEGORIES
# ═══════════════════════════════════════════════════════════
@app.get("/api/iot/environment/{station}")
def get_environment(station: str):
    temp = round(random.uniform(-35, -5), 1)
    return {"category": "Environment", "icon": "🌤️", "sensors": [
        {"name": "Temperature", "value": temp, "unit": "°C",
         "status": "Warning" if temp < -30 else "Normal"},
        {"name": "Humidity", "value": random.randint(40, 75), "unit": "%", "status": "Normal"},
        {"name": "Pressure", "value": random.randint(950, 1010), "unit": "hPa", "status": "Normal"},
        {"name": "Wind Speed", "value": random.randint(10, 80), "unit": "km/h", "status": "Normal"}]}


@app.get("/api/iot/energy/{station}")
def get_energy(station: str):
    v = round(random.uniform(215, 230), 1)
    i = round(random.uniform(5, 15), 1)
    b = random.randint(75, 100)
    return {"category": "Energy", "icon": "⚡", "sensors": [
        {"name": "Voltage", "value": v, "unit": "V", "status": "Normal"},
        {"name": "Current", "value": i, "unit": "A", "status": "Normal"},
        {"name": "Power", "value": round(v*i/1000, 2), "unit": "kW", "status": "Normal"},
        {"name": "Battery Status", "value": b, "unit": "%",
         "status": "Charging" if b < 90 else "Full"}]}


@app.get("/api/iot/equipment/{station}")
def get_equipment_health(station: str):
    vib = round(random.uniform(0.1, 3.5), 2)
    return {"category": "Equipment Health", "icon": "🔧", "sensors": [
        {"name": "Vibration", "value": vib, "unit": "mm/s",
         "status": "Critical" if vib > 3.0 else "Warning" if vib > 2.0 else "Normal"},
        {"name": "Motor RPM", "value": random.randint(1400, 1500), "unit": "rpm", "status": "Normal"},
        {"name": "Bearing Temp", "value": random.randint(30, 65), "unit": "°C", "status": "Normal"}]}


@app.get("/api/iot/safety/{station}")
def get_safety(station: str):
    smoke = random.choice(["Clear", "Clear", "Clear", "Detected"])
    leak = random.choice(["Dry", "Dry", "Dry", "Leak Detected"])
    return {"category": "Safety", "icon": "🛡️", "sensors": [
        {"name": "Smoke Sensor", "value": smoke, "unit": "",
         "status": "Critical" if smoke == "Detected" else "Normal"},
        {"name": "Water Leak Sensor", "value": leak, "unit": "",
         "status": "Critical" if leak == "Leak Detected" else "Normal"},
        {"name": "CO₂ Level", "value": random.randint(380, 450), "unit": "ppm", "status": "Normal"}]}


@app.get("/api/iot/asset/{station}")
def get_asset(station: str):
    return {"category": "Asset Tracking", "icon": "📦", "sensors": [
        {"name": "RFID Tag", "value": f"RFID-{random.randint(1000, 9999)}", "unit": "", "status": "Tracked"},
        {"name": "Asset Count", "value": random.randint(45, 65), "unit": "items", "status": "Normal"},
        {"name": "Zone", "value": random.choice(["Storage A", "Storage B", "Lab 1"]),
         "unit": "", "status": "Known"}]}


@app.get("/api/iot/fuel/{station}")
def get_fuel_system(station: str):
    fuel_temp = round(random.uniform(-55, -35), 1)
    fuel_level = random.randint(60, 85)
    leak = random.choice(["Clear", "Clear", "Clear", "Clear", "Leak Detected"])
    return {"category": "Fuel System", "icon": "⛽", "sensors": [
        {"name": "Fuel Temperature", "value": fuel_temp, "unit": "°C",
         "status": "Critical" if fuel_temp < -50 else "Warning" if fuel_temp < -40 else "Normal"},
        {"name": "Fuel Level", "value": fuel_level, "unit": "%",
         "status": "Critical" if fuel_level < 20 else "Warning" if fuel_level < 40 else "Normal"},
        {"name": "Leak Status", "value": leak, "unit": "",
         "status": "Critical" if leak == "Leak Detected" else "Normal"},
        {"name": "Pressure", "value": round(random.uniform(180, 220), 1), "unit": "kPa", "status": "Normal"}]}


# ═══════════════════════════════════════════════════════════
#  CASCADE FAILURE DATA
# ═══════════════════════════════════════════════════════════
CASCADE_SYSTEMS = [
    {"id": "generator", "name": "Generator", "icon": "⚡", "deps": [],
     "edge_device": "ESP32-GEN-01",
     "sensors": [
         {"id": "gen-vibration", "type": "vibration", "unit": "mm/s", "critical": 5.0, "warning": 3.0},
         {"id": "gen-current",   "type": "current",   "unit": "A",    "critical": 60,  "warning": 50},
         {"id": "gen-rpm",       "type": "rpm",       "unit": "rpm",  "critical": 1200,"warning": 1400},
         {"id": "gen-temp",      "type": "temperature","unit": "°C",  "critical": 95,  "warning": 80}]},
    {"id": "power", "name": "Power Grid", "icon": "🔌", "deps": ["generator"],
     "edge_device": "ESP32-PWR-01",
     "sensors": [
         {"id": "pwr-voltage",   "type": "voltage",  "unit": "V",  "critical": 200, "warning": 210},
         {"id": "pwr-frequency", "type": "frequency","unit": "Hz", "critical": 48,  "warning": 49},
         {"id": "pwr-load",      "type": "load",     "unit": "kW", "critical": 90,  "warning": 75}]},
    {"id": "heating", "name": "Heating System", "icon": "🔥", "deps": ["power"],
     "edge_device": "ESP32-HT-01",
     "sensors": [
         {"id": "ht-temp-in",  "type": "temperature", "unit": "°C",  "critical": 5,  "warning": 10},
         {"id": "ht-temp-out", "type": "temperature", "unit": "°C",  "critical": -5, "warning": 0},
         {"id": "ht-flow",     "type": "flow",        "unit": "L/m", "critical": 5,  "warning": 10}]},
    {"id": "fuel", "name": "Fuel System", "icon": "⛽", "deps": ["power", "heating"],
     "edge_device": "ESP32-FUEL-01",
     "sensors": [
         {"id": "fuel-temp",  "type": "temperature", "unit": "°C",   "critical": -50, "warning": -40},
         {"id": "fuel-level", "type": "level",       "unit": "%",    "critical": 20,  "warning": 40},
         {"id": "fuel-leak",  "type": "leak",        "unit": "0/1",  "critical": 1,   "warning": 0},
         {"id": "fuel-press", "type": "pressure",    "unit": "kPa",  "critical": 170, "warning": 180}]},
    {"id": "comms", "name": "Communications", "icon": "📡", "deps": ["power"],
     "edge_device": "ESP32-COMMS-01",
     "sensors": [
         {"id": "comms-rssi", "type": "signal",      "unit": "dBm","critical": -120, "warning": -100},
         {"id": "comms-lat",  "type": "latency",     "unit": "ms", "critical": 5000, "warning": 2000},
         {"id": "comms-loss", "type": "packet_loss", "unit": "%",  "critical": 30,   "warning": 10}]},
    {"id": "life", "name": "Life Support", "icon": "🫁", "deps": ["power", "heating"],
     "edge_device": "ESP32-LIFE-01",
     "sensors": [
         {"id": "life-o2",    "type": "oxygen",   "unit": "%",   "critical": 18,   "warning": 19.5},
         {"id": "life-co2",   "type": "co2",      "unit": "ppm", "critical": 5000, "warning": 3000},
         {"id": "life-humid", "type": "humidity", "unit": "%",   "critical": 80,   "warning": 70}]},
    {"id": "personnel", "name": "Personnel Safety", "icon": "👥", "deps": ["heating", "life", "comms"],
     "edge_device": "ESP32-SAFETY-01",
     "sensors": [
         {"id": "safe-ambient", "type": "temperature", "unit": "°C",   "critical": -20, "warning": -10},
         {"id": "safe-wind",    "type": "wind",        "unit": "km/h", "critical": 90,  "warning": 70},
         {"id": "safe-sos",     "type": "sos_button",  "unit": "0/1",  "critical": 1,   "warning": 0}]},
]


# ═══════════════════════════════════════════════════════════
#  LOCAL SIMULATOR (FALLBACK ONLY)
# ═══════════════════════════════════════════════════════════
BASELINE = {
    "fuel_temp": -35.0, "fuel_level": 72.0, "ambient_temp": -25.0,
    "wind_speed": 45.0, "power_output": 92.0, "indoor_temp": 20.0, "co2_ppm": 400.0,
    "heating_status": "online", "generator_status": "online",
    "power_status": "online", "comms_status": "online", "life_status": "online",
}


def local_fallback_prediction(changes, scenario_label=None):
    lines = []
    if scenario_label:
        lines.append(f"Let's run the '{scenario_label}' scenario.\n")
    else:
        lines.append("Let's run that scenario.\n")

    state = dict(BASELINE); state.update(changes)
    events = []

    if state.get("generator_status") == "failed":
        events += [(0, "generator goes offline, station falls back on batteries"),
                   (2, "power grid sags under battery load"),
                   (6, "heating system can no longer keep up"),
                   (8, "fuel pump loses power"),
                   (12, "life support switches to emergency backup")]
    if "fuel_temp" in changes and changes["fuel_temp"] < -50:
        events += [(0, f"fuel at {changes['fuel_temp']}°C — past gel point"),
                   (2, "viscosity rises sharply, pump strains")]
    if "fuel_level" in changes and changes["fuel_level"] < 25:
        events += [(0, f"fuel reserve at {changes['fuel_level']}% — below safe buffer")]
    if "wind_speed" in changes and changes["wind_speed"] > 100:
        events += [(0, f"wind at {changes['wind_speed']} km/h — exceeds structural limit")]

    if events:
        lines.append("Here's how it would play out:\n")
        for h, desc in events:
            lines.append(f"  Right away — {desc}." if h == 0 else f"  About {h}h in — {desc}.")
        lines.append("")

    risk = min(95, 30 + len(events) * 10)
    lines.append(f"Overall risk: {risk}/100.")
    lines.append("\nRecommendations:")
    if state.get("generator_status") == "failed":
        lines.append("  • Restart generator within 4 hours.")
    if "fuel_temp" in changes and changes["fuel_temp"] < -50:
        lines.append("  • Preheat fuel tank immediately.")
    if not events:
        lines.append("  • No immediate action required.")
    return "\n".join(lines)


# ═══════════════════════════════════════════════════════════
#  AI PREDICTION ENGINE
# ═══════════════════════════════════════════════════════════
chat_history = {"maitri": [], "bharati": []}


def build_cascade_context() -> str:
    lines = ["STATION SYSTEMS & DEPENDENCIES:"]
    for s in CASCADE_SYSTEMS:
        deps = ", ".join(s["deps"]) if s["deps"] else "none"
        sensors = "; ".join(
            f"{sen['id']} (crit<{sen.get('critical','?')}{sen['unit']}, warn<{sen.get('warning','?')}{sen['unit']})"
            for sen in s["sensors"]
        )
        lines.append(f"  - {s['name']} [{s['id']}] depends on: {deps}")
        lines.append(f"      sensors: {sensors}")
    return "\n".join(lines)


def build_system_context(station: str) -> str:
    t = get_telemetry(station)
    info = get_station_info(station)
    cascade_block = build_cascade_context()

    return f"""You are the AI operations assistant for {info['name']} Antarctic research station.
Region: {info['region']}. Personnel on site: {t['personnel']}.

━━━ LIVE TELEMETRY ━━━
Fuel temperature : {t['fuel_temp']}°C   (freezes at -50°C)
Ambient temp     : {t['ambient_temp']}°C
Wind speed       : {t['wind_speed']} km/h
Power output     : {t['power_output']}%
Satellite link   : {t['satellite_link']}

━━━ STATION ARCHITECTURE (use this for predictions) ━━━
{cascade_block}

━━━ BEHAVIOR ━━━
1. For normal questions (status, weather, personnel, fuel, etc.), answer in 2-3 sentences using the live telemetry above.

2. For "what-if" questions (anything with "what if", "simulate", "suppose", "predict", "scenario"), 
   reason through the cascade yourself using the dependency graph above. Format your answer like this:

   Let's run that scenario. I'll assume that <restate the change in plain English>.

   Here's how it would play out:
     Right away — <immediate first-order effect>
     About Xh in — <second-order effect as dependency fails>
     About Yh in — <third-order effect>
     ...

   Overall risk score: N out of 100. <one-line summary>

   What I'd recommend:
     • <action 1>
     • <action 2>

3. Never invent numbers that contradict the live telemetry or the dependency graph.
4. Use plain, warm language. No emojis in what-if responses. No markdown headers.
5. Keep normal replies short. What-if replies can be longer but must stay focused.
"""


async def ask_ai(station: str, user_message: str):
    if ai_client is None:
        return None
    try:
        messages = [{"role": "system", "content": build_system_context(station)}]
        for h in chat_history[station][-8:]:
            messages.append({"role": h["role"], "content": h["content"]})
        messages.append({"role": "user", "content": user_message})

        resp = await ai_client.chat.completions.create(
            model=GROQ_MODEL,
            messages=messages,
            max_tokens=600,
            temperature=0.6,
        )
        text = (resp.choices[0].message.content or "").strip()
        if not text:
            return None

        chat_history[station].append({"role": "user", "content": user_message})
        chat_history[station].append({"role": "assistant", "content": text})
        if len(chat_history[station]) > 20:
            chat_history[station] = chat_history[station][-20:]
        return text
    except Exception as e:
        print(f"❌ AI error: {type(e).__name__}: {e}")
        return None


@app.get("/api/ai-selftest")
async def ai_selftest():
    if ai_client is None:
        return {"ok": False, "reason": "no client (key missing)"}
    try:
        r = await ai_client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[{"role": "user", "content": "Reply with the single word: pong"}],
            max_tokens=10,
        )
        return {"ok": True, "model": GROQ_MODEL,
                "reply": r.choices[0].message.content.strip()}
    except Exception as e:
        return {"ok": False, "model": GROQ_MODEL, "error": f"{type(e).__name__}: {e}"}


def is_whatif_message(msg):
    triggers = ["what if", "what happens if", "simulate ", "suppose ",
                "scenario", "predict", "forecast", "random scenario",
                "surprise me", "chaos"]
    return any(t in msg.lower() for t in triggers)


# ═══════════════════════════════════════════════════════════
#  CHAT WEBSOCKET
# ═══════════════════════════════════════════════════════════
GREETINGS = ["Hey there — how can I help you today?",
             "Hi! What would you like to look up?",
             "Hello! Ready whenever you are."]
THANKS = ["Anytime.", "Happy to help.", "You're welcome."]


@app.websocket("/ws/chat")
async def chat_endpoint(websocket: WebSocket):
    await websocket.accept()

    try:
        await websocket.send_text(
            "Chat connected. AI prediction engine: " +
            ("ONLINE." if ai_client else "OFFLINE (using local fallback).")
        )
    except Exception:
        pass

    while True:
        try:
            user_message = await websocket.receive_text()
        except Exception:
            break

        msg = user_message.lower()
        station = "maitri"
        if msg.startswith("bharati:"):
            station = "bharati"
            msg = msg.replace("bharati:", "", 1).strip()
        elif msg.startswith("maitri:"):
            msg = msg.replace("maitri:", "", 1).strip()

        await asyncio.sleep(0.3)

        ai_response = await ask_ai(station, msg)
        if ai_response:
            try:
                await websocket.send_text(ai_response)
            except Exception:
                break
            continue

        if is_whatif_message(msg):
            changes = {}
            m = msg
            num = r"(-?\d+(?:\.\d+)?)"

            if "fuel" in m and ("temp" in m or "temperature" in m):
                r = re.search(num, m)
                if r: changes["fuel_temp"] = float(r.group(1))
            if "wind" in m:
                r = re.search(num, m)
                if r: changes["wind_speed"] = float(r.group(1))
            if "fuel" in m and ("level" in m or "%" in m):
                r = re.search(num, m)
                if r: changes["fuel_level"] = float(r.group(1))
            if "generator" in m and any(w in m for w in ["fail","down","off","dies"]):
                changes["generator_status"] = "failed"
            if "power" in m and any(w in m for w in ["fail","down","off"]):
                changes["power_status"] = "failed"
            if "heating" in m and any(w in m for w in ["fail","down","off"]):
                changes["heating_status"] = "failed"
            if "comms" in m or "communication" in m:
                if any(w in m for w in ["fail","down","off"]):
                    changes["comms_status"] = "failed"

            if changes:
                reply = local_fallback_prediction(changes)
            else:
                reply = ("I couldn't reach the AI engine and couldn't parse that scenario. "
                         "Try: 'what if the generator fails' or 'what if fuel temp is -60'.")
            try:
                await websocket.send_text(reply)
            except Exception:
                break
            continue

        if "status" in msg:
            reply = f"[{station.upper()}] All systems nominal."
        elif "fuel" in msg:
            reply = f"[{station.upper()}] Fuel temp around -45°C."
        elif "weather" in msg:
            reply = f"[{station.upper()}] Ambient -25°C, wind 45 km/h."
        elif "help" in msg:
            reply = "Ask about status, fuel, weather, personnel — or try a what-if scenario."
        elif any(g in msg for g in ["hi", "hello", "hey"]):
            reply = rnd.choice(GREETINGS)
        elif "thank" in msg:
            reply = rnd.choice(THANKS)
        else:
            reply = f"[{station.upper()}] AI is offline. Try 'help' or a what-if."

        try:
            await websocket.send_text(reply)
        except Exception:
            break


# ═══════════════════════════════════════════════════════════
#  SERVE REACT BUILD
# ═══════════════════════════════════════════════════════════
BUILD_DIR = os.path.join(os.path.dirname(__file__), "prayadarshini-client", "build")

if os.path.exists(BUILD_DIR):
    print(f"✅ Serving React build from: {BUILD_DIR}")
    app.mount("/static", StaticFiles(directory=os.path.join(BUILD_DIR, "static")),
              name="static")

    @app.get("/")
    async def serve_root():
        return FileResponse(os.path.join(BUILD_DIR, "index.html"))

    @app.get("/{full_path:path}")
    async def serve_react(full_path: str):
        if full_path.startswith("api/") or full_path.startswith("ws/"):
            return {"detail": "Not Found"}
        fp = os.path.join(BUILD_DIR, full_path)
        if os.path.exists(fp) and os.path.isfile(fp):
            return FileResponse(fp)
        return FileResponse(os.path.join(BUILD_DIR, "index.html"))


# ═══════════════════════════════════════════════════════════
#  ENTRYPOINT
# ═══════════════════════════════════════════════════════════
if __name__ == "__main__":
    import uvicorn
    PORT = int(os.environ.get("PORT", "8000"))
    if _port_busy(PORT):
        print(f"⚠️  Port {PORT} in use — freeing...")
        _free_port(PORT)
        if _port_busy(PORT):
            print(f"❌ Port {PORT} still busy.")
            sys.exit(1)
    uvicorn.run(app, host="0.0.0.0", port=PORT)