from .api_collectors import (
    fetch_codeforces,
    fetch_devpost,
    fetch_remoteok,
    fetch_remotive,
)
from .base import (
    build_item,
    classify_opportunity,
    clean_html,
    detect_status,
    is_actionable_opportunity,
)
from .rss_collectors import fetch_ifce_editais, fetch_rss

FETCHERS = {
    "devpost_api": fetch_devpost,
    "remoteok_api": fetch_remoteok,
    "remotive_api": fetch_remotive,
    "codeforces_api": fetch_codeforces,
    "rss": fetch_rss,
    "ifce_html": fetch_ifce_editais,
}
