"""
Phase 2: Preprocessing Pipeline
Transforms raw Seattle 911 CSV + weather JSON into LSTM-ready sequences.
"""

import pandas as pd
import numpy as np
import os
import json
from sklearn.preprocessing import MinMaxScaler
import joblib

DATA_DIR = os.path.join(os.path.dirname(__file__), 'data')
SAVE_DIR = os.path.dirname(__file__)

print("=" * 60)
print("Step 1: Loading Seattle Fire 911 dataset...")
print("=" * 60)

# Find the CSV file
csv_files = [f for f in os.listdir(DATA_DIR) if f.endswith('.csv')]
if not csv_files:
    raise FileNotFoundError(f"No CSV file found in {DATA_DIR}. Run download_data.py first.")

csv_path = os.path.join(DATA_DIR, csv_files[0])
print(f"Loading: {csv_path}")

df = pd.read_csv(csv_path, low_memory=False)
print(f"âœ… Loaded {len(df):,} records | Columns: {list(df.columns)}")

# â”€â”€â”€ Step 2: Clean & Parse â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
print("\n" + "=" * 60)
print("Step 2: Cleaning & parsing timestamps...")
print("=" * 60)

# Identify datetime column (flexible for different CSV formats)
dt_col = None
for col in df.columns:
    if 'date' in col.lower() or 'time' in col.lower() or 'datetime' in col.lower():
        dt_col = col
        break

if dt_col is None:
    raise ValueError(f"No datetime column found. Columns are: {list(df.columns)}")

print(f"  Using datetime column: '{dt_col}'")
df[dt_col] = pd.to_datetime(df[dt_col], errors='coerce', utc=True)
df = df.dropna(subset=[dt_col])
df['datetime'] = df[dt_col].dt.tz_convert('UTC')
df['date'] = df['datetime'].dt.date
df['hour'] = df['datetime'].dt.hour
df['day_of_week'] = df['datetime'].dt.dayofweek
df['month'] = df['datetime'].dt.month
df['is_weekend'] = (df['day_of_week'] >= 5).astype(int)

# Identify lat/lng columns
lat_col = next((c for c in df.columns if 'lat' in c.lower()), None)
lng_col = next((c for c in df.columns if 'lon' in c.lower() or 'lng' in c.lower()), None)

if lat_col and lng_col:
    df = df.dropna(subset=[lat_col, lng_col])
    df['lat'] = pd.to_numeric(df[lat_col], errors='coerce')
    df['lng'] = pd.to_numeric(df[lng_col], errors='coerce')
    df = df.dropna(subset=['lat', 'lng'])
    # Filter to Seattle bounding box
    df = df[(df['lat'] > 47.4) & (df['lat'] < 47.8) & (df['lng'] > -122.5) & (df['lng'] < -122.1)]
    # Create 0.5kmÂ² grid cells (0.005 degree â‰ˆ 500m)
    df['lat_grid'] = (df['lat'] / 0.005).astype(int)
    df['lng_grid'] = (df['lng'] / 0.005).astype(int)
    use_geo = True
    print(f"  Grid cells: {df['lat_grid'].nunique()} lat Ã— {df['lng_grid'].nunique()} lng")
else:
    print("  âš ï¸  No lat/lng columns found. Using time-only features.")
    use_geo = False

print(f"  Records after cleaning: {len(df):,}")
print(f"  Date range: {df['datetime'].min()} â†’ {df['datetime'].max()}")

# â”€â”€â”€ Step 3: Merge Weather â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
print("\n" + "=" * 60)
print("Step 3: Merging weather data...")
print("=" * 60)

weather_path = os.path.join(DATA_DIR, 'seattle_weather.json')
has_weather = False
if os.path.exists(weather_path):
    with open(weather_path) as f:
        weather_raw = json.load(f)
    weather_df = pd.DataFrame({
        'datetime': pd.to_datetime(weather_raw['hourly']['time'], utc=True),
        'temp': weather_raw['hourly']['temperature_2m'],
        'rain': weather_raw['hourly']['precipitation'],
        'wind': weather_raw['hourly']['windspeed_10m'],
    })
    weather_df['hour_key'] = weather_df['datetime'].dt.floor('h')
    df['hour_key'] = df['datetime'].dt.floor('h')
    df = df.merge(weather_df[['hour_key', 'temp', 'rain', 'wind']], on='hour_key', how='left')
    df[['temp', 'rain', 'wind']] = df[['temp', 'rain', 'wind']].ffill().bfill()
    has_weather = True
    print("  âœ… Weather data merged successfully!")
else:
    print("  âš ï¸  No weather data. Using zero placeholders.")
    df['temp'] = 15.0
    df['rain'] = 0.0
    df['wind'] = 10.0

# â”€â”€â”€ Step 4: Create hourly incident density per grid cell â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
print("\n" + "=" * 60)
print("Step 4: Creating incident density time series...")
print("=" * 60)

# Count incidents per (grid, hour_key)
if use_geo:
    group_cols = ['hour_key', 'lat_grid', 'lng_grid']
else:
    group_cols = ['hour_key']

agg = df.groupby(group_cols).agg(
    incident_count=('datetime', 'count'),
    temp=('temp', 'first'),
    rain=('rain', 'first'),
    wind=('wind', 'first'),
    hour=('hour', 'first'),
    day_of_week=('day_of_week', 'first'),
    month=('month', 'first'),
    is_weekend=('is_weekend', 'first'),
).reset_index()

agg = agg.sort_values('hour_key').reset_index(drop=True)

# Normalize target
max_count = agg['incident_count'].quantile(0.99)
agg['danger'] = (agg['incident_count'] / max_count).clip(0, 1)

print(f"  Total time-series records: {len(agg):,}")

# â”€â”€â”€ Step 5: Build LSTM Sequences â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
print("\n" + "=" * 60)
print("Step 5: Building 24-hour LSTM sequences...")
print("=" * 60)

feature_cols = ['hour', 'day_of_week', 'month', 'is_weekend', 'temp', 'rain', 'wind']
SEQ_LEN = 24  # 24-hour look-back window

# Scale features
scaler = MinMaxScaler()
agg[feature_cols] = scaler.fit_transform(agg[feature_cols])
joblib.dump(scaler, os.path.join(SAVE_DIR, 'feature_scaler.pkl'))

# For simplicity and speed, aggregate across all grids per hour
# (spatial split handled by the model at inference time)
hourly = agg.groupby('hour_key')[feature_cols + ['danger']].mean().reset_index()
hourly = hourly.sort_values('hour_key').reset_index(drop=True)

# Pre-extract numpy arrays ONCE (avoids repeated pandas overhead in loop)
feat_vals   = hourly[feature_cols].to_numpy(dtype=np.float32)
danger_vals = hourly['danger'].to_numpy(dtype=np.float32)

n_sequences = len(hourly) - SEQ_LEN

# Pre-allocate arrays for memory efficiency (no list.append overhead)
X = np.empty((n_sequences, SEQ_LEN, len(feature_cols)), dtype=np.float32)
y = np.empty((n_sequences,), dtype=np.float32)

for i in range(n_sequences):
    X[i] = feat_vals[i : i + SEQ_LEN]
    y[i] = danger_vals[i + SEQ_LEN]

print(f"  X shape: {X.shape}  (sequences x timesteps x features)")
print(f"  y shape: {y.shape}")

# Time-based train/val/test split (NO DATA LEAKAGE)
n = len(X)
train_end = int(n * 0.70)
val_end   = int(n * 0.85)

X_train, y_train = X[:train_end], y[:train_end]
X_val,   y_val   = X[train_end:val_end], y[train_end:val_end]
X_test,  y_test  = X[val_end:], y[val_end:]

print(f"\n  Train: {len(X_train):,} | Val: {len(X_val):,} | Test: {len(X_test):,}")

# Save
np.save(os.path.join(SAVE_DIR, 'X_train.npy'), X_train)
np.save(os.path.join(SAVE_DIR, 'y_train.npy'), y_train)
np.save(os.path.join(SAVE_DIR, 'X_val.npy'),   X_val)
np.save(os.path.join(SAVE_DIR, 'y_val.npy'),   y_val)
np.save(os.path.join(SAVE_DIR, 'X_test.npy'),  X_test)
np.save(os.path.join(SAVE_DIR, 'y_test.npy'),  y_test)
np.save(os.path.join(SAVE_DIR, 'feature_cols.npy'), np.array(feature_cols))

print("\nâœ… Preprocessing complete! Now run: python train_lstm.py")

