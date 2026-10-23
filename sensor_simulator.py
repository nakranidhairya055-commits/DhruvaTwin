import requests
import time
import random
import socket

BACKEND_URL = "/api/iot/ingest"
SENSOR_ID = f"ESP32-TEMP-{socket.gethostname()[:6].upper()}"
STATION = "maitri"
INTERVAL_SECONDS = 5

print(f"📡 IoT Sensor Simulator started")
print(f"   Sensor ID : {SENSOR_ID}")
print(f"   Station   : {STATION.upper()}")
print(f"   Backend   : {BACKEND_URL}")
print(f"   Interval  : every {INTERVAL_SECONDS}s")
print("-" * 60)

reading_count = 0
try:
    while True:
        reading_count += 1
        temp = round(random.uniform(-55, -25), 1)
        payload = {
            "sensor_id": SENSOR_ID,
            "type": "temperature",
            "value": temp,
            "unit": "°C",
            "station": STATION,
        }
        try:
            r = requests.post(BACKEND_URL, json=payload, timeout=3)
            status = "✅" if r.status_code == 200 else f"⚠️ {r.status_code}"
            critical = " 🚨 CRITICAL" if temp < -50 else ""
            print(f"[{reading_count:03d}] {status} {SENSOR_ID} → {temp}°C{critical}")
        except Exception as e:
            print(f"[{reading_count:03d}] ❌ Failed: {e}")
        time.sleep(INTERVAL_SECONDS)
except KeyboardInterrupt:
    print("\n🛑 Simulator stopped.")