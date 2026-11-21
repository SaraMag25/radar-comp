from datetime import datetime, timezone
import requests

from .base import HEADERS, build_item, clean_html


def fetch_devpost(source: dict) -> tuple[list[dict], int]:
    resp = requests.get(source["url"], headers=HEADERS, timeout=15)
    resp.raise_for_status()
    raw = resp.json().get("hackathons", [])[:15]
    items = []
    for h in raw:
        url = h.get("url", "")
        title = clean_html(h.get("title", ""))
        if not url or not title:
            continue
        loc_text = (h.get("displayed_location") or {}).get("location", "Online")
        modality = "online" if "online" in loc_text.lower() else "presencial"
        prize = clean_html(h.get("prize_amount", "")) or "Ver premiação no edital"
        themes = ", ".join(t.get("name", "") for t in h.get("themes", [])[:3] if t.get("name"))
        items.append(
            build_item(
                title=title,
                url=url,
                summary=f"Hackathon aberto ({loc_text}). Temas: {themes or 'Tecnologia e Inovação'}.",
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
    return items, len(raw)


def fetch_codeforces(source: dict) -> tuple[list[dict], int]:
    resp = requests.get(source["url"], headers=HEADERS, timeout=15)
    resp.raise_for_status()
    contests = resp.json().get("result", [])
    upcoming = [c for c in contests if c.get("phase") == "BEFORE"][:10]
    items = []
    for c in upcoming:
        cid = c.get("id")
        name = clean_html(c.get("name", ""))
        if not cid or not name:
            continue
        start_ts = c.get("startTimeSeconds")
        start_str = (
            datetime.fromtimestamp(start_ts, tz=timezone.utc).strftime("%d/%m/%Y %H:%M UTC")
            if start_ts
            else None
        )
        items.append(
            build_item(
                title=name,
                url=f"https://codeforces.com/contest/{cid}",
                summary=f"Competição de programação competitiva ({c.get('type', 'CF')}).",
                source=source,
                category="competicoes",
                organization="Codeforces",
                eligibility_summary="Aberto a qualquer participante com conta no Codeforces.",
                any_university=True,
                free=True,
                remuneration=False,
                benefits="Ranking / experiência em algoritmos",
                modality="online",
                location="Online",
                deadline=start_str,
                status="futura",
            )
        )
    return items, len(upcoming)


def fetch_remoteok(source: dict) -> tuple[list[dict], int]:
    resp = requests.get(source["url"], headers=HEADERS, timeout=15)
    resp.raise_for_status()
    raw = resp.json()[1:16]
    items = []
    for job in raw:
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
    return items, len(raw)


def fetch_remotive(source: dict) -> tuple[list[dict], int]:
    resp = requests.get(source["url"], headers=HEADERS, timeout=15)
    resp.raise_for_status()
    raw = resp.json().get("jobs", [])[:15]
    items = []
    for job in raw:
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
    return items, len(raw)
