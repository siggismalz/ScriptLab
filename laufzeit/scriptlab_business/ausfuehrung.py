"""Fester Opcode-Runner für denselben Workflow im Editor und im Export."""
from __future__ import annotations

import argparse
import errno
import hashlib
from datetime import date, datetime, timezone
from importlib.metadata import version, PackageNotFoundError
import json
import math
import os
from pathlib import Path
import re
import sys
import tempfile

from .kontext import AbbruchFehler, BusinessFehler, Kontext, UnklarerZustand, daten_hash

REINE_OPERATIONEN = {
    "daten.importieren", "daten.spalten", "daten.werte", "daten.filtern", "daten.sortieren",
    "daten.dubletten", "daten.vereinigen", "daten.verknuepfen", "daten.gruppieren",
    "daten.pruefen", "daten.vorschau", "dateien.stapel", "dokument.pdf_text",
    "ml.laden", "ml.vorhersagen",
}


def _handler():
    from .daten import HANDLER as daten
    from .dateien import HANDLER as dateien
    try:
        from .dokumente import HANDLER as dokumente
    except ImportError:
        dokumente = {}
    def ml(operation):
        def aufrufen(kontext, konfiguration, eingaben):
            try:
                from scriptlab_ml.verarbeitung import HANDLER
                return HANDLER[operation](kontext, konfiguration, eingaben)
            except ImportError as fehler:
                raise BusinessFehler("Das optionale ML-Profil fehlt oder ist unvollständig. Richte es in den Einstellungen bewusst ein.") from fehler
        return aufrufen
    return {**daten, **dateien, **dokumente,
            **{op: ml(op) for op in ("ml.trainieren", "ml.speichern", "ml.laden", "ml.vorhersagen")}}


def _geplante_eingabe(wert):
    if isinstance(wert, dict):
        ml = wert.get("ml_geplant") is True or str(wert.get("operation", "")).startswith("ml.")
        return (wert.get("status") == "geplant" and ml) or any(_geplante_eingabe(v) for v in wert.values())
    return isinstance(wert, list) and any(_geplante_eingabe(v) for v in wert)


def _io_meldung(fehler: OSError) -> str:
    windows = getattr(fehler, "winerror", None)
    if windows in {53, 64, 121}:
        return "Der Netzwerkpfad ist nicht erreichbar oder die Verbindung wurde unterbrochen. Prüfe die Verbindung und den freigegebenen Ordner."
    if fehler.errno == errno.ENOSPC or windows == 112:
        return "Auf dem Datenträger ist nicht genügend freier Speicherplatz. Gib Speicherplatz frei oder wähle ein anderes Ziel."
    if windows in {32, 33}:
        return "Die Datei ist durch ein anderes Programm gesperrt. Schließe sie dort und versuche den Schritt erneut."
    if fehler.errno in {errno.EACCES, errno.EPERM} or windows == 5:
        return "Der Zugriff auf die Datei oder den Ordner wurde verweigert. Prüfe Berechtigungen und Schreibschutz."
    return "Die Dateioperation ist fehlgeschlagen. Prüfe Pfad, Datenträger und Verbindung."


def _aufloesen(wert, kontext: Kontext, referenzen=False, tiefe=0):
    if tiefe > 40:
        raise BusinessFehler("Die Parameter- oder Verweisstruktur ist zu tief verschachtelt.")
    if isinstance(wert, dict):
        if set(wert) == {"parameter"}:
            name = wert["parameter"]
            if not isinstance(name, str) or name not in kontext.parameter:
                raise BusinessFehler(f"Der Parameter fehlt: {name}")
            return kontext.parameter[name]
        if referenzen and set(wert) == {"referenz"}:
            name = wert["referenz"]
            if not isinstance(name, str) or name not in kontext.ergebnisse:
                raise BusinessFehler("Ein benötigtes vorheriges Schrittergebnis fehlt.")
            return kontext.ergebnisse[name]
        return {k: _aufloesen(v, kontext, referenzen, tiefe + 1) for k, v in wert.items()}
    if isinstance(wert, list):
        return [_aufloesen(v, kontext, referenzen, tiefe + 1) for v in wert]
    if wert is None or type(wert) in {str, bool, int, float}:
        return wert
    raise BusinessFehler("Eine Eingabe enthält keinen erlaubten JSON-Wert.")


def schritt(kontext: Kontext, id: str, operation: str, konfiguration: dict, eingaben: dict):
    if not isinstance(id, str) or not id or len(id) > 160 or not isinstance(konfiguration, dict) or not isinstance(eingaben, dict):
        raise BusinessFehler("Der Business-Schritt enthält ungültige Angaben.")
    handler = _handler()
    if not isinstance(operation, str) or operation not in handler:
        raise BusinessFehler(f"Die Business-Operation wird nicht unterstützt: {operation}")
    k = _aufloesen(konfiguration, kontext)
    e = _aufloesen(eingaben, kontext, True)
    kontext.beginn_schritt(id, k, e, operation)
    kontext.ereignis("schritt", operation=operation, status="begonnen")
    try:
        if operation == "daten.exportieren" and k.get("pfad") == "" and konfiguration.get("pfad") != "":
            raise BusinessFehler("Der Parameter für den Speicherort ist leer. Gib einen Dateipfad an oder wähle im Baustein den automatischen Speicherort.")
        if ((kontext.modus == "vorschau" and operation not in REINE_OPERATIONEN)
                or (kontext.modus != "ausfuehren" and (_geplante_eingabe(e)
                    or operation in {"ml.trainieren", "ml.speichern"}))):
            ergebnis = {"status": "geplant", "operation": operation}
            if operation.startswith("ml.") or _geplante_eingabe(e):
                ergebnis["ml_geplant"] = True
            kontext.geplante_schritte.append({"id": id, "operation": operation})
        else:
            ergebnis = handler[operation](kontext, k, e)
        if operation.startswith(("daten.", "ml.")):
            kontext.tabellenherkunft_merke(ergebnis)
        kontext.ergebnisse[id] = ergebnis
        if isinstance(ergebnis, dict) and ergebnis.get("gueltig") is False:
            kontext.fehler.append({"block_id": id, "meldung": "Eine fachliche Datenprüfung enthält Fehler."})
        kontext.ereignis("schritt", operation=operation, status="beendet", ergebnis=ergebnis)
        return ergebnis
    except Exception as fehler:
        fachlich = BusinessFehler(_io_meldung(fehler)) if isinstance(fehler, OSError) else fehler
        technisch = {"technisch": f"{type(fehler).__name__}: {fehler}; errno={fehler.errno}; winerror={getattr(fehler, 'winerror', None)}"} if isinstance(fehler, OSError) else {}
        kontext.fehler.append({"block_id": id, "meldung": str(fachlich), "unklar": isinstance(fehler, UnklarerZustand), **technisch})
        kontext.ereignis("fehler", operation=operation, meldung=str(fachlich), unklar=isinstance(fehler, UnklarerZustand), **technisch)
        if fachlich is not fehler:
            raise fachlich from fehler
        raise


def ausfuehren(plan: dict, kontext: Kontext):
    if not isinstance(plan, dict) or plan.get("version") != 1 or set(plan) != {"version", "schritte"}:
        raise BusinessFehler("Der Business-Plan hat ein unbekanntes Format.")
    schritte = plan["schritte"]
    if not isinstance(schritte, list) or len(schritte) > 2000:
        raise BusinessFehler("Der Business-Plan enthält zu viele Schritte.")
    kontext.workflow_hash = kontext.workflow_hash or daten_hash(plan)
    ids = set()
    for eintrag in schritte:
        if (not isinstance(eintrag, dict) or set(eintrag) != {"id", "operation", "konfiguration", "eingaben"}
                or not isinstance(eintrag["id"], str) or not eintrag["id"] or len(eintrag["id"]) > 160 or eintrag["id"] in ids):
            raise BusinessFehler("Ein Planschritt ist ungültig oder seine Kennung doppelt.")
        ids.add(eintrag["id"])
    for eintrag in schritte:
        schritt(kontext, **eintrag)
    return {"status": "mit_fehlern" if kontext.fehler else "erfolgreich", "ergebnisse": kontext.ergebnisse, "ausgaben": kontext.ausgaben}


def _parameter_pruefen(definitionen, werte):
    bekannt = {definition["name"] for definition in definitionen}
    if set(werte) - bekannt:
        raise BusinessFehler("Die Parameterdatei enthält unbekannte Parameternamen.")
    for definition in definitionen:
        name = definition["name"]
        wert = werte.get(name, definition.get("standard"))
        if definition.get("erforderlich") and (wert is None or wert == ""):
            raise BusinessFehler(f"Der erforderliche Parameter fehlt: {name}")
        if wert is None or wert == "":
            werte[name] = None
            continue
        if wert is not None:
            typ = definition["typ"]
            if typ == "Wahrheitswert" and type(wert) is not bool:
                raise BusinessFehler(f"Der Parameter {name} benötigt wahr oder falsch.")
            if typ == "Zahl":
                try:
                    gueltig = type(wert) in {int, float} and math.isfinite(wert)
                except OverflowError:
                    gueltig = False
                if not gueltig:
                    raise BusinessFehler(f"Der Parameter {name} benötigt eine endliche Zahl.")
            if typ not in {"Zahl", "Wahrheitswert"} and not isinstance(wert, str):
                raise BusinessFehler(f"Der Parameter {name} benötigt Text.")
            if typ == "Dezimalbetrag" and not re.fullmatch(r"[+-]?[0-9]+(?:\.[0-9]+)?", wert):
                raise BusinessFehler(f"Der Parameter {name} benötigt einen exakten Dezimalbetrag mit Punkt.")
            if typ == "Datum":
                try:
                    if not re.fullmatch(r"[0-9]{4}-[0-9]{2}-[0-9]{2}", wert):
                        raise ValueError()
                    date.fromisoformat(wert)
                except ValueError as fehler:
                    raise BusinessFehler(f"Der Parameter {name} benötigt ein gültiges Datum im Format JJJJ-MM-TT.") from fehler
        werte[name] = wert


def kontext_laden(scriptdatei, metadaten: dict, token=None):
    basis_script = Path(scriptdatei).resolve().parent
    if token is not None:
        pfad = basis_script / "scriptlab-kontext.json"
        daten = json.loads(pfad.read_text(encoding="utf-8"))
        if not isinstance(daten, dict) or daten.pop("version", None) != 1:
            raise BusinessFehler("Die technische Business-Kontextdatei ist ungültig.")
        erlaubt = {"basis", "modus", "parameter", "grenzen", "journal_pfad", "fortsetzen", "workflow_hash", "lauf_id", "technischer_ordner", "abbruch_datei", "ausgabe_wurzel", "ml_aktiv"}
        if set(daten) - erlaubt:
            raise BusinessFehler("Die technische Kontextdatei enthält unbekannte Angaben.")
        kontext = Kontext(**daten)
    else:
        parser = argparse.ArgumentParser(description="ScriptLab-Business-Workflow")
        parser.add_argument("--parameter-datei", type=Path)
        parser.add_argument("--basis", type=Path, default=basis_script)
        parser.add_argument("--modus", choices=("vorschau", "prueflauf", "ausfuehren"), default="ausfuehren")
        parser.add_argument("--journal", type=Path)
        parser.add_argument("--fortsetzen", action="store_true")
        parser.add_argument("--zeitlimit", type=int, default=7200)
        parser.add_argument("--speicher-mb", type=int, default=512)
        parser.add_argument("--temp-gb", type=int, default=4)
        parser.add_argument("--max-datei-mib", type=int, default=16384)
        optionen = parser.parse_args()
        if not 64 <= optionen.speicher_mb <= 8192 or not 1 <= optionen.temp_gb <= 100 or not 1 <= optionen.max_datei_mib <= 65536:
            raise BusinessFehler("Wähle 64–8192 MiB DuckDB-Speicher, 1–100 GiB Temp und höchstens 65536 MiB je Quelldatei.")
        parameter = dict(metadaten.get("standard_parameter", {}))
        if optionen.parameter_datei:
            if optionen.parameter_datei.stat().st_size > 1024 * 1024:
                raise BusinessFehler("Die Parameterdatei ist größer als 1 MiB.")
            benutzer = json.loads(optionen.parameter_datei.read_text(encoding="utf-8"))
            if not isinstance(benutzer, dict):
                raise BusinessFehler("Die Parameterdatei muss ein JSON-Objekt enthalten.")
            parameter.update(benutzer)
        grenzen = {"zeitlimit_sekunden": optionen.zeitlimit, "duckdb_speicher": f"{optionen.speicher_mb}MB",
                   "max_temp_bytes": optionen.temp_gb * 1024 ** 3, "max_datei_bytes": optionen.max_datei_mib * 1024 ** 2,
                   "max_ausgaben": 100000, "max_zeilen": 1048575}
        kontext = Kontext(optionen.basis, optionen.modus, parameter, grenzen, optionen.journal, optionen.fortsetzen, metadaten.get("workflow_hash", ""), ml_aktiv=metadaten.get("workflow_art") == "ml")
    _parameter_pruefen(metadaten.get("parameter", []), kontext.parameter)
    # Export-Wiederaufnahme ist an die tatsächlich gestartete Scriptfassung gebunden.
    if token is None or not kontext.workflow_hash:
        kontext.workflow_hash = hashlib.sha256(Path(scriptdatei).resolve().read_bytes()).hexdigest()
    kontext.token = token
    kontext.metadaten = {name: metadaten.get(name) for name in ("workflow_id", "projekt_name")}
    kontext.scriptdatei = str(Path(scriptdatei).resolve())
    def senden(ereignis):
        text = json.dumps(ereignis, ensure_ascii=True, default=str, separators=(",", ":"))
        if len(text.encode("utf-8")) > 256 * 1024:
            # Der Dienst braucht den bestätigten Abschluss und Berichtspfad auch
            # dann, wenn ein großer Stapel nicht vollständig in das Ereignis passt.
            grenzen = {"art": 160, "block_id": 160, "status": 160, "grund": 160,
                       "bericht_pfad": 32768, "operation": 160, "modus": 160}
            kurz = {name: wert[:grenzen[name]] if isinstance(wert, str) else wert
                    for name, wert in ereignis.items() if name in grenzen}
            if isinstance(ereignis.get("summen"), dict):
                kurz["summen"] = {name: wert for name, wert in ereignis["summen"].items()
                                  if name in {"verarbeitet", "uebersprungen", "geplant", "fehlerhaft"}
                                  and type(wert) is int and 0 <= wert <= 2 ** 53 - 1}
            text = json.dumps({**kurz, "details_ausgelassen": True, "meldung": "Die Ereignisdetails überschreiten 256 KiB. Vollständige Angaben stehen im Laufbericht."}, ensure_ascii=True, separators=(",", ":"))
        sys.stderr.write(f"SLBUS|{token or ''}|{text}\n")
        sys.stderr.flush()
    kontext.ereignis_callback = senden
    kontext.ereignis("lauf", modus=kontext.modus, status="begonnen")
    return kontext


def _unklare_schritte(kontext):
    return [key for key, eintrag in (kontext._journal.eintraege.items() if kontext._journal else ())
            if eintrag.get("zustand") in {"vorbereitet", "archiv_vorbereitet"}]


def _ausgabesummen(kontext, fehler):
    return {"verarbeitet": sum(a.get("status") in {"publiziert", "wiederverwendet"} for a in kontext.ausgaben),
            "uebersprungen": sum(a.get("status") == "uebersprungen" for a in kontext.ausgaben),
            "geplant": sum(a.get("status") == "geplant" for a in kontext.ausgaben),
            "fehlerhaft": len(kontext.fehler) + int(bool(fehler) and not any(e.get("meldung") == str(fehler) for e in kontext.fehler))}


def _bericht_speichern(kontext, status, fehler):
    from . import __version__
    ordnername = kontext.workflow_hash if re.fullmatch(r"[a-fA-F0-9]{64}", kontext.workflow_hash) else daten_hash(kontext.workflow_hash)
    ordner = kontext.journal_pfad.parent if kontext.journal_pfad else kontext.basis / ".scriptlab" / ordnername if kontext.modus == "ausfuehren" else Path(tempfile.gettempdir()) / "ScriptLab-Business-Berichte"
    ordner.mkdir(parents=True, exist_ok=True)
    pakete = {}
    for name in ("duckdb", "openpyxl", "python-docx", "pypdf", "reportlab", "defusedxml"):
        try:
            pakete[name] = version(name)
        except PackageNotFoundError:
            pakete[name] = None
    parameter = {name: "[nicht protokolliert]" if re.search(r"passwort|password|token|secret|credential|api.?key|privat", name, re.I) else wert for name, wert in kontext.parameter.items()}
    unklar = _unklare_schritte(kontext)
    summen = {"bezug": "Ausgabedateien und Fehlermeldungen", **_ausgabesummen(kontext, fehler)}
    bericht = {"version": 1, "quelle": kontext.scriptdatei, "workflow_hash": kontext.workflow_hash, "runtime_hash": kontext.runtime_hash,
               "workflow_id": kontext.metadaten.get("workflow_id"), "projekt_name": kontext.metadaten.get("projekt_name"),
               "lauf_id": kontext.lauf_id, "modus": kontext.modus, "gestartet_am": kontext.gestartet_am,
               "beendet_am": datetime.now(timezone.utc).isoformat(), "status": status,
               "runtime": {"python": sys.version.split()[0], "business": __version__, "pakete": pakete}, "parameter": parameter,
               "grenzen": vars(kontext.grenzen), "fehler": kontext.fehler, "hinweise": kontext.hinweise, "meldung": str(fehler) if fehler else None,
               "ml_training": kontext.ml_training,
               "ausgaben": kontext.ausgaben, "geplant": kontext.geplante_schritte, "unklare_schritte": unklar,
               "quellen": sorted(kontext.quellen.values(), key=lambda f: f["pfad"]), "summen": summen,
               "abbruchgrund": fehler.grund if isinstance(fehler, AbbruchFehler) else None}
    ziel = ordner / f"bericht-{kontext.lauf_id}.json"
    fd, name = tempfile.mkstemp(prefix=".bericht-", suffix=".json", dir=ordner)
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as datei:
            json.dump(bericht, datei, ensure_ascii=True, default=str, indent=2)
            datei.flush()
            os.fsync(datei.fileno())
        os.replace(name, ziel)
    finally:
        Path(name).unlink(missing_ok=True)
    return ziel


def abschliessen(kontext: Kontext, fehler=None):
    try:
        if kontext.modus == "vorschau" and not fehler:
            letzte = next((e for e in reversed(list(kontext.ergebnisse.values())) if isinstance(e, dict) and "tabelle" in e), None)
            if letzte:
                vorschau = _handler()["daten.vorschau"](kontext, {"limit": 200}, {"tabelle": letzte})
                kontext.ereignis("vorschau", **vorschau, abgeschnitten=vorschau.get("gekuerzt", False))
        status = "unklar" if isinstance(fehler, UnklarerZustand) or _unklare_schritte(kontext) or any(e.get("unklar") for e in kontext.fehler) else fehler.grund if isinstance(fehler, AbbruchFehler) else "fehlgeschlagen" if fehler else "mit_fehlern" if kontext.fehler else "erfolgreich"
        bericht = _bericht_speichern(kontext, status, fehler)
        kontext.ereignis("abschluss", status=status, grund=fehler.grund if isinstance(fehler, AbbruchFehler) else None, ausgaben=kontext.ausgaben, fehler=kontext.fehler, summen=_ausgabesummen(kontext, fehler), bericht_pfad=str(bericht), meldung=str(fehler) if fehler else None)
        return 1 if fehler or status == "unklar" else 2 if kontext.fehler else 0
    finally:
        kontext.schliessen()
