import json
from datetime import datetime, timezone
from pathlib import Path
import requests

from collectors import FETCHERS
from config import NTFY_TOPIC, SOURCES

DATA_DIR = Path(__file__).parent / "data"
SEEN_FILE = DATA_DIR / "seen.json"
OPPORTUNITIES_FILE = DATA_DIR / "opportunities.json"
STATUS_FILE = DATA_DIR / "sources_status.json"

MAX_PER_CATEGORY = 15


def load_json(path: Path, default):
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    return default


def save_json(path: Path, data):
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def send_notification(title: str, message: str, url: str):
    if NTFY_TOPIC == "radar-comp-pessoal-altere-aqui":
        return
    try:
        requests.post(
            f"https://ntfy.sh/{NTFY_TOPIC}",
            data=message.encode("utf-8"),
            headers={
                "Title": title.encode("utf-8"),
                "Click": url,
            },
            timeout=10,
        )
    except requests.RequestException as exc:
        print(f"Erro ao enviar notificação: {exc}")


def collect() -> int:
    seen = set(load_json(SEEN_FILE, []))
    opportunities = []
    new_count = 0
    now = datetime.now(timezone.utc).isoformat()
    source_reports = []

    for source in SOURCES:
        if source.get("status") != "active":
            source_reports.append(
                {
                    "name": source["name"],
                    "status": source.get("status", "manual_only"),
                    "found_count": 0,
                    "approved_count": 0,
                    "error": None,
                    "notes": source.get("notes"),
                }
            )
            continue

        fetcher = FETCHERS.get(source["type"])
        if not fetcher:
            continue

        try:
            fetched, raw_count = fetcher(source)
            source_reports.append(
                {
                    "name": source["name"],
                    "status": "ok",
                    "found_count": raw_count,
                    "approved_count": len(fetched),
                    "error": None,
                }
            )
        except Exception as exc:
            print(f"Erro ao coletar {source['name']}: {exc}")
            source_reports.append(
                {
                    "name": source["name"],
                    "status": "error",
                    "found_count": 0,
                    "approved_count": 0,
                    "error": str(exc),
                }
            )
            continue

        for item in fetched:
            opportunities.append(item)
            if item["url"] not in seen:
                seen.add(item["url"])
                new_count += 1
                send_notification(
                    title=f"[{item['category'].upper()}] {item['organization']}",
                    message=item["title"],
                    url=item["url"],
                )

    unique = []
    urls_seen = set()
    counts = {}
    for item in opportunities:
        if item["url"] in urls_seen:
            continue
        cat = item.get("category", "outros")
        if counts.get(cat, 0) < MAX_PER_CATEGORY:
            unique.append(item)
            urls_seen.add(item["url"])
            counts[cat] = counts.get(cat, 0) + 1

    save_json(SEEN_FILE, list(seen))
    save_json(OPPORTUNITIES_FILE, unique[:120])
    save_json(
        STATUS_FILE,
        {
            "last_run": now,
            "total_sources": len(SOURCES),
            "active_sources": sum(1 for r in source_reports if r["status"] == "ok"),
            "sources": source_reports,
        },
    )
    print(f"Coleta finalizada. {new_count} nova(s). Total salvo: {len(unique[:120])}")
    return new_count


if __name__ == "__main__":
    collect()
