# Backend Run Guide

## Correct entrypoint
Use one of these commands from `/Users/ernarelubaj/Downloads/band up/backend`:

```bash
python main.py
```

or

```bash
uvicorn main:app --app-dir app --host 127.0.0.1 --port 5000 --reload
```

Both start the same FastAPI app (`backend/app/main.py`).

## Frontend dev proxy
Frontend (`localhost:8080`) proxies `/api` and `/materials` to `http://127.0.0.1:5000`.
So in development, browser requests stay same-origin and CORS issues are minimized.
