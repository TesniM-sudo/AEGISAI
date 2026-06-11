import os
import subprocess
import sys
from pathlib import Path

import uvicorn

BASE_DIR = Path(__file__).resolve().parent
MODEL_FILES = (BASE_DIR / "logistic_model.pkl", BASE_DIR / "isolation_model.pkl")


def ensure_models():
    if all(model.exists() for model in MODEL_FILES):
        return
    subprocess.run([sys.executable, str(BASE_DIR / "train.py")], cwd=BASE_DIR, check=True)


if __name__ == "__main__":
    os.chdir(BASE_DIR)
    ensure_models()
    uvicorn.run(
        "main:app",
        host="127.0.0.1",
        port=8010,
        reload=True,
        reload_dirs=[str(BASE_DIR)],
        app_dir=str(BASE_DIR),
    )
