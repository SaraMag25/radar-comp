import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path
import feedparser
import requests

from config import KEYWORDS, NTFY_TOPIC, RSS_SOURCES

DATA_DIR = Path(__file__).parent / "data"
SEEN_FILE = DATA_DIR / "seen.json"
OPPORTUNITIES_FILE = DATA_DIR / "opportunities.json"


def load_json(path: Path, default):
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    return default


def save_json(path: Path, data):
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def clean_html(text: str) -> str:
    clean = re.sub(r"<[^>]+>", " ", text or "")
    return re.sub(r"\s+", " ", clean).strip()


def matches_keywords(text: str) -> bool:
    lowered = text.lower()
    return any(kw.lower() in lowered for kw in KEYWORDS)


def send_notification(title: str, message: str, url: str):
    if NTFY_TOPIC == "radar-comp-pessoal-altere-aqui":
        print(f"[NOTIFICAÇÃO SIMULADA] {title} -> {url}")
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
    opportunities = load_json(OPPORTUNITIES_FILE, [])
    new_count = 0

    for source in RSS_SOURCES:
        try:
            feed = feedparser.parse(source["url"])
        except Exception as exc:
            print(f"Erro ao ler {source['name']}: {exc}")
            continue

        for entry in feed.entries[:25]:
            link = entry.get("link", "")
            title = clean_html(entry.get("title", "Sem título"))
            summary = clean_html(entry.get("summary", ""))

            if not link or link in seen:
                continue

            if matches_keywords(f"{title} {summary}"):
                item_id = hashlib.sha256(link.encode("utf-8")).hexdigest()[:12]
                item = {
                    "id": item_id,
                    "title": title,
                    "summary": summary[:180] + ("..." if len(summary) > 180 else ""),
                    "url": link,
                    "source": source["name"],
                    "category": source["category"],
                    "collected_at": datetime.now(timezone.utc).isoformat(),
                }
                opportunities.insert(0, item)
                seen.add(link)
                new_count += 1
                send_notification(
                    title=f"[{source['category'].upper()}] {source['name']}",
                    message=title,
                    url=link,
                )

    save_json(SEEN_FILE, list(seen))
    save_json(OPPORTUNITIES_FILE, opportunities[:150])
    print(f"Coleta finalizada. {new_count} nova(s) oportunidade(s) encontrada(s).")
    return new_count


if __name__ == "__main__":
    collect()
