import re
from urllib.parse import urljoin
import feedparser
import requests

from .base import (
    HEADERS,
    build_item,
    classify_opportunity,
    clean_html,
    detect_status,
    infer_free,
    infer_modality,
    infer_remuneration,
    is_actionable_opportunity,
    is_generic_or_invalid_title,
)


def fetch_rss(source: dict) -> tuple[list[dict], int]:
    resp = requests.get(source["url"], headers=HEADERS, timeout=15)
    resp.raise_for_status()
    feed = feedparser.parse(resp.content)
    entries = feed.entries[:25]
    items = []
    for entry in entries:
        link = entry.get("link", "")
        title = clean_html(entry.get("title", ""))
        summary = clean_html(entry.get("summary", ""))
        if not link or not title or is_generic_or_invalid_title(title):
            continue
        text_blob = f"{title} {summary}"
        if source.get("strict_action_filter", True) and not is_actionable_opportunity(text_blob):
            continue
        status = detect_status(text_blob) if source.get("strict_action_filter", True) else "OPEN"
        if status not in ("OPEN", "UPCOMING"):
            continue
        category = classify_opportunity(title, summary, source["default_category"])
        items.append(
            build_item(
                title=title,
                url=link,
                summary=summary or "",
                source=source,
                category=category,
                eligibility_summary="Verifique os critérios no link oficial.",
                any_university=None,
                free=infer_free(text_blob),
                remuneration=infer_remuneration(text_blob),
                benefits="Ver chamada oficial",
                modality=infer_modality(text_blob),
                status=status,
            )
        )
    return items, len(entries)


def fetch_ifce_editais(source: dict) -> tuple[list[dict], int]:
    resp = requests.get(source["url"], headers=HEADERS, timeout=15)
    resp.raise_for_status()
    html = resp.text
    matches = re.findall(r'<a[^>]+href=["\']([^"\']+)["\'][^>]*>(.*?)</a>', html, flags=re.IGNORECASE | re.DOTALL)
    items = []
    seen_links = set()
    raw_count = 0

    for href, raw_text in matches:
        title = clean_html(raw_text)
        if is_generic_or_invalid_title(title):
            continue
        full_url = urljoin(source["url"], href)
        if full_url in seen_links or full_url.rstrip("/") == source["url"].rstrip("/"):
            continue
        if not is_actionable_opportunity(title):
            continue

        raw_count += 1
        seen_links.add(full_url)
        status = detect_status(title)
        if status not in ("OPEN", "UPCOMING"):
            continue

        category = classify_opportunity(title, "", source["default_category"])
        items.append(
            build_item(
                title=title,
                url=full_url,
                summary="",
                source=source,
                category=category,
                eligibility_summary="Consulte o edital oficial.",
                any_university=None,
                free=True,
                remuneration=infer_remuneration(title),
                benefits="Ver edital oficial",
                modality="não informada",
                status=status,
            )
        )
        if len(items) >= 10:
            break

    return items, raw_count
