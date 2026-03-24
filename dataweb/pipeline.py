import subprocess
import sys

def run(script_name: str):
    print(f"\n--- Running {script_name} ---")
    result = subprocess.run([sys.executable, script_name], capture_output=False)
    if result.returncode != 0:
        raise SystemExit(f"{script_name} failed with exit code {result.returncode}")

if __name__ == "__main__":
    # Order matters:
    # 1) update raw market data (data_updater.py) :contentReference[oaicite:2]{index=2}
    # 2) recompute engineered features into market_data_features :contentReference[oaicite:3]{index=3}
    # 3) recompute risk predictions into market_risk_predictions :contentReference[oaicite:4]{index=4}
    run("data_updater.py")
    run("feature_engineering.py")
    run("risk_engine.py")
    print("\nPipeline complete.")