"""Kleine öffentliche Datentypen der lokalen Business-Datenengine."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any
from .kontext import BusinessFehler


class DatenFehler(BusinessFehler):
    """Verständlicher Datenfehler; der Runner ergänzt die betroffene Block-ID."""


@dataclass(frozen=True)
class Spalte:
    name: str
    typ: str


@dataclass(frozen=True)
class Tabelle:
    """Opaker Verweis, keine materialisierte Liste und kein ausführbarer SQL-Text."""

    id: str
    spalten: tuple[Spalte, ...]

    def json(self) -> dict[str, Any]:
        return {"tabelle": self.id, "spalten": [{"name": s.name, "typ": s.typ} for s in self.spalten]}


@dataclass(frozen=True)
class MLModell:
    """Lauflokaler Verweis; Schätzer, Gewichte und Trainingsdaten verlassen die Laufzeit nicht."""

    id: str
    aufgabe: str
    verfahren: str
    merkmale: tuple[str, ...]
    zielspalte: str
    metriken: dict

    def json(self) -> dict[str, Any]:
        return {"ml_modell": self.id, "aufgabe": self.aufgabe, "verfahren": self.verfahren,
                "merkmale": list(self.merkmale), "zielspalte": self.zielspalte, "metriken": self.metriken}


# Diese Bezeichnungen sind zugleich der feste Vertrag mit dem Blockly-Katalog.
FORMATE = ("CSV", "XLSX", "JSON", "PARQUET")
KONFLIKTE = ("FEHLER", "ERSETZEN", "UEBERSPRINGEN", "NEUER_NAME")
DATENTYPEN = ("TEXT", "GANZZAHL", "DEZIMAL", "ZAHL", "WAHRHEIT", "DATUM", "ZEITSTEMPEL")
VERGLEICHE = ("EQ", "NE", "GT", "GE", "LT", "LE", "ENTHAELT", "BEGINNT", "ENDET", "IN", "IST_LEER", "IST_NICHT_LEER")
AGGREGATE = ("ANZAHL", "ANZAHL_WERTE", "ANZAHL_VERSCHIEDEN", "SUMME", "MITTELWERT", "MIN", "MAX")
PRUEFUNGEN = ("NICHT_LEER", "EINDEUTIG", "BEREICH", "TYP", "ERLAUBTE_WERTE", "ZEILENZAHL")


def objekt(wert: Any, name: str) -> dict:
    if not isinstance(wert, dict) or any(not isinstance(k, str) for k in wert):
        raise DatenFehler(f"{name} muss ein Objekt mit benannten Feldern sein.")
    return wert


def text(wert: Any, name: str, *, leer: bool = False) -> str:
    if not isinstance(wert, str) or (not leer and not wert.strip()) or "\x00" in wert:
        raise DatenFehler(f"Gib einen gültigen Wert für {name} an.")
    return wert


def auswahl(wert: Any, erlaubt: tuple[str, ...], name: str) -> str:
    if wert not in erlaubt:
        raise DatenFehler(f"Die Einstellung {name} ist nicht zulässig.")
    return wert
