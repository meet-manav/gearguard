from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import pandas as pd
import numpy as np
import os
import glob
import io

app = FastAPI(title="GearGuard API")

# Allow CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATA_PATH = os.path.join(os.path.dirname(__file__), '..', 'dataset', 'gearbox_data')

# In-memory dataframe cache for instantaneous responsiveness
data_cache = {}
stream_state = {
    "current_file": None,
    "offset": 0,
    "condition": "healthy"
}

def load_cached_array(filepath):
    """Loads and caches full 4-channel accelerometer readings from text file."""
    if filepath not in data_cache:
        try:
            df = pd.read_csv(filepath, sep='\t', header=None, nrows=15000)
            if df.shape[1] < 4:
                df = pd.read_csv(filepath, delim_whitespace=True, header=None, nrows=15000)
            # Take first 4 sensor columns and drop any NaN
            arr = df.iloc[:, :4].dropna().values # shape: (N, 4)
            data_cache[filepath] = arr
        except Exception as e:
            print(f"Error loading {filepath}: {e}")
            return None
    return data_cache[filepath]

def get_file_path(condition: str, file_name: str = None):
    """Resolves the exact file path from the dataset."""
    if file_name:
        # Check in both folders
        p_healthy = os.path.join(DATA_PATH, "Healthy Data", file_name)
        p_broken = os.path.join(DATA_PATH, "BrokenTooth Data", file_name)
        if os.path.exists(p_healthy):
            return p_healthy, "healthy"
        if os.path.exists(p_broken):
            return p_broken, "broken"

    folder = "Healthy Data" if condition in ["healthy", "misalignment", "wear"] else "BrokenTooth Data"
    path = os.path.join(DATA_PATH, folder)
    if not os.path.exists(path):
        return None, condition
    files = sorted(glob.glob(os.path.join(path, "*.txt")))
    if not files:
        return None, condition
    # Default to standard 30Hz 0% load file for smooth continuous baseline
    return files[0], condition

def extract_features(sensors):
    """Calculates RMS, Peak, Kurtosis, and Mean across 4 sensor channels."""
    features = {}
    for i, data in enumerate(sensors):
        arr = np.array(data)
        rms = float(np.sqrt(np.mean(arr**2)))
        peak = float(np.max(np.abs(arr)))
        # pandas kurtosis handles small samples robustly
        kurt = float(pd.Series(arr).kurtosis())
        if np.isnan(kurt):
            kurt = 3.0
        mean = float(np.mean(arr))
        features[f"sensor_{i+1}"] = {
            "rms": rms,
            "peak": peak,
            "kurtosis": kurt,
            "mean": mean
        }
    return features

# --------------------------------------------------------------------------
# API ENDPOINT: List Available Dataset Files
# --------------------------------------------------------------------------
@app.get("/api/files")
def get_available_files():
    """Returns list of real dataset files for user selection."""
    healthy_path = os.path.join(DATA_PATH, "Healthy Data")
    broken_path = os.path.join(DATA_PATH, "BrokenTooth Data")

    healthy_files = [os.path.basename(f) for f in sorted(glob.glob(os.path.join(healthy_path, "*.txt")))]
    broken_files = [os.path.basename(f) for f in sorted(glob.glob(os.path.join(broken_path, "*.txt")))]

    return {
        "healthy_files": healthy_files,
        "broken_files": broken_files
    }

# --------------------------------------------------------------------------
# API ENDPOINT: Main Dashboard Telemetry Stream
# --------------------------------------------------------------------------
@app.get("/api/dashboard")
def get_dashboard_data(sim_status: str = "healthy", file_name: str = None):
    """
    Streams consecutive time windows from the real dataset without random flickering.
    Advances smoothly along the timeline like a real-time DAQ oscilloscope.
    """
    filepath, actual_condition = get_file_path(sim_status, file_name)

    # Detect if user switched file or condition
    if filepath != stream_state["current_file"] or sim_status != stream_state["condition"]:
        stream_state["current_file"] = filepath
        stream_state["condition"] = sim_status
        stream_state["offset"] = 0

    window_size = 512
    step_size = 128  # Advance smoothly on every tick for continuous time-series flow

    if not filepath:
        # Fallback simulation if files missing
        t = np.linspace(0, 1, window_size)
        sensors = [(np.sin(2 * np.pi * 50 * t) + np.random.normal(0, 0.1, window_size)).tolist() for _ in range(4)]
        active_label = "Healthy"
        active_score = 98
    else:
        raw_arr = load_cached_array(filepath)
        if raw_arr is None or len(raw_arr) == 0:
            return {"error": "Failed to read dataset file"}

        total_len = len(raw_arr)
        curr_offset = stream_state["offset"] % max(1, (total_len - window_size - 1))
        stream_state["offset"] += step_size

        window = raw_arr[curr_offset : curr_offset + window_size]
        sensors = window.T.tolist()

        # Handle condition modifications
        if file_name and ("b" in file_name.lower() or "broken" in file_name.lower()):
            active_label = "Critical Fault: Broken Gear Tooth"
            active_score = 22
        elif file_name and ("h" in file_name.lower() or "healthy" in file_name.lower()):
            active_label = "Healthy — Optimal Operating Condition"
            active_score = 98
        elif sim_status == "wear":
            active_label = "Early Bearing Wear Detected"
            active_score = 64
            # Injects high-frequency wear acoustics onto real healthy sensor 1
            s = np.array(sensors[0]) + np.random.normal(0, 0.5, len(sensors[0]))
            sensors[0] = s.tolist()
        elif sim_status == "misalignment":
            active_label = "Gear & Shaft Misalignment Detected"
            active_score = 40
            # Superimposes 1X (30Hz) and 2X (60Hz) rotational harmonics onto real sensor 1
            s = np.array(sensors[0])
            t = np.linspace(0, len(s)/100000, len(s))
            s += 2.2 * np.sin(2 * np.pi * 30 * t) + 1.6 * np.sin(2 * np.pi * 60 * t)
            sensors[0] = s.tolist()
        elif sim_status == "broken":
            active_label = "Critical Fault: Broken Gear Tooth"
            active_score = 22
        else:
            active_label = "Healthy — Optimal Operating Condition"
            active_score = 98

    # Extract statistical engineering features from real readings
    features = extract_features(sensors)

    # Compute FFT on Sensor 1
    s1 = np.array(sensors[0])
    fft_vals = np.abs(np.fft.fft(s1))
    fft_freqs = np.fft.fftfreq(len(s1), d=1/100000)

    pos_mask = (fft_freqs > 0) & (fft_freqs < 2000)
    fft_y = fft_vals[pos_mask][:60].tolist()
    fft_x = fft_freqs[pos_mask][:60].tolist()

    return {
        "status": active_label,
        "health_score": active_score,
        "active_file": os.path.basename(filepath) if filepath else "Generated Baseline",
        "features": features,
        "waveforms": {
            "sensor1": sensors[0][:180],
            "sensor2": sensors[1][:180],
            "sensor3": sensors[2][:180],
            "sensor4": sensors[3][:180]
        },
        "fft": {
            "x": fft_x,
            "y": fft_y
        }
    }

# --------------------------------------------------------------------------
# API ENDPOINT: Custom User File Diagnostic Upload
# --------------------------------------------------------------------------
@app.post("/api/upload")
async def upload_diagnostic_file(file: UploadFile = File(...)):
    """
    Accepts an uploaded vibration dataset file (.txt / .csv), parses 4 accelerometer
    channels, calculates real-time engineering metrics, and produces an instant diagnostic verdict.
    """
    try:
        contents = await file.read()
        text_io = io.StringIO(contents.decode('utf-8', errors='ignore'))
        
        try:
            df = pd.read_csv(text_io, sep='\t', header=None, nrows=10000)
        except Exception:
            text_io.seek(0)
            df = pd.read_csv(text_io, delim_whitespace=True, header=None, nrows=10000)

        if df.shape[1] < 4:
            text_io.seek(0)
            df = pd.read_csv(text_io, sep=',', header=None, nrows=10000)

        data_arr = df.iloc[:, :4].dropna().values
        if len(data_arr) < 200:
            return {"error": "Uploaded file must contain at least 200 samples across 4 columns."}

        # Take first 512 samples for analysis
        sample_window = data_arr[:512]
        sensors = sample_window.T.tolist()
        features = extract_features(sensors)

        # Automated Diagnostic Classifier
        ch1_peak = features["sensor_1"]["peak"]
        ch1_kurt = features["sensor_1"]["kurtosis"]
        ch1_rms = features["sensor_1"]["rms"]

        if ch1_kurt > 4.2 or ch1_peak > 6.0:
            verdict = "Critical Fault: Broken Gear Tooth"
            score = 24
        elif ch1_kurt > 3.4 or ch1_rms > 8.0:
            verdict = "Early Bearing Wear Detected"
            score = 58
        else:
            verdict = "Healthy — Optimal Operating Condition"
            score = 96

        # FFT
        s1 = np.array(sensors[0])
        fft_vals = np.abs(np.fft.fft(s1))
        fft_freqs = np.fft.fftfreq(len(s1), d=1/100000)
        pos_mask = (fft_freqs > 0) & (fft_freqs < 2000)

        return {
            "status": verdict,
            "health_score": score,
            "active_file": file.filename,
            "features": features,
            "waveforms": {
                "sensor1": sensors[0][:180],
                "sensor2": sensors[1][:180],
                "sensor3": sensors[2][:180],
                "sensor4": sensors[3][:180]
            },
            "fft": {
                "x": fft_freqs[pos_mask][:60].tolist(),
                "y": fft_vals[pos_mask][:60].tolist()
            }
        }
    except Exception as e:
        return {"error": f"Failed to analyze file: {str(e)}"}

# --------------------------------------------------------------------------
# STATIC FILES MOUNT
# --------------------------------------------------------------------------
FRONTEND_PATH = os.path.join(os.path.dirname(__file__), '..', 'frontend')
if os.path.exists(FRONTEND_PATH):
    app.mount("/", StaticFiles(directory=FRONTEND_PATH, html=True), name="frontend")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
