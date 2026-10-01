"""Language detection: English / Hindi / Gujarati (incl. romanized)."""
from __future__ import annotations

import re

GU_KEYS = ["tame", "tamaru", "tamaro", "tamari", "kem", "cho", "chho", "shu",
           "karo", "bhai", "majama", "kemcho", "kevo", "kevi", "avjo",
           "vagya", "tarikh", "majak", "kholu", "gano", "vaat", "maru", "che"]
HI_KEYS = ["aap", "tum", "kya", "hai", "hain", "kaise", "kaun", "mera",
           "meri", "namaste", "shukriya", "dhanyavad", "kitne", "baje",
           "tarikh", "aaj", "majak", "kholo", "gaana", "samay", "batao",
           "hai", "mein", "karo"]


def detect_lang(text: str) -> str:
    if re.search(r"[\u0A80-\u0AFF]", text):
        return "gu"
    if re.search(r"[\u0900-\u097F]", text):
        return "hi"
    t = text.lower()
    gu = sum(1 for k in GU_KEYS if k in t)
    hi = sum(1 for k in HI_KEYS if k in t)
    if gu > 0 and gu >= hi:
        return "gu"
    if hi > 0:
        return "hi"
    return "en"
