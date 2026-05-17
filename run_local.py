from pathlib import Path

import uvicorn

BASE_DIR = Path(__file__).resolve().parent

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="127.0.0.1",
        port=8010,
        reload=True,
        reload_dirs=[str(BASE_DIR)],
        app_dir=str(BASE_DIR),
    )
