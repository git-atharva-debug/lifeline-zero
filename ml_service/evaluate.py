"""
Phase 4: Model Evaluation & Research Paper Charts
Generates all metrics and charts needed for a publishable research paper.
"""

import torch
import torch.nn as nn
import numpy as np
import os
import json
import matplotlib
matplotlib.use('Agg')  # Non-interactive backend for server
import matplotlib.pyplot as plt
from sklearn.metrics import (
    mean_squared_error, mean_absolute_error, r2_score,
    confusion_matrix, classification_report
)
import joblib

SAVE_DIR = os.path.dirname(__file__)
CHARTS_DIR = os.path.join(SAVE_DIR, 'charts')
os.makedirs(CHARTS_DIR, exist_ok=True)
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

with open(os.path.join(SAVE_DIR, 'lstm_config.json')) as f:
    config = json.load(f)

model = DisasterLSTM(config['input_size']).to(DEVICE)
model.load_state_dict(torch.load(os.path.join(SAVE_DIR, 'lstm_model_best.pth'), map_location=DEVICE))
model.eval()

X_test = torch.FloatTensor(np.load(os.path.join(SAVE_DIR, 'X_test.npy')))
y_test = np.load(os.path.join(SAVE_DIR, 'y_test.npy'))

with torch.no_grad():
    y_pred = model(X_test.to(DEVICE)).cpu().numpy().flatten()

#  Regression Metrics 
rmse  = np.sqrt(mean_squared_error(y_test, y_pred))
mae   = mean_absolute_error(y_test, y_pred)
r2    = r2_score(y_test, y_pred)

print("=" * 55)
print(" LSTM MODEL EVALUATION METRICS")
print("=" * 55)
print(f"  Root Mean Squared Error (RMSE): {rmse:.4f}")
print(f"  Mean Absolute Error    (MAE):   {mae:.4f}")
print(f"  R Score               (R):    {r2:.4f} ({r2*100:.2f}%)")
print("=" * 55)

#  Classification Metrics (Binned into 4 risk levels) 
def to_class(arr):
    c = np.zeros(len(arr), dtype=int)
    c[arr > 0.25] = 1
    c[arr > 0.50] = 2
    c[arr > 0.75] = 3
    return c

y_test_cls = to_class(y_test)
y_pred_cls = to_class(y_pred)

labels_present = np.unique(np.concatenate((y_test_cls, y_pred_cls)))
target_names = ['Low', 'Medium', 'High', 'Critical']
present_target_names = [target_names[i] for i in labels_present]

print("\n CLASSIFICATION REPORT (Risk Level Binning)")
print(classification_report(y_test_cls, y_pred_cls, labels=labels_present, target_names=present_target_names, zero_division=0))

# Save metrics to JSON
metrics = {'RMSE': float(rmse), 'MAE': float(mae), 'R2': float(r2)}
with open(os.path.join(SAVE_DIR, 'metrics.json'), 'w') as f:
    json.dump(metrics, f)

#  Chart 1: Training Loss Curves (Figure 2 in paper) 
with open(os.path.join(SAVE_DIR, 'training_history.json')) as f:
    history = json.load(f)

fig, ax = plt.subplots(figsize=(10, 5))
ax.plot(history['train_loss'], label='Training Loss', color='#3b82f6', linewidth=2)
ax.plot(history['val_loss'],   label='Validation Loss', color='#ef4444', linewidth=2, linestyle='--')
ax.fill_between(range(len(history['train_loss'])), history['train_loss'], alpha=0.1, color='#3b82f6')
ax.set_xlabel('Epoch', fontsize=13)
ax.set_ylabel('Mean Squared Error Loss', fontsize=13)
ax.set_title('LSTM Training & Validation Loss Curves\n(Spatio-Temporal Disaster Hotspot Prediction)', fontsize=14)
ax.legend(fontsize=12)
ax.grid(True, alpha=0.3)
plt.tight_layout()
plt.savefig(os.path.join(CHARTS_DIR, 'training_loss_curves.png'), dpi=150, bbox_inches='tight')
print("\n Saved: charts/training_loss_curves.png")

#  Chart 2: Predicted vs Actual Danger Score 
fig, ax = plt.subplots(figsize=(10, 5))
ax.plot(y_test[:300],  label='Actual Danger Score',    color='#ef4444', linewidth=1.5)
ax.plot(y_pred[:300],  label='Predicted Danger Score', color='#3b82f6', linewidth=1.5, linestyle='--')
ax.set_xlabel('Time Step (Hours)', fontsize=13)
ax.set_ylabel('Normalized Danger Score (0-1)', fontsize=13)
ax.set_title(f'LSTM Prediction vs Ground Truth\n(R = {r2:.4f}, RMSE = {rmse:.4f})', fontsize=14)
ax.legend(fontsize=12)
ax.grid(True, alpha=0.3)
plt.tight_layout()
plt.savefig(os.path.join(CHARTS_DIR, 'predicted_vs_actual.png'), dpi=150, bbox_inches='tight')
print(" Saved: charts/predicted_vs_actual.png")

#  Chart 3: Confusion Matrix 
import matplotlib.ticker as ticker
cm = confusion_matrix(y_test_cls, y_pred_cls)
labels = ['Low', 'Medium', 'High', 'Critical']
num_classes = len(labels_present)
fig, ax = plt.subplots(figsize=(7, 6))
im = ax.imshow(cm, cmap='Blues')
ax.set_xticks(range(num_classes)); ax.set_yticks(range(num_classes))
ax.set_xticklabels(present_target_names); ax.set_yticklabels(present_target_names)
ax.set_xlabel('Predicted Label', fontsize=13)
ax.set_ylabel('True Label', fontsize=13)
ax.set_title('Confusion Matrix  Risk Level Classification', fontsize=14)
for i in range(num_classes):
    for j in range(num_classes):
        ax.text(j, i, cm[i, j], ha='center', va='center', color='black' if cm[i, j] < cm.max()/2 else 'white', fontsize=12)
plt.colorbar(im, ax=ax)
plt.tight_layout()
plt.savefig(os.path.join(CHARTS_DIR, 'confusion_matrix.png'), dpi=150, bbox_inches='tight')
print(" Saved: charts/confusion_matrix.png")

print(f"\n All evaluation charts saved to: {CHARTS_DIR}")
print("   Next step: python app.py  (start the Flask server)")
