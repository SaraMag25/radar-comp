import hashlib
import re
from datetime import datetime, timezone

from config import ACTION_SIGNALS, CLOSED_SIGNALS, NEWS_REJECT_SIGNALS

HEADERS = {
    "User-Agent": "RadarComp/2.2 (+https://github.com/SaraMag25/radar-comp)"
}


def clean_html(text: str) -> str:
    clean = re.sub(r"<[^>]+>", " ", text or "")
    return re.sub(r"\s+", " ", clean).strip()


def make_id(url: str) -> str:
    return hashlib.sha256(url.encode("utf-8")).hexdigest()[:12]


def detect_status(text: str) -> str:
    lowered = text.lower()
    if any(sig in lowered for sig in CLOSED_SIGNALS):
        return "encerrada"
    return "aberta"


def is_actionable_opportunity(text: str) -> bool:
    lowered = text.lower()
    if detect_status(lowered) == "encerrada":
        return False
    if any(reject in lowered for reject in NEWS_REJECT_SIGNALS):
        return False
    return any(sig in lowered for sig in ACTION_SIGNALS)


def classify_opportunity(title: str, summary: str, default_category: str) -> str:
    text = f"{title} {summary}".lower()
    if any(k in text for k in ["hackathon"]):
        return "hackathons"
    if any(k in text for k in ["competição", "competicao", "maratona", "desafio de inovação", "challenge", "contest"]):
        return "competicoes"
    if any(k in text for k in ["estágio", "estagio", "internship", "intern ", "trainee", "vaga"]):
        return "estagios"
    if any(k in text for k in ["curso", "bootcamp", "capacitação", "capacitacao", "formação", "trilha"]):
        return "capacitacoes"
    if any(k in text for k in ["congresso", "simpósio", "simposio", "workshop", "call for papers", "cfp", "submissão"]):
        return "congressos"
    if any(k in text for k in ["bolsa", "pibic", "pibiti", "scholarship", "fellowship"]):
        return "bolsas"
    if any(k in text for k in ["edital", "chamada pública", "chamada publica"]):
        return "editais"
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
