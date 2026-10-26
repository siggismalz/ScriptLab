"""Gemeinsame Quellenprüfung, sichere Publikation und kontrollierte Archivierung."""
from __future__ import annotations

from contextlib import contextmanager
import fnmatch
import hashlib
import os
from pathlib import Path, PurePosixPath
import stat
import tempfile
import zipfile

from .kontext import BusinessFehler, Kontext, UnklarerZustand, daten_hash

REGELN = {"FEHLER", "UEBERSPRINGEN", "NEUER_NAME", "ERSETZEN"}


def _stat(wert):
    return (wert.st_dev, wert.st_ino, wert.st_size, wert.st_mtime_ns, wert.st_ctime_ns)


def datei_fingerabdruck(kontext: Kontext, pfad) -> dict:
    quelle = kontext.pfad(pfad)
    if not quelle.is_file():
        raise BusinessFehler(f"Die Quelldatei fehlt: {quelle}")
    pfad_vorher = quelle.stat()
    with quelle.open("rb") as datei:
        vorher = os.fstat(datei.fileno())
        if vorher.st_size > kontext.grenzen.max_datei_bytes:
            raise BusinessFehler("Eine Datei überschreitet die gewählte Größenbegrenzung.")
        pruefsumme = hashlib.sha256()
        gelesen = 0
        while daten := datei.read(65536):
            kontext.pruefen()
            gelesen += len(daten)
            if gelesen > kontext.grenzen.max_datei_bytes:
                raise BusinessFehler("Die Datei wurde während des Lesens zu groß.")
            pruefsumme.update(daten)
        nachher = os.fstat(datei.fileno())
    # Windows liefert für fstat/Path.stat teils verschiedene Datei-IDs. Jeweils
    # denselben Abfrageweg vor/nachher vergleichen, nicht zwei API-Darstellungen.
    if (_stat(vorher) != _stat(nachher) or _stat(pfad_vorher) != _stat(quelle.stat())
            or vorher.st_size != pfad_vorher.st_size or vorher.st_mtime_ns != pfad_vorher.st_mtime_ns):
        raise BusinessFehler("Die Quelldatei wurde während des Lesens verändert. Starte mit einem stabilen Dateistand neu.")
    return {"pfad": str(quelle), "sha256": pruefsumme.hexdigest(), "bytes": gelesen, "stat": list(_stat(pfad_vorher))}


def quellen_pruefen(kontext: Kontext, fingerabdruecke: list[dict]):
    for vorher in fingerabdruecke:
        if datei_fingerabdruck(kontext, vorher["pfad"]) != vorher:
            raise BusinessFehler("Eine Quelle hat sich seit Beginn des Schritts verändert. Es wird nichts publiziert.")


def zip_pruefen(kontext: Kontext, pfad) -> dict:
    """Office-ZIPs vor dem Bibliotheksimport vollständig und begrenzt prüfen."""
    quelle = kontext.pfad(pfad)
    datei_fingerabdruck(kontext, quelle)
    try:
        from defusedxml.ElementTree import iterparse
        from defusedxml.common import DefusedXmlException
    except ImportError as fehler:
        raise BusinessFehler("Der XML-Schutz defusedxml fehlt. Richte die Business-Laufzeit ein.") from fehler
    try:
        with zipfile.ZipFile(quelle) as archiv:
            eintraege = archiv.infolist()
            if len(eintraege) > kontext.grenzen.max_zip_eintraege:
                raise BusinessFehler("Das Dokument enthält zu viele ZIP-Einträge.")
            namen, gesamt = set(), 0
            for eintrag in eintraege:
                kontext.pruefen()
                name = eintrag.orig_filename.replace("\\", "/")
                teile = PurePosixPath(name).parts
                if (not name or "\0" in name or len(name) > 1024 or name.startswith("/")
                        or any(teil in {"..", "."} for teil in teile) or ":" in name
                        or stat.S_ISLNK(eintrag.external_attr >> 16)):
                    raise BusinessFehler("Das Dokument enthält einen unzulässigen ZIP-Pfad oder Dateiverweis.")
                schluessel = name.casefold()
                if schluessel in namen:
                    raise BusinessFehler("Das Dokument enthält mehrdeutige doppelte ZIP-Einträge.")
                namen.add(schluessel)
                if eintrag.flag_bits & 1:
                    raise BusinessFehler("Verschlüsselte Office-Archive werden nicht verarbeitet.")
                if eintrag.file_size > max(1, eintrag.compress_size) * kontext.grenzen.max_zip_verhaeltnis:
                    raise BusinessFehler("Das Dokument überschreitet das zulässige ZIP-Kompressionsverhältnis.")
                gesamt += eintrag.file_size
                if gesamt > kontext.grenzen.max_entpackt_bytes:
                    raise BusinessFehler("Das entpackte Dokument überschreitet die Größenbegrenzung.")
                gelesen = 0
                with archiv.open(eintrag) as strom:
                    while daten := strom.read(65536):
                        gelesen += len(daten)
                        kontext.pruefen()
                        if gelesen > eintrag.file_size or gelesen > kontext.grenzen.max_entpackt_bytes:
                            raise BusinessFehler("Ein ZIP-Eintrag überschreitet seine geprüfte Größe.")
                if not eintrag.is_dir() and name.lower().endswith((".xml", ".rels")):
                    with archiv.open(eintrag) as strom:
                        for _, element in iterparse(strom, events=("end",), forbid_dtd=True, forbid_entities=True, forbid_external=True):
                            kontext.pruefen()
                            element.clear()
            return {"eintraege": len(eintraege), "entpackte_bytes": gesamt}
    except BusinessFehler:
        raise
    except (zipfile.BadZipFile, DefusedXmlException, ValueError, OSError) as fehler:
        raise BusinessFehler("Das Office-Dokument ist beschädigt oder enthält unzulässiges XML.") from fehler


@contextmanager
def quellkopie(kontext: Kontext, pfad, office: bool = False):
    """Bibliotheken lesen eine feste technische Kopie; das Original bleibt unangetastet."""
    quelle = kontext.pfad(pfad)
    vorher = datei_fingerabdruck(kontext, quelle)
    ziel = kontext.arbeitsordner / (hashlib.sha256(str(quelle).encode()).hexdigest() + quelle.suffix)
    with quelle.open("rb") as eingang, ziel.open("wb") as ausgang:
        while daten := eingang.read(65536):
            kontext.pruefen()
            ausgang.write(daten)
    if datei_fingerabdruck(kontext, ziel)["sha256"] != vorher["sha256"]:
        raise BusinessFehler("Die Quelle hat sich beim Kopieren verändert.")
    quellen_pruefen(kontext, [vorher])
    if office:
        zip_pruefen(kontext, ziel)
    try:
        yield ziel
        quellen_pruefen(kontext, [vorher])
    finally:
        ziel.unlink(missing_ok=True)


def _neuer_name(ziel: Path, nummer: int):
    return ziel if nummer == 1 else ziel.with_name(f"{ziel.stem} ({nummer}){ziel.suffix}")


def _ohne_ersetzen(quelle: Path, ziel: Path):
    if os.name == "nt":
        # Windows MoveFileEx ohne REPLACE_EXISTING: kein vorheriger Existenztest als Schutz.
        os.rename(quelle, ziel)
    else:
        os.link(quelle, ziel)
        quelle.unlink()


@contextmanager
def ausgabe(kontext: Kontext, ziel, regel="FEHLER", quellen=(), pruefer=None, ausgabe_id=None):
    if regel not in REGELN:
        raise BusinessFehler("Wähle eine gültige Regel für vorhandene Zieldateien.")
    if kontext.modus == "vorschau":
        raise BusinessFehler("Die Vorschau erzeugt keine Dokument- oder Exportdateien.")
    kontext.pruefen()
    if len(kontext.ausgaben) >= kontext.grenzen.max_ausgaben:
        raise BusinessFehler("Die maximale Anzahl an Ausgabedateien ist erreicht.")
    zielpfad = kontext.pfad(ziel, schreiben=True)
    if zielpfad.exists() and not zielpfad.is_file():
        raise BusinessFehler("Der Ausgabepfad bezeichnet keine normale Datei.")
    vorher = [datei_fingerabdruck(kontext, pfad) for pfad in sorted({str(kontext.pfad(p)) for p in quellen})]
    if any(Path(e["pfad"]) == zielpfad for e in vorher):
        raise BusinessFehler("Quelle und Ausgabedatei müssen verschiedene Dateien sein.")
    schluessel = f"{kontext.schritt_key or kontext.block_id or 'direkt'}:{ausgabe_id or len(kontext.ausgaben)}"
    journal = kontext.journal
    alt = journal.eintraege.get(schluessel) if journal else None
    if alt and alt.get("zustand") == "publiziert":
        if alt.get("aktion_hash") != kontext.aktion_hash or alt.get("quellen") != vorher:
            raise UnklarerZustand("Der fortzusetzende Schritt hat andere Eingaben oder Quellen.")
        geprueft = datei_fingerabdruck(kontext, alt["pfad"])
        if geprueft["sha256"] != alt["sha256"]:
            raise UnklarerZustand("Eine bereits publizierte Datei wurde verändert. Kein automatisches Fortsetzen.")
        # Der Callback erhält nur eine eigene technische Datei; der verifizierte Output bleibt bestehen.
        temp = kontext.arbeitsordner / f"wiederaufnahme-{len(kontext.ausgaben)}{zielpfad.suffix}"
        yield temp
        temp.unlink(missing_ok=True)
        kontext.ausgaben.append({"pfad": alt["pfad"], "status": "wiederverwendet", "sha256": alt["sha256"], "bytes": geprueft["bytes"]})
        return
    if zielpfad.exists() and regel in {"FEHLER", "UEBERSPRINGEN"}:
        if regel == "FEHLER":
            raise BusinessFehler(f"Die Zieldatei ist bereits vorhanden: {zielpfad}")
        temp = kontext.arbeitsordner / f"uebersprungen-{len(kontext.ausgaben)}{zielpfad.suffix}"
        yield temp
        temp.unlink(missing_ok=True)
        bericht = {"pfad": str(zielpfad), "status": "uebersprungen", "sha256": None, "bytes": None}
        kontext.ausgaben.append(bericht)
        if journal:
            journal.schreiben("uebersprungen", schluessel, pfad=str(zielpfad))
        return
    if kontext.modus == "ausfuehren" and not zielpfad.parent.is_dir():
        raise BusinessFehler("Der Zielordner fehlt. Lege ihn ausdrücklich vorher an.")
    tempordner = zielpfad.parent if kontext.modus == "ausfuehren" else kontext.arbeitsordner
    dateinummer, name = tempfile.mkstemp(prefix=".scriptlab-", suffix=zielpfad.suffix, dir=tempordner)
    os.close(dateinummer)
    temporaer = Path(name)
    vorbereitet = False
    try:
        yield temporaer
        kontext.pruefen()
        if pruefer:
            pruefer(temporaer)
        output = datei_fingerabdruck(kontext, temporaer)
        quellen_pruefen(kontext, vorher)
        if kontext.modus == "prueflauf":
            kontext.ausgaben.append({"pfad": str(zielpfad), "status": "geplant", "sha256": output["sha256"], "bytes": output["bytes"]})
            return
        with temporaer.open("r+b") as datei:
            os.fsync(datei.fileno())
        for nummer in range(1, 10001):
            kandidat = _neuer_name(zielpfad, nummer) if regel == "NEUER_NAME" else zielpfad
            journal.schreiben("vorbereitet", schluessel, pfad=str(kandidat), temporaer=str(temporaer), sha256=output["sha256"], quellen=vorher, aktion_hash=kontext.aktion_hash)
            vorbereitet = True
            try:
                if regel == "ERSETZEN":
                    os.replace(temporaer, kandidat)
                else:
                    _ohne_ersetzen(temporaer, kandidat)
                break
            except FileExistsError:
                if regel != "NEUER_NAME":
                    raise BusinessFehler("Während der Publikation wurde das Ziel bereits angelegt.")
        else:
            raise BusinessFehler("Es konnte kein freier Name für die Ausgabedatei gefunden werden.")
        nachher = datei_fingerabdruck(kontext, kandidat)
        if nachher["sha256"] != output["sha256"]:
            raise UnklarerZustand("Die publizierte Ausgabe wurde vor der Bestätigung verändert.")
        journal.schreiben("publiziert", schluessel, pfad=str(kandidat), sha256=output["sha256"], bytes=output["bytes"], quellen=vorher, aktion_hash=kontext.aktion_hash)
        kontext.ausgaben.append({"pfad": str(kandidat), "status": "publiziert", "sha256": output["sha256"], "bytes": output["bytes"]})
    except BaseException:
        if journal and not vorbereitet:
            journal.schreiben("fehlgeschlagen", schluessel, pfad=str(zielpfad))
        raise
    finally:
        # Nach einem unklaren Journalzustand keine mutmaßlich nutzbare Zwischenfassung entfernen.
        if not vorbereitet or not temporaer.exists():
            temporaer.unlink(missing_ok=True)


def publizieren(kontext: Kontext, ziel, schreiber, konflikt="FEHLER", quellen=(), pruefer=None, ausgabe_id=None):
    with ausgabe(kontext, ziel, konflikt, quellen, pruefer, ausgabe_id) as temporaer:
        schreiber(temporaer)
    return kontext.ausgaben[-1]


def dateistapel(kontext: Kontext, konfiguration: dict, eingaben: dict):
    ordner = kontext.pfad(konfiguration["ordner"])
    muster = konfiguration.get("muster", "*")
    if not ordner.is_dir() or not isinstance(muster, str) or "/" in muster or "\\" in muster:
        raise BusinessFehler("Wähle einen vorhandenen Ordner und ein einfaches Dateimuster.")
    ergebnis = []
    for pfad in sorted(ordner.iterdir(), key=lambda p: (p.name.casefold(), p.name)):
        kontext.pruefen()
        if pfad.is_file() and not pfad.is_symlink() and fnmatch.fnmatchcase(pfad.name.casefold(), muster.casefold()):
            ergebnis.append(datei_fingerabdruck(kontext, pfad))
            if len(ergebnis) > kontext.grenzen.max_ausgaben:
                raise BusinessFehler("Der Dateistapel enthält zu viele Dateien.")
    return {"dateien": ergebnis}


def archivieren(kontext: Kontext, konfiguration: dict, eingaben: dict):
    quelle = kontext.pfad(konfiguration["quelle"])
    bestaetigt = eingaben.get("ausgaben", [])
    if not isinstance(bestaetigt, list) or not bestaetigt:
        raise BusinessFehler("Archivierung benötigt mindestens eine geprüfte Ausgabe dieses Laufs.")
    for output in bestaetigt:
        if output not in kontext.ausgaben or output.get("status") not in {"publiziert", "wiederverwendet"}:
            raise BusinessFehler("Eine übersprungene oder fremde Ausgabe erlaubt keine Archivierung.")
        if datei_fingerabdruck(kontext, output["pfad"])["sha256"] != output["sha256"]:
            raise BusinessFehler("Eine Ausgabe wurde verändert. Die Quelle bleibt erhalten.")
    if kontext.modus != "ausfuehren":
        return {"status": "geplant", "quelle": str(quelle), "ziel": str(kontext.pfad(konfiguration["ziel"]))}
    vorher = datei_fingerabdruck(kontext, quelle)
    def kopieren(temp):
        with quelle.open("rb") as eingang, temp.open("wb") as ausgang:
            while daten := eingang.read(65536):
                kontext.pruefen()
                ausgang.write(daten)
    ergebnis = publizieren(kontext, konfiguration["ziel"], kopieren, konfiguration.get("konflikt", "FEHLER"), [quelle], ausgabe_id="archiv")
    if ergebnis["status"] not in {"publiziert", "wiederverwendet"}:
        return ergebnis
    quellen_pruefen(kontext, [vorher])
    schluessel = kontext.schritt_key + ":quelle-entfernen"
    kontext.journal.schreiben("archiv_vorbereitet", schluessel, quelle=vorher, ziel=ergebnis)
    quelle.unlink()
    kontext.journal.schreiben("archiviert", schluessel, quelle=vorher, ziel=ergebnis)
    return {**ergebnis, "status": "archiviert", "quelle": str(quelle)}


HANDLER = {"dateien.stapel": dateistapel, "dateien.archivieren": archivieren}
