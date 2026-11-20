import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path
import feedparser
import requests

from config import ACTION_SIGNALS, NEWS_REJECT_SIGNALS, NTFY_TOPIC, SOURCES

DATA_DIR = Path(__file__).parent / "data"
SEEN_FILE = DATA_DIR / "seen.json"
OPPORTUNITIES_FILE = DATA_DIR / "opportunities.json"

HEADERS = {
    "User-Agent": "RadarComp/2.1 (+https://github.com/SaraMag25/radar-comp)"
}
MAX_PER_CATEGORY = 15


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


def make_id(url: str) -> str:
    return hashlib.sha256(url.encode("utf-8")).hexdigest()[:12]


def is_actionable_opportunity(text: str) -> bool:
    lowered = text.lower()
    if any(reject in lowered for reject in NEWS_REJECT_SIGNALS):
        return False
    return any(sig in lowered for sig in ACTION_SIGNALS)


def classify_opportunity(title: str, summary: str, default_category: str) -> str:
    text = f"{title} {summary}".lower()
    if any(k in text for k in ["hackathon"]):
        return "hackathons"
    if any(k in text for k in ["competição", "competicao", "maratona", "desafio de inovação", "challenge"]):
        return "competicoes"
    if any(k in text for k in ["estágio", "estagio", "internship", "intern ", "trainee", "vaga"]):
        return "estagios"
    if any(k in text for k in ["curso", "bootcamp", "capacitação", "capacitacao", "formação", "trilha"]):
        return "capacitacoes"
    if any(k in text for k in ["congresso", "simpósio", "simposio", "workshop", "call for papers", "cfp", "submissão"]):
        return "congressos"
    if any(k in text for k in ["edital", "chamada pública", "chamada publica"]):
        return "editais"
    if any(k in text for k in ["bolsa", "pibic", "pibiti", "scholarship", "fellowship"]):
        return "bolsas"
    if any(k in text for k in ["inovação aberta", "open innovation", "programa de talentos", "aceleração"]):
        return "empresas"
    if any(k in text for k in ["extensão", "extensao", "iniciação científica", "pesquisa"]):
        return "pesquisa"
    return default_category


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
    if any(w in t for w in ["taxa de inscrição", "pago"]):
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
    category: str,
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
        "category": category,
        "summary": summary[:220] + ("..." if len(summary) > 220 else ""),
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
    for h in data.get("hackathons", [])[:15]:
        url = h.get("url", "")
        title = clean_html(h.get("title", ""))
        if not url or not title:
            continue
        loc_info = h.get("displayed_location", {}) or {}
        loc_text = loc_info.get("location", "Online")
        modality = "online" if "online" in loc_text.lower() else "presencial"
        prize = clean_html(h.get("prize_amount", "")) or "Ver premiação no edital"
        themes = ", ".join(t.get("name", "") for t in h.get("themes", [])[:3] if t.get("name"))
        summary = f"Hackathon aberto ({loc_text}). Temas: {themes or 'Tecnologia e Inovação'}."
        items.append(
            build_item(
                title=title,
                url=url,
                summary=summary,
                source=source,
                category="hackathons",
                organization=h.get("organization_name") or "Devpost",
                eligibility_summary="Aberto ao público (verifique regras no link oficial).",
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
    for job in data[1:16]:
        url = job.get("url", "")
        title = clean_html(job.get("position", ""))
        if not url or not title:
            continue
        company = clean_html(job.get("company", "")) or "Empresa remota"
        tags = ", ".join(job.get("tags", [])[:4])
        desc = clean_html(job.get("description", ""))
        loc = clean_html(job.get("location", "")) or "Remoto"
        items.append(
            build_item(
                title=title,
                url=url,
                summary=f"{company} — {tags}. {desc}" if tags else desc,
                source=source,
                category="estagios",
                organization=company,
                eligibility_summary="Vaga remota; verifique requisitos no link oficial.",
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
    for job in data.get("jobs", [])[:15]:
        url = job.get("url", "")
        title = clean_html(job.get("title", ""))
        if not url or not title:
            continue
        company = clean_html(job.get("company_name", "")) or "Empresa remota"
        desc = clean_html(job.get("description", ""))
        loc = clean_html(job.get("candidate_required_location", "")) or "Remoto"
        items.append(
            build_item(
                title=title,
                url=url,
                summary=f"{company} ({loc}). {desc}",
                source=source,
                category="estagios",
                organization=company,
                eligibility_summary=f"Localização exigida: {loc}.",
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
        if source.get("strict_action_filter", True) and not is_actionable_opportunity(text_blob):
            continue
        category = classify_opportunity(title, summary, source["default_category"])
        items.append(
            build_item(
                title=title,
                url=link,
                summary=summary or "Confira os detalhes completos no link oficial.",
                source=source,
                category=category,
                eligibility_summary="Verifique os critérios no link oficial.",
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
    opportunities = []
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
            opportunities.append(item)
            if item["url"] not in seen:
                seen.add(item["url"])
                new_count += 1
                send_notification(
                    title=f"[{item['category'].upper()}] {item['organization']}",
                    message=item["title"],
                    url=item["url"],
                )

    # Deduplica por URL e equilibra por categoria
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
    print(f"Coleta finalizada. {new_count} nova(s). Total salvo: {len(unique[:120])}")
    return new_count


if __name__ == "__main__":
    collect()
