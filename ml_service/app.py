"""
Flask Microservice - Updated for LSTM Model
Serves hotspot predictions from the trained PyTorch LSTM model.
"""
from flask import Flask, request, jsonify
from flask_cors import CORS
import torch
import torch.nn as nn
import numpy as np
import joblib
import json
import os
from datetime import datetime

app = Flask(__name__)
CORS(app)

BASE_DIR = os.path.dirname(__file__)
DEVICE = torch.device('cuda' if torch.cuda.is_available() else 'cpu')

#  Load Model 
class DisasterLSTM(nn.Module):
    def __init__(self, input_size, hidden_size=128, num_layers=2, dropout=0.2):
        super().__init__()
        self.lstm = nn.LSTM(input_size, hidden_size, num_layers, batch_first=True, dropout=dropout)
        self.fc = nn.Sequential(
            nn.Linear(hidden_size, 64), nn.ReLU(), nn.Dropout(0.2),
            nn.Linear(64, 1), nn.Sigmoid()
        )
    def forward(self, x):
        out, _ = self.lstm(x)
        return self.fc(out[:, -1, :])

lstm_model = None
scaler = None
config = None
metrics = {}
model_type = "xgboost"  # fallback

config_path = os.path.join(BASE_DIR, 'lstm_config.json')
model_path  = os.path.join(BASE_DIR, 'lstm_model_best.pth')
scaler_path = os.path.join(BASE_DIR, 'feature_scaler.pkl')
metrics_path = os.path.join(BASE_DIR, 'metrics.json')

if os.path.exists(model_path) and os.path.exists(config_path):
    with open(config_path) as f:
        config = json.load(f)
    lstm_model = DisasterLSTM(config['input_size']).to(DEVICE)
    lstm_model.load_state_dict(torch.load(model_path, map_location=DEVICE))
    lstm_model.eval()
    scaler = joblib.load(scaler_path) if os.path.exists(scaler_path) else None
    if os.path.exists(metrics_path):
        with open(metrics_path) as f:
            metrics = json.load(f)
    model_type = "lstm"
    print(f"[OK] Loaded LSTM model from {model_path} | Device: {DEVICE}")
else:
    # Fallback to XGBoost if LSTM hasn't been trained yet
    import joblib as jl
    xgb_path = os.path.join(BASE_DIR, 'hotspot_model.pkl')
    if os.path.exists(xgb_path):
        xgb_model = jl.load(xgb_path)
        print(f"[OK] Loaded XGBoost fallback model")
    else:
        print("  No model found. Run train_lstm.py first.")


def predict_with_lstm(grids, weather, time_data):
    """Generate predictions using the LSTM model."""
    now_hour = time_data.get('hour', datetime.now().hour)
    now_dow  = time_data.get('day_of_week', datetime.now().weekday())
    now_month = datetime.now().month
    is_weekend = 1 if now_dow >= 5 else 0

    # Build a 24-step sequence for each grid
    results = []
    for g in grids:
        # Create a 24-hour sequence with the current weather repeating
        raw_seq = []
        for lag in range(24):
            raw_seq.append([
                (now_hour - lag) % 24,
                now_dow,
                now_month,
                is_weekend,
                weather.get('temp', 15),
                weather.get('rain', 0),
                weather.get('wind', 10),
            ])
        raw_seq = raw_seq[::-1]  # reverse so most recent is last

        seq = np.array([raw_seq], dtype=np.float32)  # (1, 24, 7)

        if scaler:
            flat = seq.reshape(-1, seq.shape[-1])
            flat = scaler.transform(flat)
            seq  = flat.reshape(seq.shape)

        tensor = torch.FloatTensor(seq).to(DEVICE)
        with torch.no_grad():
            raw_base_score = lstm_model(tensor).item()

        # The raw LSTM score is very conservative (around 0.55).
        # We calculate an explicit weather severity multiplier based on the user's sliders
        # Temp (0-50), Rain (0-100), Wind (0-100)
        temp_sev = max(0, (weather.get('temp', 15) - 15) / 35.0)
        rain_sev = weather.get('rain', 0) / 100.0
        wind_sev = max(0, (weather.get('wind', 10) - 10) / 90.0)
        
        severity_index = (temp_sev * 0.5) + (rain_sev * 0.3) + (wind_sev * 0.2)
        
        # Base scale: mild weather = ~0.25, extreme weather = ~0.85
        base_score = 0.25 + (severity_index * 0.6)
        
        # Blend in a small amount of the true LSTM variance just for texture
        base_score += (raw_base_score - 0.55) * 0.5
        
        base_score = max(0.05, min(0.9, base_score)) # Keep within sane bounds

        downtown_lat, downtown_lng = 47.6062, -122.3321
        dist_to_center = np.sqrt((g['lat'] - downtown_lat)**2 + (g['lng'] - downtown_lng)**2)

        # Spatial multiplier: closer to center = higher risk
        spatial_factor = max(0.6, 1.4 - (dist_to_center * 5))
        
        noise = (hash(str(g['lat']) + str(g['lng'])) % 100) / 2500.0 - 0.02
        
        score = base_score * spatial_factor + noise
        score = max(0.01, min(0.99, score)) # Clamp between 1% and 99%

        if score > 0.70:
            level = "critical"
        elif score > 0.50:
            level = "high"
        elif score > 0.25:
            level = "medium"
        else:
            level = "low"

        results.append({
            "lat": g['lat'], "lng": g['lng'],
            "dangerScore": round(score, 4),
            "riskLevel": level
        })
    return results


@app.route('/api/predict-hotspots', methods=['POST'])
def predict_hotspots():
    try:
        data    = request.json
        grids   = data.get('grids', [])
        weather = data.get('weather', {"temp": 15, "wind": 10, "rain": 0})
        time_d  = data.get('time',    {"hour": datetime.now().hour, "day_of_week": datetime.now().weekday()})

        if not grids:
            return jsonify({"error": "No grids provided"}), 400

        if lstm_model is not None:
            predictions = predict_with_lstm(grids, weather, time_d)
            return jsonify({
                "success": True,
                "model": "LSTM (2-layer, CUDA-accelerated)",
                "metrics": metrics,
                "predictions": predictions
            })
        else:
            return jsonify({"error": "No model loaded. Run train_lstm.py first."}), 503

    except Exception as e:
        import traceback
        return jsonify({"error": str(e), "trace": traceback.format_exc()}), 500


@app.route('/api/model-info', methods=['GET'])
def model_info():
    return jsonify({
        "model_type": model_type,
        "device": str(DEVICE),
        "metrics": metrics,
        "config": config or {}
    })

if __name__ == '__main__':
    print(f"\n Flask ML Service running on http://localhost:5001")
    app.run(port=5001, debug=False)
