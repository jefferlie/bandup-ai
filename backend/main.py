import uvicorn
from pathlib import Path


def main() -> None:
    backend_dir = Path(__file__).resolve().parent
    uvicorn.run(
        "main:app",
        app_dir=str(backend_dir / "app"),
        host="127.0.0.1",
        port=5000,
        reload=True,
    )


if __name__ == "__main__":
    main()
