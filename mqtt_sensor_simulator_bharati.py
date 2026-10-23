import paho.mqtt.client as mqtt
import time, random, socket, json

BROKER = "localhost"; PORT = 1883
SENSOR_ID = f"ESP32-BHARATI-{socket.gethostname()[:6].upper()}"
STATION = "bharati"
INTERVAL = 5
TOPIC = f"polar/station/{STATION}/sensor/temperature"

print("=" * 60)
print(f"📡 Bharati Simulator | {SENSOR_ID}")
print(f"   Topic: {TOPIC}")
print("=" * 60)

c = mqtt.Client()
try:
    c.connect(BROKER, PORT, 60)
    print("✅ Connected to broker\n")
except Exception as e:
    print(f"❌ {e}"); exit(1)

n = 0
try:
    while True:
        n += 1
        temp = round(random.uniform(-50, -20), 1)
        c.publish(TOPIC, json.dumps({
            "sensor_id": SENSOR_ID, "type": "temperature",
            "value": temp, "unit": "°C", "station": STATION
        }))
        print(f"[{n:03d}] ✅ {temp}°C{' 🚨' if temp < -50 else ''}")
        time.sleep(INTERVAL)
except KeyboardInterrupt:
    print("\n🛑 Stopped."); c.disconnect()