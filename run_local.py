import os
import uvicorn
if __name__ == "__main__":
    # Force UTF-8 output (prevents UnicodeEncodeError on Windows consoles and uvicorn reload subprocesses).
    os.environ.setdefault("PYTHONUTF8", "1")
    os.environ.setdefault("PYTHONIOENCODING", "utf-8")
    uvicorn.run("main:app", host="127.0.0.1", port=8010, reload=True)
