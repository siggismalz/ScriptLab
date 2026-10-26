"""Fester Opcode-Runner für denselben Workflow im Editor und im Export."""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import sys

from .kontext import BusinessFehler, Kontext, UnklarerZustand, daten_hash

REINE_OPERATIONEN = {
    "daten.importieren", "daten.spalten", "daten.werte", "daten.filtern", "daten.sortieren",
    "daten.dubletten", "daten.vereinigen", "daten.verknuepfen", "daten.gruppieren",
    "daten.pruefen", "daten.vorschau", "dateien.stapel", "dokument.pdf_text",
}


def _handler():
    from .daten import HANDLER as daten
    from .dateien import HANDLER as dateien
    try:
        from .dokumente import HANDLER as dokumente
    except ImportError:
        dokumente = {}
    return {**daten, **dateien, **dokumente}


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
    if operation not in handler:
        raise BusinessFehler(f"Die Business-Operation wird nicht unterstützt: {operation}")
    k = _aufloesen(konfiguration, kontext)
    e = _aufloesen(eingaben, kontext, True)
    kontext.beginn_schritt(id, k, e)
    kontext.ereignis("schritt", operation=operation, status="begonnen")
    try:
        if kontext.modus == "vorschau" and operation not in REINE_OPERATIONEN:
            ergebnis = {"status": "geplant", "operation": operation}
            kontext.geplante_schritte.append({"id": id, "operation": operation})
        else:
            ergebnis = handler[operation](kontext, k, e)
        kontext.ergebnisse[id] = ergebnis
        if isinstance(ergebnis, dict) and ergebnis.get("gueltig") is False:
            kontext.fehler.append({"block_id": id, "meldung": "Eine fachliche Datenprüfung enthält Fehler."})
        kontext.ereignis("schritt", operation=operation, status="beendet", ergebnis=ergebnis)
        return ergebnis
    except Exception as fehler:
        kontext.fehler.append({"block_id": id, "meldung": str(fehler), "unklar": isinstance(fehler, UnklarerZustand)})
        kontext.ereignis("fehler", operation=operation, meldung=str(fehler), unklar=isinstance(fehler, UnklarerZustand))
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
        if not isinstance(eintrag, dict) or set(eintrag) != {"id", "operation", "konfiguration", "eingaben"} or eintrag["id"] in ids:
            raise BusinessFehler("Ein Planschritt ist ungültig oder seine Kennung doppelt.")
        ids.add(eintrag["id"])
        schritt(kontext, **eintrag)
    return {"status": "mit_fehlern" if kontext.fehler else "erfolgreich", "ergebnisse": kontext.ergebnisse, "ausgaben": kontext.ausgaben}


def _parameter_pruefen(definitionen, werte):
    for definition in definitionen:
        name = definition["name"]
        wert = werte.get(name, definition.get("standard"))
        if definition.get("erforderlich") and (wert is None or wert == ""):
            raise BusinessFehler(f"Der erforderliche Parameter fehlt: {name}")
        if wert is not None:
            typ = definition["typ"]
            if typ == "Wahrheitswert" and type(wert) is not bool:
                raise BusinessFehler(f"Der Parameter {name} benötigt wahr oder falsch.")
            if typ == "Zahl" and (type(wert) not in {int, float}):
                raise BusinessFehler(f"Der Parameter {name} benötigt eine Zahl.")
            if typ not in {"Zahl", "Wahrheitswert"} and not isinstance(wert, str):
                raise BusinessFehler(f"Der Parameter {name} benötigt Text.")
        werte[name] = wert


def kontext_laden(scriptdatei, metadaten: dict, token=None):
    basis_script = Path(scriptdatei).resolve().parent
    if token is not None:
        pfad = basis_script / "scriptlab-kontext.json"
        daten = json.loads(pfad.read_text(encoding="utf-8"))
        if not isinstance(daten, dict) or daten.pop("version", None) != 1:
            raise BusinessFehler("Die technische Business-Kontextdatei ist ungültig.")
        erlaubt = {"basis", "modus", "parameter", "grenzen", "journal_pfad", "fortsetzen", "workflow_hash", "lauf_id"}
        if set(daten) - erlaubt:
            raise BusinessFehler("Die technische Kontextdatei enthält unbekannte Angaben.")
        daten.pop("lauf_id", None)
        kontext = Kontext(**daten)
    else:
        parser = argparse.ArgumentParser(description="ScriptLab-Business-Workflow")
        parser.add_argument("--parameter-datei", type=Path)
        parser.add_argument("--basis", type=Path, default=basis_script)
        parser.add_argument("--modus", choices=("vorschau", "prueflauf", "ausfuehren"), default="ausfuehren")
        parser.add_argument("--journal", type=Path)
        parser.add_argument("--fortsetzen", action="store_true")
        parser.add_argument("--zeitlimit", type=int, default=7200)
        optionen = parser.parse_args()
        parameter = dict(metadaten.get("standard_parameter", {}))
        if optionen.parameter_datei:
            if optionen.parameter_datei.stat().st_size > 1024 * 1024:
                raise BusinessFehler("Die Parameterdatei ist größer als 1 MiB.")
            benutzer = json.loads(optionen.parameter_datei.read_text(encoding="utf-8"))
            if not isinstance(benutzer, dict):
                raise BusinessFehler("Die Parameterdatei muss ein JSON-Objekt enthalten.")
            parameter.update(benutzer)
        kontext = Kontext(optionen.basis, optionen.modus, parameter, {"zeitlimit_sekunden": optionen.zeitlimit}, optionen.journal, optionen.fortsetzen, metadaten.get("workflow_hash", ""))
    _parameter_pruefen(metadaten.get("parameter", []), kontext.parameter)
    # Export-Wiederaufnahme ist an die tatsächlich gestartete Scriptfassung gebunden.
    kontext.workflow_hash = kontext.workflow_hash or hashlib.sha256(Path(scriptdatei).resolve().read_bytes()).hexdigest()
    kontext.token = token
    def senden(ereignis):
        text = json.dumps(ereignis, ensure_ascii=True, default=str, separators=(",", ":"))
        if len(text.encode("utf-8")) > 256 * 1024:
            text = json.dumps({"art": ereignis["art"], "block_id": ereignis.get("block_id"), "details_ausgelassen": True, "meldung": "Die Ereignisdetails überschreiten 256 KiB."})
        sys.stderr.write(f"SLBUS|{token or ''}|{text}\n")
        sys.stderr.flush()
    kontext.ereignis_callback = senden
    kontext.ereignis("lauf", modus=kontext.modus, status="begonnen")
    return kontext


def abschliessen(kontext: Kontext, fehler=None):
    try:
        if kontext.modus == "vorschau" and not fehler:
            letzte = next((e for e in reversed(list(kontext.ergebnisse.values())) if isinstance(e, dict) and "tabelle" in e), None)
            if letzte:
                vorschau = _handler()["daten.vorschau"](kontext, {"limit": 200}, {"tabelle": letzte})
                kontext.ereignis("vorschau", **vorschau, abgeschnitten=vorschau.get("gekuerzt", False))
        status = "unklar" if isinstance(fehler, UnklarerZustand) or any(e.get("unklar") for e in kontext.fehler) else "fehlgeschlagen" if fehler else "mit_fehlern" if kontext.fehler else "erfolgreich"
        kontext.ereignis("abschluss", status=status, ausgaben=kontext.ausgaben, fehler=kontext.fehler, meldung=str(fehler) if fehler else None)
        return 1 if fehler or status == "unklar" else 2 if kontext.fehler else 0
    finally:
        kontext.schliessen()
