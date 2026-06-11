import os
import subprocess
import sys
from pathlib import Path

import uvicorn


ROOT = Path(__file__).resolve().parent
MODEL_FILES = (ROOT / "logistic_model.pkl", ROOT / "isolation_model.pkl")


def ensure_models():
    if all(model.exists() for model in MODEL_FILES):
        return
    subprocess.run([sys.executable, str(ROOT / "train.py")], cwd=ROOT, check=True)


if __name__ == "__main__":
    os.chdir(ROOT)
    ensure_models()
    uvicorn.run("main:app", host="127.0.0.1", port=8010, reload=True)
