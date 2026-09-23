"""
Phase 3: LSTM Model Training
Trains a 2-layer LSTM with CUDA GPU acceleration on the preprocessed sequences.
"""

import torch
import torch.nn as nn
from torch.utils.data import DataLoader, TensorDataset
import numpy as np
import os
import json
import time

SAVE_DIR = os.path.dirname(__file__)
DEVICE = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
print(f"  Training on: {DEVICE}")
if DEVICE.type == 'cuda':
    print(f"   GPU: {torch.cuda.get_device_name(0)}")

#  Load Data 
X_train = torch.FloatTensor(np.load(os.path.join(SAVE_DIR, 'X_train.npy')))
y_train = torch.FloatTensor(np.load(os.path.join(SAVE_DIR, 'y_train.npy'))).unsqueeze(1)
X_val   = torch.FloatTensor(np.load(os.path.join(SAVE_DIR, 'X_val.npy')))
y_val   = torch.FloatTensor(np.load(os.path.join(SAVE_DIR, 'y_val.npy'))).unsqueeze(1)

n_features = X_train.shape[2]
print(f"\nData loaded:")
print(f"   Train: {X_train.shape} | Val: {X_val.shape}")
print(f"   Features: {n_features}")
print(f"   Device: {DEVICE} (CUDA wheels unavailable for Python 3.14 - using CPU)")

train_ds = TensorDataset(X_train, y_train)
val_ds   = TensorDataset(X_val, y_val)
train_dl = DataLoader(train_ds, batch_size=512, shuffle=True,  num_workers=0)
val_dl   = DataLoader(val_ds,   batch_size=512, shuffle=False, num_workers=0)


#  2-Layer LSTM Model 
class DisasterLSTM(nn.Module):
    def __init__(self, input_size, hidden_size=128, num_layers=2, dropout=0.2):
        super().__init__()
        self.lstm = nn.LSTM(
            input_size=input_size,
            hidden_size=hidden_size,
            num_layers=num_layers,
            batch_first=True,
            dropout=dropout
        )
        self.fc = nn.Sequential(
            nn.Linear(hidden_size, 64),
            nn.ReLU(),
            nn.Dropout(0.2),
            nn.Linear(64, 1),
            nn.Sigmoid()
        )

    def forward(self, x):
        out, _ = self.lstm(x)
        out = out[:, -1, :]  # Take the last time step
        return self.fc(out)


model = DisasterLSTM(input_size=n_features).to(DEVICE)
print(f"\n Model architecture:")
print(model)
total_params = sum(p.numel() for p in model.parameters() if p.requires_grad)
print(f"   Trainable parameters: {total_params:,}")

optimizer = torch.optim.Adam(model.parameters(), lr=0.001)
scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(optimizer, patience=3, factor=0.5)
criterion = nn.MSELoss()

#  Training Loop 
EPOCHS = 20  # Reduced for CPU training (~45-90 min). Increase to 50 if GPU is available.
best_val_loss = float('inf')
patience_counter = 0
PATIENCE = 7  # Early stopping

history = {'train_loss': [], 'val_loss': []}

print(f"\n Starting training ({EPOCHS} epochs, early stopping patience={PATIENCE})...")
print("=" * 60)

for epoch in range(EPOCHS):
    t0 = time.time()
    
    # Train
    model.train()
    train_losses = []
    for xb, yb in train_dl:
        xb, yb = xb.to(DEVICE), yb.to(DEVICE)
        optimizer.zero_grad()
        pred = model(xb)
        loss = criterion(pred, yb)
        loss.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
        optimizer.step()
        train_losses.append(loss.item())
    
    # Validate
    model.eval()
    val_losses = []
    with torch.no_grad():
        for xb, yb in val_dl:
            xb, yb = xb.to(DEVICE), yb.to(DEVICE)
            pred = model(xb)
            val_losses.append(criterion(pred, yb).item())
    
    train_loss = np.mean(train_losses)
    val_loss   = np.mean(val_losses)
    history['train_loss'].append(train_loss)
    history['val_loss'].append(val_loss)
    elapsed = time.time() - t0
    
    print(f"Epoch [{epoch+1:2d}/{EPOCHS}] | Train Loss: {train_loss:.6f} | Val Loss: {val_loss:.6f} | {elapsed:.1f}s")
    
    scheduler.step(val_loss)
    
    # Save best model
    if val_loss < best_val_loss:
        best_val_loss = val_loss
        torch.save(model.state_dict(), os.path.join(SAVE_DIR, 'lstm_model_best.pth'))
        patience_counter = 0
    else:
        patience_counter += 1
        if patience_counter >= PATIENCE:
            print(f"\n  Early stopping triggered at epoch {epoch+1}")
            break

# Save training history for research paper charts
with open(os.path.join(SAVE_DIR, 'training_history.json'), 'w') as f:
    json.dump(history, f)

# Save model config for Flask API
config = {
    'input_size':  n_features,
    'hidden_size': 128,
    'num_layers':  2,
    'seq_len':     24,
    'best_val_loss': best_val_loss
}
with open(os.path.join(SAVE_DIR, 'lstm_config.json'), 'w') as f:
    json.dump(config, f)

print(f"\n Training complete! Best Val Loss: {best_val_loss:.6f}")
print("   Model saved: lstm_model_best.pth")
print("   Next step: python evaluate.py")
