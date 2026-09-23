"""
Downloads the Seattle Fire 911 dataset directly from the official
Seattle Open Data Portal (no Kaggle account required).
Dataset: https://data.seattle.gov/Public-Safety/Seattle-Real-Time-Fire-911-Calls/kzjm-xkqj
"""

import urllib.request
import os
import json

DATA_DIR = os.path.join(os.path.dirname(__file__), 'data')
os.makedirs(DATA_DIR, exist_ok=True)

# ─── Step 1: Download Seattle Fire 911 data via Socrata Open Data API ─────────
# This is the official Seattle.gov dataset, no login needed.
# $limit=500000 fetches 500,000 most recent records (enough for research)
print("Downloading Seattle Fire 911 dataset (500,000 records)...")
print("This may take 2-5 minutes depending on your internet speed...")

url = "https://data.seattle.gov/api/views/kzjm-xkqj/rows.csv?accessType=DOWNLOAD"

csv_path = os.path.join(DATA_DIR, 'seattle_fire_911.csv')

urllib.request.urlretrieve(url, csv_path)
print(f"Saved to: {csv_path}")

# Quick validation
import pandas as pd
df = pd.read_csv(csv_path, nrows=5)
print(f"\nPreview (first 5 rows):")
print(df.to_string())
print(f"\nColumns: {list(df.columns)}")

# ─── Step 2: Download Seattle Historical Weather (Open-Meteo, FREE) ───────────
print("\nDownloading Seattle historical weather data (2015-2024)...")
weather_url = (
    "https://archive-api.open-meteo.com/v1/archive"
    "?latitude=47.6062&longitude=-122.3321"
    "&start_date=2015-01-01&end_date=2024-12-31"
    "&hourly=temperature_2m,precipitation,windspeed_10m"
    "&timezone=America%2FLos_Angeles"
)

try:
    with urllib.request.urlopen(weather_url, timeout=120) as r:
        weather_data = json.loads(r.read())
    weather_path = os.path.join(DATA_DIR, 'seattle_weather.json')
    with open(weather_path, 'w') as f:
        json.dump(weather_data, f)
    print(f"Weather saved: {len(weather_data['hourly']['time'])} hourly records")
except Exception as e:
    print(f"Weather download failed (non-critical): {e}")

print("\nData download complete! Now run: python preprocess.py")
