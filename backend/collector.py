import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path
import feedparser
import requests

from config import KEYWORDS, NTFY_TOPIC, SOURCES

DATA_DIR = Path(__file__).parent / "data"
SEEN_FILE = DATA_DIR / "seen.json"
OPPORTUNITIES_FILE = DATA_DIR / "opportunities.json"

HEADERS = {
    "User-Agent": "RadarComp/2.0 (+https://github.com/SaraMag25/radar-comp)"
}
MAX_PER_CATEGORY = 25


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


def make_id(url: str) -> str:
    return hashlib.sha256(url.encode("utf-8")).hexdigest()[:12]


def infer_modality(text: str, default: str = "não informada") -> str:
    t = text.lower()
    if any(w in t for w in ["online", "remote", "remoto", "virtual", "ead"]):
        return "online"
    if any(w in t for w in ["híbrido", "hibrido", "hybrid"]):
        return "híbrida"
    if any(w in t for w in ["presencial", "in-person", "onsite"]):
        return "presencial"
    return default


def infer_free(text: str, default=None):
    t = text.lower()
    if any(w in t for w in ["gratuito", "gratuita", "grátis", "free", "sem custo"]):
        return True
    if any(w in t for w in ["taxa de inscrição", "paid", "pago"]):
        return False
    return default


def infer_remuneration(text: str, default=None):
    t = text.lower()
    if any(w in t for w in ["bolsa", "remunerad", "salário", "salary", "prize", "prêmio", "$", "r$"]):
        return True
    return default


def build_item(
    *,
    title: str,
    url: str,
    summary: str,
    source: dict,
    organization: str = None,
    eligibility_summary: str = "Não informado na fonte — verifique o link oficial.",
    any_university=None,
    free=None,
    remuneration=None,
    benefits: str = "Não informado",
    modality: str = "não informada",
    location: str = None,
    deadline: str = None,
    status: str = "aberta",
    action_label: str = None,
) -> dict:
    now = datetime.now(timezone.utc).isoformat()
    return {
        "id": make_id(url),
        "title": title,
        "organization": organization or source.get("organization", source["name"]),
        "category": source["category"],
        "summary": summary[:260] + ("..." if len(summary) > 260 else ""),
        "url": url,
        "source": source["name"],
        "action_label": action_label or source.get("action_label", "Ver oportunidade"),
        "eligibility": {
            "summary": eligibility_summary,
            "any_university": any_university,
            "free": free,
            "remuneration": remuneration,
            "benefits": benefits,
        },
        "modality": modality,
        "location": location or source.get("location") or ("Internacional" if source["scope"] == "internacional" else "Brasil"),
        "scope": source["scope"],
        "area": source.get("area", "Multidisciplinar"),
        "deadline": deadline,
        "status": status,
        "language": source.get("language", "pt"),
        "collected_at": now,
        "last_verified_at": now,
    }


def fetch_devpost(source: dict) -> list[dict]:
    resp = requests.get(source["url"], headers=HEADERS, timeout=15)
    resp.raise_for_status()
    data = resp.json()
    items = []
    for h in data.get("hackathons", [])[:20]:
        url = h.get("url", "")
        title = clean_html(h.get("title", ""))
        if not url or not title:
            continue
        loc_info = h.get("displayed_location", {}) or {}
        loc_text = loc_info.get("location", "Online")
        modality = "online" if "online" in loc_text.lower() else "presencial"
        prize = clean_html(h.get("prize_amount", "")) or "Prêmios / certificados (ver edital)"
        themes = ", ".join(t.get("name", "") for t in h.get("themes", [])[:4] if t.get("name"))
        summary = f"Hackathon aberto ({loc_text}). Temas: {themes or 'Tecnologia e Inovação'}."
        items.append(
            build_item(
                title=title,
                url=url,
                summary=summary,
                source=source,
                organization=h.get("organization_name") or "Devpost",
                eligibility_summary="Aberto ao público (verifique regras de idade/país no link oficial).",
                any_university=True,
                free=True,
                remuneration=True,
                benefits=prize,
                modality=modality,
                location=loc_text,
                deadline=h.get("submission_period_dates"),
                status="aberta",
            )
        )
    return items


def fetch_remoteok(source: dict) -> list[dict]:
    resp = requests.get(source["url"], headers=HEADERS, timeout=15)
    resp.raise_for_status()
    data = resp.json()
    items = []
    for job in data[1:25]:
        url = job.get("url", "")
        title = clean_html(job.get("position", ""))
        if not url or not title:
            continue
        company = clean_html(job.get("company", "")) or "Empresa remota"
        tags = ", ".join(job.get("tags", [])[:5])
        desc = clean_html(job.get("description", ""))
        if source.get("filter_keywords") and not matches_keywords(f"{title} {tags} {desc}"):
            continue
        loc = clean_html(job.get("location", "")) or "Remoto"
        items.append(
            build_item(
                title=title,
                url=url,
                summary=f"{company} — Tags: {tags}. {desc}" if tags else desc,
                source=source,
                organization=company,
                eligibility_summary="Vaga remota; verifique requisitos técnicos e fuso/país.",
                any_university=True,
                free=True,
                remuneration=True,
                benefits="Remuneração (ver vaga)",
                modality="online",
                location=loc,
                status="aberta",
            )
        )
    return items


def fetch_remotive(source: dict) -> list[dict]:
    resp = requests.get(source["url"], headers=HEADERS, timeout=15)
    resp.raise_for_status()
    data = resp.json()
    items = []
    for job in data.get("jobs", [])[:25]:
        url = job.get("url", "")
        title = clean_html(job.get("title", ""))
        if not url or not title:
            continue
        company = clean_html(job.get("company_name", "")) or "Empresa remota"
        desc = clean_html(job.get("description", ""))
        if source.get("filter_keywords") and not matches_keywords(f"{title} {desc}"):
            continue
        loc = clean_html(job.get("candidate_required_location", "")) or "Remoto"
        items.append(
            build_item(
                title=title,
                url=url,
                summary=f"{company} ({loc}). {desc}",
                source=source,
                organization=company,
                eligibility_summary=f"Restrição geográfica: {loc}. Verifique requisitos no link.",
                any_university=True,
                free=True,
                remuneration=True,
                benefits=job.get("salary") or "Remuneração (ver vaga)",
                modality="online",
                location=loc,
                status="aberta",
            )
        )
    return items


def fetch_rss(source: dict) -> list[dict]:
    resp = requests.get(source["url"], headers=HEADERS, timeout=15)
    resp.raise_for_status()
    feed = feedparser.parse(resp.content)
    items = []
    for entry in feed.entries[:25]:
        link = entry.get("link", "")
        title = clean_html(entry.get("title", ""))
        summary = clean_html(entry.get("summary", ""))
        if not link or not title:
            continue
        text_blob = f"{title} {summary}"
        if source.get("filter_keywords") and not matches_keywords(text_blob):
            continue
        items.append(
            build_item(
                title=title,
                url=link,
                summary=summary or "Confira os detalhes completos no link oficial.",
                source=source,
                eligibility_summary="Não informado no feed — consulte o edital/chamada oficial.",
                any_university=None,
                free=infer_free(text_blob),
                remuneration=infer_remuneration(text_blob),
                benefits="Ver chamada oficial",
                modality=infer_modality(text_blob),
                status="aberta",
            )
        )
    return items


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
    existing = load_json(OPPORTUNITIES_FILE, [])
    # Mantém apenas itens já no novo formato (com organization) para limpar feed antigo só de artigos
    opportunities = [item for item in existing if isinstance(item, dict) and "organization" in item]
    new_count = 0

    fetchers = {
        "devpost_api": fetch_devpost,
        "remoteok_api": fetch_remoteok,
        "remotive_api": fetch_remotive,
        "rss": fetch_rss,
    }

    for source in SOURCES:
        fetcher = fetchers.get(source["type"])
        if not fetcher:
            continue
        try:
            fetched = fetcher(source)
        except Exception as exc:
            print(f"Erro ao coletar {source['name']}: {exc}")
            continue

        for item in fetched:
            if item["url"] in seen:
                continue
            opportunities.insert(0, item)
            seen.add(item["url"])
            new_count += 1
            send_notification(
                title=f"[{item['category'].upper()}] {item['organization']}",
                message=item["title"],
                url=item["url"],
            )

    # Equilibra por categoria para nenhuma dominar
    balanced = []
    counts = {}
    for item in opportunities:
        cat = item.get("category", "outros")
        if counts.get(cat, 0) < MAX_PER_CATEGORY:
            balanced.append(item)
            counts[cat] = counts.get(cat, 0) + 1

    save_json(SEEN_FILE, list(seen))
    save_json(OPPORTUNITIES_FILE, balanced[:150])
    print(f"Coleta finalizada. {new_count} nova(s) oportunidade(s) encontrada(s). Total salvo: {len(balanced[:150])}")
    return new_count


if __name__ == "__main__":
    collect()
