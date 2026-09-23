import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from xgboost import XGBRegressor
import joblib
import os

print("Generating synthetic disaster data...")

# Generate 100,000 synthetic records
n_samples = 100000

# Features:
# - hour (0-23)
# - day_of_week (0-6)
# - lat (scaled 0-1 for simplicity, representing a city grid)
# - lng (scaled 0-1)
# - temperature (Celsius, e.g., 10 to 45)
# - wind_speed (km/h, e.g., 0 to 100)
# - rainfall (mm, e.g., 0 to 50)

np.random.seed(42)

hour = np.random.randint(0, 24, n_samples)
day_of_week = np.random.randint(0, 7, n_samples)
lat = np.random.uniform(0, 1, n_samples)
lng = np.random.uniform(0, 1, n_samples)
temp = np.random.uniform(10, 45, n_samples)
wind = np.random.uniform(0, 100, n_samples)
rain = np.random.uniform(0, 50, n_samples)

# Target: Danger Score (0.0 to 1.0)
# We invent a formula where specific combinations increase danger:
# - Hot + Windy + Dry = High danger (Fire)
# - Heavy Rain + Specific low-lying grid (e.g. lat<0.3) = High danger (Flood)
# - Night time = slight increase in danger (visibility issues)
# Add some random noise

danger = np.zeros(n_samples)

# Rule 1: Fire Hotspots (High temp, high wind, low rain)
fire_risk = (temp / 45.0) * (wind / 100.0) * (1.0 - rain / 50.0)
# Rule 2: Flood Hotspots (High rain, specific region)
flood_risk = (rain / 50.0) * (lat < 0.3)
# Rule 3: Night time accidents
night_risk = (hour < 6) | (hour > 20)

danger = fire_risk * 0.5 + flood_risk * 0.6 + night_risk * 0.1 + np.random.uniform(0, 0.2, n_samples)

# Normalize danger to 0-1
danger = np.clip(danger, 0, 1)

df = pd.DataFrame({
    'hour': hour,
    'day_of_week': day_of_week,
    'lat': lat,
    'lng': lng,
    'temp': temp,
    'wind': wind,
    'rain': rain,
    'danger': danger
})

X = df[['hour', 'day_of_week', 'lat', 'lng', 'temp', 'wind', 'rain']]
y = df['danger']

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

print("Training XGBoost Regressor Model...")
model = XGBRegressor(
    n_estimators=100,
    learning_rate=0.1,
    max_depth=6,
    random_state=42
)

model.fit(X_train, y_train)

# Evaluate
score = model.score(X_test, y_test)
print(f"Model R^2 Score: {score:.4f}")

# Save the model
model_path = os.path.join(os.path.dirname(__file__), 'hotspot_model.pkl')
joblib.dump(model, model_path)
print(f"Model saved to {model_path}")
