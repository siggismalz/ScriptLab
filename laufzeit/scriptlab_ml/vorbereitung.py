"""Datenförmige, ausschließlich am Trainingsanteil gelernte Transformation."""
from __future__ import annotations

import math
from scriptlab_business.kontext import BusinessFehler

MAX_MERKMALE = 128
MAX_KATEGORIEN = 256
MAX_DIMENSIONEN = 4096


def numerisch(typ):
    return typ in {"TINYINT", "SMALLINT", "INTEGER", "BIGINT", "HUGEINT", "UTINYINT", "USMALLINT", "UINTEGER", "UBIGINT", "FLOAT", "DOUBLE"} or typ.startswith("DECIMAL(")


def zahl(wert):
    try:
        ergebnis = float(wert)
    except (ValueError, TypeError, OverflowError) as fehler:
        raise BusinessFehler("Ein numerisches ML-Merkmal enthält keine gültige Zahl.") from fehler
    if not math.isfinite(ergebnis):
        raise BusinessFehler("ML-Merkmale und Zielwerte müssen endliche Zahlen enthalten.")
    return ergebnis


def kategorie(wert):
    if wert is None:
        return None
    if not isinstance(wert, (str, bool, int, float)):
        raise BusinessFehler("Kategorische ML-Merkmale müssen Text oder einfache Wahrheits-/Zahlenwerte enthalten.")
    if isinstance(wert, float) and not math.isfinite(wert):
        raise BusinessFehler("ML-Merkmale dürfen keine unendlichen Werte enthalten.")
    return str(wert)


def lernen(zeilen, schema):
    ergebnis = []
    for index, spalte in enumerate(schema):
        werte = [z[index] for z in zeilen if z[index] is not None]
        if not werte:
            raise BusinessFehler(f"Das Merkmal „{spalte['name']}“ ist im Trainingsanteil vollständig leer.")
        if numerisch(spalte["typ"]):
            zahlen = [zahl(w) for w in werte]
            try:
                mittel = math.fsum(zahlen) / len(zahlen)
                skala = math.sqrt(math.fsum((w - mittel) ** 2 for w in zahlen) / len(zahlen)) or 1.0
            except (OverflowError, ValueError) as fehler:
                raise BusinessFehler("Die numerischen Merkmale überschreiten den unterstützten Zahlenbereich. Skaliere sie vor dem ML-Schritt.") from fehler
            ergebnis.append({**spalte, "art": "ZAHL", "mittel": mittel, "skala": skala})
        else:
            if spalte["typ"] not in {"VARCHAR", "BOOLEAN"}:
                raise BusinessFehler(f"Der ML-Datentyp von „{spalte['name']}“ wird nicht unterstützt. Wandle ihn vorher in Text oder Zahl um.")
            kategorien = sorted({kategorie(w) for w in werte})
            if len(kategorien) > MAX_KATEGORIEN:
                raise BusinessFehler(f"Das Merkmal „{spalte['name']}“ hat mehr als {MAX_KATEGORIEN} Trainingskategorien.")
            ergebnis.append({**spalte, "art": "KATEGORIE", "kategorien": kategorien})
    validieren(ergebnis)
    return ergebnis


def validieren(schema):
    if not isinstance(schema, list) or not 1 <= len(schema) <= MAX_MERKMALE:
        raise BusinessFehler("Das gespeicherte ML-Spaltenschema ist ungültig.")
    namen = []
    dimensionen = 0
    for s in schema:
        if not isinstance(s, dict) or not isinstance(s.get("name"), str) or not s["name"] or len(s["name"]) > 32768 or not isinstance(s.get("typ"), str):
            raise BusinessFehler("Das gespeicherte ML-Spaltenschema ist ungültig.")
        namen.append(s["name"].casefold())
        if s.get("art") == "ZAHL" and set(s) == {"name", "typ", "art", "mittel", "skala"}:
            if not numerisch(s["typ"]) or any(type(s[k]) not in {float, int} or not math.isfinite(s[k]) for k in ("mittel", "skala")) or s["skala"] <= 0:
                raise BusinessFehler("Die gespeicherte numerische ML-Transformation ist ungültig.")
            dimensionen += 1
        elif s.get("art") == "KATEGORIE" and set(s) == {"name", "typ", "art", "kategorien"}:
            k = s["kategorien"]
            if s["typ"] not in {"VARCHAR", "BOOLEAN"} or not isinstance(k, list) or not 1 <= len(k) <= MAX_KATEGORIEN or any(not isinstance(w, str) or len(w) > 32768 for w in k) or len(set(k)) != len(k):
                raise BusinessFehler("Die gespeicherten ML-Kategorien sind ungültig.")
            # Eine eigene Leerspalte unterscheidet fehlend von unbekannter Kategorie.
            dimensionen += len(k) + 1
        else:
            raise BusinessFehler("Die gespeicherte ML-Transformation ist unbekannt.")
    if len(set(namen)) != len(namen) or dimensionen > MAX_DIMENSIONEN:
        raise BusinessFehler(f"Das ML-Schema hat doppelte Namen oder mehr als {MAX_DIMENSIONEN} transformierte Merkmale.")
    return dimensionen


def transformieren(zeilen, schema):
    import numpy as np
    dimensionen = validieren(schema)
    matrix = np.zeros((len(zeilen), dimensionen), dtype=np.float32)
    offset = 0
    for index, s in enumerate(schema):
        if s["art"] == "ZAHL":
            for n, z in enumerate(zeilen):
                matrix[n, offset] = 0 if z[index] is None else (zahl(z[index]) - s["mittel"]) / s["skala"]
            offset += 1
        else:
            kategorien = {w: i for i, w in enumerate(s["kategorien"])}
            for n, z in enumerate(zeilen):
                wert = kategorie(z[index])
                platz = len(kategorien) if wert is None else kategorien.get(wert)
                if platz is not None:
                    matrix[n, offset + platz] = 1
            offset += len(kategorien) + 1
    if not np.isfinite(matrix).all():
        raise BusinessFehler("Die ML-Transformation überschreitet den unterstützten Zahlenbereich.")
    return matrix
