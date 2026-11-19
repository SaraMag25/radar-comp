from typing import Optional
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware

from collector import OPPORTUNITIES_FILE, collect, load_json

app = FastAPI(title="Radar Comp API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/opportunities")
def get_opportunities(category: Optional[str] = Query(default=None)):
    items = load_json(OPPORTUNITIES_FILE, [])
    if category and category != "todos":
        items = [item for item in items if item.get("category") == category]
    return {"count": len(items), "items": items}


@app.post("/collect")
def run_collect():
    new_count = collect()
    items = load_json(OPPORTUNITIES_FILE, [])
    return {"new_count": new_count, "total": len(items)}
