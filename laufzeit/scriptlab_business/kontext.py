"""Begrenzter Laufkontext und dauerhaftes Journal, ohne freie Befehlsausführung."""
from __future__ import annotations

from dataclasses import asdict, dataclass, fields
from copy import deepcopy
from datetime import datetime, timezone
import hashlib
from importlib.metadata import PackageNotFoundError, version
import json
import os
import re
import sys
from pathlib import Path
import tempfile
import time
from typing import Any, Callable
from uuid import UUID, uuid4


class BusinessFehler(ValueError):
    """Eine verständliche fachliche Ablehnung des aktuellen Schritts."""


class UnklarerZustand(BusinessFehler):
    """Ein früherer Effekt lässt sich nicht sicher als abgeschlossen einordnen."""


class AbbruchFehler(BusinessFehler):
    """Kooperativer Abbruch vor dem nächsten fachlichen Verarbeitungsschritt."""

    def __init__(self, meldung: str, *, grund: str = "abgebrochen"):
        super().__init__(meldung)
        self.grund = "zeitlimit" if grund == "zeitlimit" else "abgebrochen"


def daten_hash(wert: Any) -> str:
    daten = json.dumps(wert, ensure_ascii=True, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(daten.encode("utf-8")).hexdigest()


def runtime_hash_berechnen() -> str:
    """Inhalte und tatsächliche Versionen binden; Installationspfade bleiben außen vor."""
    paket = Path(__file__).resolve().parent
    quellen = []
    try:
        for quelle in sorted(paket.rglob("*.py"), key=lambda p: p.relative_to(paket).as_posix()):
            vorher = quelle.stat()
            inhalt = quelle.read_bytes()
            nachher = quelle.stat()
            if (vorher.st_size, vorher.st_mtime_ns) != (nachher.st_size, nachher.st_mtime_ns):
                raise BusinessFehler("Die Business-Laufzeit wurde während der Prüfung verändert. Starte den Lauf erneut.")
            quellen.append({"name": quelle.relative_to(paket).as_posix(), "sha256": hashlib.sha256(inhalt).hexdigest()})
        vera = paket / "schriften" / "Vera.ttf"
        vera_hash = hashlib.sha256(vera.read_bytes()).hexdigest() if vera.is_file() else None
    except OSError as fehler:
        raise BusinessFehler("Die installierte Business-Laufzeit konnte nicht vollständig geprüft werden.") from fehler
    pakete = {}
    for name in sorted(("duckdb", "openpyxl", "python-docx", "pypdf", "reportlab", "defusedxml",
                        "lxml", "pillow", "typing_extensions", "et-xmlfile", "charset-normalizer")):
        try:
            pakete[name] = version(name)
        except PackageNotFoundError:
            pakete[name] = None
    return daten_hash({"quellen": quellen, "python": sys.version, "pakete": pakete, "vera_sha256": vera_hash})


@dataclass(frozen=True)
class Grenzen:
    max_datei_bytes: int = 64 * 1024 * 1024
    max_entpackt_bytes: int = 256 * 1024 * 1024
    max_zip_eintraege: int = 5000
    max_zip_verhaeltnis: int = 200
    max_zeilen: int = 100000
    max_dokument_zellen: int = 20000
    max_seiten: int = 2000
    max_ausgaben: int = 1000
    max_temp_bytes: int = 4 * 1024 ** 3
    max_vorschau_zeilen: int = 200
    max_vorschau_bytes: int = 256 * 1024
    zeitlimit_sekunden: int = 120
    duckdb_speicher: str = "256MB"

    def __post_init__(self):
        for feld in fields(self):
            wert = getattr(self, feld.name)
            if feld.name == "duckdb_speicher":
                if not isinstance(wert, str) or not re.fullmatch(r"[1-9][0-9]{0,4}(MB|GB)", wert):
                    raise BusinessFehler("Die Speichergrenze muss beispielsweise 256MB lauten.")
            elif type(wert) is not int or wert <= 0:
                raise BusinessFehler("Alle Laufgrenzen müssen positive ganze Zahlen sein.")
        if self.max_vorschau_zeilen > 200 or self.max_vorschau_bytes > 256 * 1024:
            raise BusinessFehler("Die Vorschau darf höchstens 200 Zeilen und 256 KiB enthalten.")


class Journal:
    """JSONL unter exklusiver Betriebssystem-Dateisperre; nie Nutzdaten protokollieren."""
    def __init__(self, pfad: Path, workflow_hash: str, parameter_hash: str, fortsetzen: bool, runtime_hash: str = ""):
        self.pfad = pfad
        self.eintraege: dict[str, dict] = {}
        pfad.parent.mkdir(parents=True, exist_ok=True)
        self._sperre = open(str(pfad) + ".lock", "a+b")
        self._sperre.seek(0, 2)
        if self._sperre.tell() == 0:
            self._sperre.write(b"0")
            self._sperre.flush()
        self._sperre.seek(0)
        try:
            if os.name == "nt":
                import msvcrt
                msvcrt.locking(self._sperre.fileno(), msvcrt.LK_NBLCK, 1)
            else:
                import fcntl
                fcntl.flock(self._sperre.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        except OSError as fehler:
            self._sperre.close()
            raise BusinessFehler("Dieses Laufjournal wird bereits von einem anderen Prozess verwendet.") from fehler
        try:
            alt = []
            if pfad.exists():
                if pfad.stat().st_size > 16 * 1024 * 1024:
                    raise BusinessFehler("Das Laufjournal ist größer als 16 MiB.")
                text = pfad.read_text(encoding="utf-8")
                if text and not text.endswith("\n"):
                    raise UnklarerZustand("Das Journal endet unvollständig. Prüfe den letzten Dateischritt vor dem Fortsetzen.")
                try:
                    alt = [json.loads(zeile) for zeile in text.splitlines()]
                except (ValueError, TypeError) as fehler:
                    raise UnklarerZustand("Das Laufjournal ist beschädigt und wird nicht überschrieben.") from fehler
                if any(not isinstance(e, dict) or e.get("version") != 1 for e in alt):
                    raise UnklarerZustand("Das Laufjournal hat ein unbekanntes Format.")
            kopf = next((e for e in reversed(alt) if e.get("zustand") == "lauf"), None)
            if fortsetzen:
                if not kopf or kopf.get("workflow_hash") != workflow_hash or kopf.get("parameter_hash") != parameter_hash:
                    raise UnklarerZustand("Workflow oder Parameter passen nicht zum fortzusetzenden Journal.")
                if "runtime_hash" not in kopf:
                    raise UnklarerZustand("Das ältere Journal enthält keine Laufzeitidentität. Es wird unverändert erhalten; prüfe die Dateien und starte bewusst einen neuen Lauf.")
                if kopf["runtime_hash"] != runtime_hash:
                    raise UnklarerZustand("Die Business-Laufzeit, Python-Version oder Paket-/Schriftfassung hat sich seit dem ersten Lauf geändert. Das Journal wird nicht automatisch fortgesetzt.")
                self.lauf_id = kopf["lauf_id"]
                for eintrag in alt:
                    if eintrag.get("lauf_id") == self.lauf_id and "schluessel" in eintrag:
                        self.eintraege[eintrag["schluessel"]] = eintrag
                if any(e.get("zustand") in {"vorbereitet", "archiv_vorbereitet"} for e in self.eintraege.values()):
                    raise UnklarerZustand("Eine frühere Publikation wurde nicht bestätigt. Prüfe Ziel und Quelle; kein automatischer Neustart.")
            else:
                self.lauf_id = str(uuid4())
            self._datei = open(pfad, "a", encoding="utf-8", newline="\n")
            if not fortsetzen:
                self.schreiben("lauf", workflow_hash=workflow_hash, parameter_hash=parameter_hash, runtime_hash=runtime_hash)
        except BaseException:
            self._sperre.close()
            raise

    def schreiben(self, zustand: str, schluessel: str | None = None, **daten):
        eintrag = {"version": 1, "lauf_id": self.lauf_id, "zeit": datetime.now(timezone.utc).isoformat(), "zustand": zustand, **daten}
        if schluessel is not None:
            eintrag["schluessel"] = schluessel
        self._datei.write(json.dumps(eintrag, ensure_ascii=True, sort_keys=True) + "\n")
        self._datei.flush()
        os.fsync(self._datei.fileno())
        if schluessel is not None:
            self.eintraege[schluessel] = eintrag
        return eintrag

    def schliessen(self):
        if hasattr(self, "_datei"):
            self._datei.close()
        self._sperre.close()


class Kontext:
    def __init__(self, basis: str | Path, modus: str = "vorschau", parameter: dict | None = None,
                 grenzen: Grenzen | dict | None = None, journal_pfad: str | Path | None = None,
                 fortsetzen: bool = False, workflow_hash: str = "", ereignis_callback: Callable | None = None,
                 lauf_id: str | None = None, technischer_ordner: str | Path | None = None,
                 abbruch_datei: str | Path | None = None):
        if modus not in {"vorschau", "prueflauf", "ausfuehren"}:
            raise BusinessFehler("Der Business-Laufmodus ist ungültig.")
        self.basis = Path(basis).resolve()
        if not self.basis.is_dir():
            raise BusinessFehler("Der Business-Basisordner fehlt.")
        if parameter is not None and not isinstance(parameter, dict):
            raise BusinessFehler("Parameter müssen als benanntes Objekt übergeben werden.")
        self.modus = modus
        self.parameter = dict(parameter or {})
        self.grenzen = grenzen if isinstance(grenzen, Grenzen) else Grenzen(**(grenzen or {}))
        self.journal_pfad = Path(journal_pfad).resolve() if journal_pfad else None
        self.fortsetzen = bool(fortsetzen)
        self.workflow_hash = workflow_hash
        self.runtime_hash = runtime_hash_berechnen()
        try:
            self.lauf_id = str(UUID(lauf_id)) if lauf_id else str(uuid4())
        except (ValueError, TypeError) as fehler:
            raise BusinessFehler("Die Laufkennung ist ungültig.") from fehler
        self.gestartet_am = datetime.now(timezone.utc).isoformat()
        self.scriptdatei: str | None = None
        self.ereignis_callback = ereignis_callback
        self.dienste: dict[str, Any] = {}
        self.ergebnisse: dict[str, Any] = {}
        self.metadaten: dict[str, Any] = {}
        self.quellen: dict[str, dict] = {}
        self._tabellen_herkunft: dict[str, str] = {}
        self.fehler: list[dict] = []
        self.hinweise: list[dict] = []
        self.geplante_schritte: list[dict] = []
        self.token: str | None = None
        self.ausgaben: list[dict] = []
        self.block_id = ""
        self.schritt_key = ""
        self.aktion_hash = ""
        self._vorkommen: dict[str, int] = {}
        self._deadline = time.monotonic() + self.grenzen.zeitlimit_sekunden
        technisch = Path(technischer_ordner).resolve() if technischer_ordner else None
        if technisch:
            technisch.mkdir(parents=True, exist_ok=True)
        self._temp = tempfile.TemporaryDirectory(prefix="arbeitsdaten-" if technisch else "ScriptLab-Business-", dir=technisch)
        self.arbeitsordner = Path(self._temp.name)
        self.abbruch_datei = Path(abbruch_datei).resolve() if abbruch_datei else None
        self._abbruch_geprueft_am = 0.0
        self._journal: Journal | None = None
        self.abgebrochen = False

    @classmethod
    def aus_datei(cls, pfad: str | Path):
        quelle = Path(pfad)
        if quelle.stat().st_size > 1024 * 1024:
            raise BusinessFehler("Die Kontextdatei ist größer als 1 MiB.")
        daten = json.loads(quelle.read_text(encoding="utf-8"))
        if not isinstance(daten, dict) or daten.pop("version", None) != 1:
            raise BusinessFehler("Die Business-Kontextdatei hat ein unbekanntes Format.")
        erlaubt = {"basis", "modus", "parameter", "grenzen", "journal_pfad", "fortsetzen", "workflow_hash", "lauf_id", "technischer_ordner", "abbruch_datei"}
        if set(daten) - erlaubt or "basis" not in daten:
            raise BusinessFehler("Die Business-Kontextdatei enthält ungültige Angaben.")
        return cls(**daten)

    def pruefen(self):
        jetzt = time.monotonic()
        if self.abbruch_datei and jetzt - self._abbruch_geprueft_am >= .1:
            self._abbruch_geprueft_am = jetzt
            if self.abbruch_datei.exists():
                self.abgebrochen = True
        if self.abgebrochen:
            raise AbbruchFehler("Der Business-Lauf wurde abgebrochen.")
        if jetzt >= self._deadline:
            raise AbbruchFehler("Das Business-Zeitlimit wurde erreicht.", grund="zeitlimit")

    def quelle_merken(self, fingerprint: dict):
        """Nur fachliche Originale registrieren, niemals technische Prüfkopien."""
        schluessel = os.path.normcase(fingerprint["pfad"])
        vorher = self.quellen.get(schluessel)
        if vorher is not None:
            if any(vorher[feld] != fingerprint[feld] for feld in ("sha256", "bytes")):
                raise BusinessFehler("Eine bereits verwendete Originalquelle wurde während des Laufs verändert.")
        else:
            if len(self.quellen) >= 100000:
                raise BusinessFehler("Der Lauf enthält mehr als 100000 unterschiedliche Originalquellen.")
            self.quellen[schluessel] = deepcopy(fingerprint)

    def pfad(self, wert: str | Path, schreiben: bool = False) -> Path:
        self.pruefen()
        if not isinstance(wert, (str, Path)) or not str(wert).strip() or "\0" in str(wert):
            raise BusinessFehler("Gib einen vollständigen oder relativen Dateipfad an.")
        kandidat = Path(wert)
        if not kandidat.is_absolute():
            kandidat = self.basis / kandidat
        if kandidat.is_symlink():
            raise BusinessFehler("Symbolische Dateiverweise werden für Business-Dateien nicht verwendet.")
        return kandidat.resolve()

    def _fachliche_eingaben(self, wert):
        if isinstance(wert, dict):
            return {name: {"herkunft": self._tabellen_herkunft[inhalt]}
                    if name == "tabelle" and isinstance(inhalt, str) and inhalt in self._tabellen_herkunft
                    else self._fachliche_eingaben(inhalt) for name, inhalt in wert.items()}
        if isinstance(wert, list):
            return [self._fachliche_eingaben(eintrag) for eintrag in wert]
        return wert

    def tabellenherkunft_merke(self, ergebnis):
        if isinstance(ergebnis, dict) and isinstance(ergebnis.get("tabelle"), str):
            # Nur der feste Runner registriert tatsächlich erzeugte Tabellen. Zufällige
            # Lauf-Handles werden durch ihre fachliche Operationskette ersetzt.
            self._tabellen_herkunft[ergebnis["tabelle"]] = daten_hash({"aktion": self.aktion_hash, "spalten": ergebnis.get("spalten")})

    def beginn_schritt(self, block_id: str, konfiguration: dict, eingaben: dict, operation: str = ""):
        self.pruefen()
        self.block_id = block_id
        self._vorkommen[block_id] = self._vorkommen.get(block_id, 0) + 1
        self.schritt_key = f"{block_id}:{self._vorkommen[block_id]}"
        self.aktion_hash = daten_hash({"operation": operation, "konfiguration": konfiguration,
                                      "eingaben": self._fachliche_eingaben(eingaben)})

    def ereignis(self, art: str, **daten):
        if self.ereignis_callback:
            self.ereignis_callback({"art": art, "block_id": self.block_id, **daten})

    @property
    def journal(self):
        if self.modus != "ausfuehren":
            return None
        if self._journal is None:
            ordnername = self.workflow_hash if re.fullmatch(r"[a-fA-F0-9]{64}", self.workflow_hash) else daten_hash(self.workflow_hash)
            pfad = self.journal_pfad or self.basis / ".scriptlab" / ordnername / "journal.jsonl"
            self._journal = Journal(pfad, self.workflow_hash, daten_hash(self.parameter), self.fortsetzen, self.runtime_hash)
        return self._journal

    def ausgabe(self, ziel, regel="FEHLER", **optionen):
        from .dateien import ausgabe
        return ausgabe(self, ziel, regel, **optionen)

    def schliessen(self):
        try:
            for dienst in self.dienste.values():
                if callable(getattr(dienst, "schliessen", None)):
                    dienst.schliessen()
        finally:
            if self._journal:
                self._journal.schliessen()
            self._temp.cleanup()

    def __enter__(self):
        return self

    def __exit__(self, *fehler):
        self.schliessen()
