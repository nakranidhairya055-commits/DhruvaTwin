import paho.mqtt.client as mqtt
import json
import time
import random

client = mqtt.Client()
client.connect("localhost", 1883, 60)

while True:
    for station, lat, lon in [("maitri", -70.7657, 11.7361), ("bharati", -69.4069, 76.1947)]:
        payload = {
            "station": station,
            "lat": lat,
            "lon": lon,
            "temp": random.randint(-60, -20)  # Simulated temperature
        }
        client.publish(f"station/{station}/telemetry", json.dumps(payload))
    time.sleep(5)