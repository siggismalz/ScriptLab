"""Gemeinsame Quellenprüfung, sichere Publikation und kontrollierte Archivierung."""
from __future__ import annotations

from contextlib import contextmanager
import csv
from datetime import datetime
import fnmatch
import hashlib
import os
from pathlib import Path, PurePosixPath
from xml.etree.ElementTree import ParseError
import stat
import tempfile
import re
import zipfile

from .kontext import AbbruchFehler, BusinessFehler, Kontext, UnklarerZustand, daten_hash

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
                roh_teile = name[:-1].split("/") if name.endswith("/") else name.split("/")
                if (not name or "\0" in name or len(name) > 1024 or name.startswith("/")
                        or any(teil in {"..", "."} for teil in teile) or ":" in name
                        or any(not teil or teil in {".", ".."} or teil.endswith((" ", "."))
                               or re.search(r'[<>:"|?*\x00-\x1f]', teil)
                               or re.fullmatch(r"(?i)(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?", teil)
                               for teil in roh_teile)
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
    except (zipfile.BadZipFile, DefusedXmlException, ParseError, ValueError, OSError) as fehler:
        raise BusinessFehler("Das Office-Dokument ist beschädigt oder enthält unzulässiges XML.") from fehler


@contextmanager
def quellkopie(kontext: Kontext, pfad, office: bool = False):
    """Bibliotheken lesen eine feste technische Kopie; das Original bleibt unangetastet."""
    quelle = kontext.pfad(pfad)
    vorher = datei_fingerabdruck(kontext, quelle)
    kontext.quelle_merken(vorher)
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
    for fingerprint in vorher:
        kontext.quelle_merken(fingerprint)
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
            fingerprint = datei_fingerabdruck(kontext, pfad)
            kontext.quelle_merken(fingerprint)
            ergebnis.append(fingerprint)
            if len(ergebnis) > kontext.grenzen.max_ausgaben:
                raise BusinessFehler("Der Dateistapel enthält zu viele Dateien.")
    return {"dateien": ergebnis}


def archivieren(kontext: Kontext, konfiguration: dict, eingaben: dict):
    quelle = kontext.pfad(konfiguration["quelle"])
    bestaetigt = eingaben.get("ausgaben", [])
    if isinstance(bestaetigt, dict):
        bestaetigt = bestaetigt.get("dokumente", [bestaetigt])
    if not isinstance(bestaetigt, list) or not bestaetigt:
        raise BusinessFehler("Archivierung benötigt mindestens eine geprüfte Ausgabe dieses Laufs.")
    for output in bestaetigt:
        zustaende = {"publiziert", "wiederverwendet"} if kontext.modus == "ausfuehren" else {"geplant"}
        if output not in kontext.ausgaben or output.get("status") not in zustaende:
            raise BusinessFehler("Eine übersprungene oder fremde Ausgabe erlaubt keine Archivierung.")
        if kontext.modus == "ausfuehren" and datei_fingerabdruck(kontext, output["pfad"])["sha256"] != output["sha256"]:
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


def dateiliste_aufloesen(kontext, wert):
    if isinstance(wert, dict):
        wert = wert.get("dateien", wert.get("dokumente"))
    if not isinstance(wert, list) or not wert:
        raise BusinessFehler("Verbinde eine nicht leere Dateiliste.")
    pfade = []
    for eintrag in wert:
        pfad = eintrag if isinstance(eintrag, str) else eintrag.get("pfad")
        aktuell = datei_fingerabdruck(kontext, pfad)
        if isinstance(eintrag, dict) and eintrag.get("sha256") and aktuell["sha256"] != eintrag["sha256"]:
            raise BusinessFehler("Eine Datei des zuvor gelesenen Stapels wurde verändert.")
        pfade.append(Path(aktuell["pfad"]))
    return pfade


def _kopieren(kontext, quelle, ziel, konflikt="FEHLER", ausgabe_id=None):
    quelle = kontext.pfad(quelle)
    vorher = datei_fingerabdruck(kontext, quelle)
    def schreiben(temp):
        with quelle.open("rb") as eingang, temp.open("wb") as ausgang:
            while daten := eingang.read(65536):
                kontext.pruefen()
                ausgang.write(daten)
    def pruefen(temp):
        if datei_fingerabdruck(kontext, temp)["sha256"] != vorher["sha256"]:
            raise BusinessFehler("Die Kopie entspricht nicht der geprüften Quelle.")
    return publizieren(kontext, ziel, schreiben, konflikt, [quelle], pruefen, ausgabe_id)


def _verweis(pfad):
    return pfad.is_symlink() or bool(getattr(pfad.lstat(), "st_file_attributes", 0) & 1024)


def datei_aktion(kontext: Kontext, k: dict, e: dict):
    aktion, ziel = k.get("aktion"), kontext.pfad(k["ziel"], schreiben=True)
    if aktion == "ORDNER":
        if ziel.exists() and not ziel.is_dir():
            raise BusinessFehler("Am Ordnerziel liegt bereits eine Datei.")
        if kontext.modus != "ausfuehren":
            return {"status": "geplant", "pfad": str(ziel)}
        ziel.mkdir(parents=True, exist_ok=True)
        kontext.journal.schreiben("ordner", kontext.schritt_key + ":ordner", pfad=str(ziel))
        return {"status": "ordner_vorhanden", "pfad": str(ziel)}
    if aktion == "ZIP_ERSTELLEN":
        return zip_erstellen(kontext, k, e)
    if aktion == "ZIP_ENTPACKEN":
        return zip_entpacken(kontext, k, e)
    if aktion not in {"KOPIEREN", "VERSCHIEBEN", "UMBENENNEN"}:
        raise BusinessFehler("Diese Business-Dateiaktion wird nicht unterstützt.")
    quelle = kontext.pfad(k["quelle"])
    if aktion == "UMBENENNEN":
        if not Path(k["ziel"]).is_absolute() and Path(k["ziel"]).name == k["ziel"]:
            ziel = quelle.parent / k["ziel"]
        if quelle.parent != ziel.parent:
            raise BusinessFehler("Umbenennen bleibt im selben Ordner. Verwende Verschieben für einen anderen Ordner.")
    vorher = datei_fingerabdruck(kontext, quelle)
    ergebnis = _kopieren(kontext, quelle, ziel, k.get("konflikt", "FEHLER"), "datei")
    if aktion != "KOPIEREN" and kontext.modus == "ausfuehren" and ergebnis["status"] in {"publiziert", "wiederverwendet"}:
        quellen_pruefen(kontext, [vorher])
        schluessel = kontext.schritt_key + ":verschieben"
        kontext.journal.schreiben("archiv_vorbereitet", schluessel, quelle=vorher, ziel=ergebnis)
        quelle.unlink()
        kontext.journal.schreiben("verschoben", schluessel, quelle=vorher, ziel=ergebnis)
    return {**ergebnis, "aktion": aktion}


def zip_erstellen(kontext: Kontext, k: dict, e: dict):
    ziel = kontext.pfad(k["ziel"])
    if ziel.suffix.lower() != ".zip":
        raise BusinessFehler("Wähle eine .zip-Ausgabedatei.")
    quelle = kontext.pfad(k["quelle"]) if k.get("quelle") else None
    if quelle and quelle.is_dir():
        pfade = []
        for ordner, verzeichnisse, dateien in os.walk(quelle, followlinks=False):
            verzeichnisse.sort(key=str.casefold)
            for name in [*verzeichnisse, *dateien]:
                if _verweis(Path(ordner) / name):
                    raise BusinessFehler("ZIP-Quellen dürfen keine symbolischen Links oder Reparsepunkte enthalten.")
            pfade.extend(Path(ordner) / name for name in sorted(dateien, key=str.casefold))
        namen = [p.relative_to(quelle).as_posix() for p in pfade]
    else:
        pfade = [quelle] if quelle else dateiliste_aufloesen(kontext, e.get("dateien"))
        namen = [p.name for p in pfade]
    if not pfade or len(pfade) > kontext.grenzen.max_zip_eintraege or len(set(n.casefold() for n in namen)) != len(namen):
        raise BusinessFehler("Die ZIP-Quellliste ist leer, zu groß oder enthält doppelte Namen.")
    def schreiben(temp):
        with zipfile.ZipFile(temp, "w", compression=zipfile.ZIP_DEFLATED) as archiv:
            for pfad, name in zip(pfade, namen):
                kontext.pruefen()
                archiv.write(pfad, arcname=name)
    return publizieren(kontext, ziel, schreiben, k.get("konflikt", "FEHLER"), pfade, lambda p: zip_pruefen(kontext, p), "zip")


def zip_entpacken(kontext: Kontext, k: dict, e: dict):
    quelle, zielordner = kontext.pfad(k["quelle"]), kontext.pfad(k["ziel"])
    zip_pruefen(kontext, quelle)
    ausgaben = []
    with quellkopie(kontext, quelle) as kopie, zipfile.ZipFile(kopie) as archiv:
        for eintrag in sorted(archiv.infolist(), key=lambda i: i.filename.casefold()):
            kontext.pruefen()
            ziel = (zielordner / eintrag.filename.replace("\\", "/")).resolve()
            if not ziel.is_relative_to(zielordner):
                raise BusinessFehler("Ein ZIP-Ziel verlässt den gewählten Ausgabeordner.")
            if eintrag.is_dir():
                if kontext.modus == "ausfuehren":
                    ziel.mkdir(parents=True, exist_ok=True)
                continue
            if kontext.modus == "ausfuehren":
                ziel.parent.mkdir(parents=True, exist_ok=True)
            def schreiben(temp):
                with archiv.open(eintrag) as eingang, temp.open("wb") as ausgang:
                    while daten := eingang.read(65536):
                        kontext.pruefen()
                        ausgang.write(daten)
            ausgaben.append(publizieren(kontext, ziel, schreiben, k.get("konflikt", "FEHLER"), [quelle], ausgabe_id=daten_hash(eintrag.filename)))
    return {"dokumente": ausgaben, "anzahl": len(ausgaben)}


def beleg_ablegen(kontext: Kontext, k: dict, e: dict):
    import duckdb
    from .dokumente import pdf_text
    quelle = kontext.pfad(k["quelle"])
    auszug = pdf_text(kontext, {"quelle": str(quelle)}, {})
    if k.get("bei_scan", "STOPP") not in {"BERICHT", "STOPP"}:
        raise BusinessFehler("Wähle BERICHT oder STOPP für Belege ohne Textschicht.")
    if auszug["scan_verdacht"] or not auszug["text"].strip():
        if k.get("bei_scan", "STOPP") == "BERICHT":
            ergebnis = {"status": "hinweis", "scan_verdacht": True, "quelle": str(quelle), "meldung": "Der Beleg hat keine verlässliche Textschicht. Die Quelle bleibt unverändert; OCR ist nicht eingerichtet."}
            kontext.hinweise.append(ergebnis)
            kontext.ereignis("hinweis", **ergebnis)
            return ergebnis
        raise BusinessFehler("Der Beleg hat keine verlässliche Textschicht. OCR ist nicht eingerichtet; die Quelle bleibt erhalten.")
    nummer_muster = k.get("belegnummer_muster", r"(?i)(?:Rechnung|Beleg)[\s:-]+([A-Za-z0-9][A-Za-z0-9_-]{0,63})")
    datum_muster = k.get("datum_muster", r"(\d{4}-\d{2}-\d{2}|\d{2}\.\d{2}\.\d{4})")
    if any(not isinstance(p, str) or len(p) > 400 for p in (nummer_muster, datum_muster)):
        raise BusinessFehler("Die Belegmuster müssen kurze reguläre Ausdrücke mit einer Ergebnisgruppe sein.")
    verbindung = duckdb.connect(config={"enable_external_access": False, "autoload_known_extensions": False, "autoinstall_known_extensions": False})
    try:
        nummern = set(verbindung.execute("SELECT regexp_extract_all(?,?,1)", [auszug["text"], nummer_muster]).fetchone()[0]) - {""}
        daten = set(verbindung.execute("SELECT regexp_extract_all(?,?,1)", [auszug["text"], datum_muster]).fetchone()[0]) - {""}
    except duckdb.Error as fehler:
        raise BusinessFehler("Ein Belegmuster wird nicht unterstützt. Verwende ein einfaches RE2-Muster mit einer Ergebnisgruppe.") from fehler
    finally:
        verbindung.close()
    if len(nummern) != 1 or len(daten) != 1:
        raise BusinessFehler("Belegnummer oder Datum sind fehlend oder mehrdeutig. Die Quelle bleibt erhalten.")
    datum = next(iter(daten))
    try:
        datum = datetime.strptime(datum, "%Y-%m-%d" if "-" in datum else "%d.%m.%Y").date()
    except ValueError as fehler:
        raise BusinessFehler("Das gefundene Belegdatum ist ungültig.") from fehler
    nummer = next(iter(nummern))
    sicher = re.sub(r"[^A-Za-z0-9_-]", "_", nummer)
    ordner = kontext.pfad(k["zielordner"]) / datum.strftime("%Y-%m")
    if kontext.modus == "ausfuehren":
        ordner.mkdir(parents=True, exist_ok=True)
    ergebnis = _kopieren(kontext, quelle, ordner / (sicher + ".pdf"), k.get("konflikt", "FEHLER"), "beleg")
    return {**ergebnis, "belegnummer": nummer, "datum": datum.isoformat()}


def csv_stapel(kontext: Kontext, k: dict, e: dict):
    quelleordner = kontext.pfad(k["ordner"])
    zielordner, archivordner = kontext.pfad(k["zielordner"]), kontext.pfad(k["archivordner"])
    if len({quelleordner, zielordner, archivordner}) != 3:
        raise BusinessFehler("Eingang, Ausgabe und Archiv müssen verschiedene Ordner sein.")
    trennzeichen = k.get("trennzeichen", ";")
    if not isinstance(trennzeichen, str) or len(trennzeichen) != 1 or trennzeichen in "\r\n\0":
        raise BusinessFehler("Wähle ein einzelnes CSV-Trennzeichen.")
    if k.get("bei_fehler", "STOPP") not in {"BERICHT", "STOPP"}:
        raise BusinessFehler("Wähle BERICHT oder STOPP für fehlerhafte Stapeldateien.")
    liste = dateistapel(kontext, {"ordner": str(quelleordner), "muster": k.get("muster", "*.csv")}, {})["dateien"]
    original_key, original_hash = kontext.schritt_key, kontext.aktion_hash
    berichte = []
    if kontext.modus == "ausfuehren" and kontext.fortsetzen:
        # Bereits archivierte Dateien stehen nicht mehr im Eingang. Ihre bestätigten
        # Ausgaben trotzdem prüfen und im Wiederaufnahmebericht sichtbar erhalten.
        for schluessel, archiv in kontext.journal.eintraege.items():
            if not schluessel.startswith(original_key + ":") or archiv.get("zustand") != "archiviert":
                continue
            if Path(archiv["quelle"]["pfad"]).exists():
                raise UnklarerZustand("Eine bereits archivierte Quelle liegt wieder im Eingang. Starte dafür einen neuen Lauf.")
            kontext.quelle_merken(archiv["quelle"])
            prefix = schluessel.rsplit(":", 1)[0]
            output = kontext.journal.eintraege.get(prefix + ":csv")
            if not output or output.get("zustand") != "publiziert":
                raise UnklarerZustand("Der wiederaufgenommene Stapel hat keine bestätigte CSV-Ausgabe.")
            for datei in (output, archiv["ziel"]):
                if datei_fingerabdruck(kontext, datei["pfad"])["sha256"] != datei["sha256"]:
                    raise UnklarerZustand("Eine bestätigte Stapel- oder Archivdatei wurde verändert.")
            ergebnis = {"pfad": output["pfad"], "sha256": output["sha256"], "bytes": output["bytes"], "status": "wiederverwendet"}
            kontext.ausgaben.append(ergebnis)
            berichte.append({"quelle": archiv["quelle"]["pfad"], "status": "wiederverwendet", "ausgabe": ergebnis, "archiv": archiv["ziel"]})
    try:
        for source in liste:
            kontext.pruefen()
            quelle = Path(source["pfad"])
            kontext.schritt_key = original_key + ":" + daten_hash(str(quelle))[:20]
            kontext.aktion_hash = daten_hash({"konfiguration": k, "quelle": source})
            try:
                quellen_pruefen(kontext, [source])
                anzahl = [0]
                def schreiben(temp):
                    with quelle.open("r", encoding="utf-8-sig", newline="") as eingang, temp.open("w", encoding="utf-8-sig", newline="") as ausgang:
                        leser, schreiber = csv.reader(eingang, delimiter=trennzeichen, strict=True), csv.writer(ausgang, delimiter=trennzeichen, lineterminator="\r\n")
                        kopf = next(leser, None)
                        if not kopf or any(not n.strip() for n in kopf) or len(set(kopf)) != len(kopf):
                            raise BusinessFehler("Die CSV-Kopfzeile fehlt oder enthält leere beziehungsweise doppelte Spalten.")
                        schreiber.writerow(kopf)
                        for zeile in leser:
                            kontext.pruefen()
                            if len(zeile) != len(kopf):
                                raise BusinessFehler("Die CSV-Datei enthält eine Zeile mit abweichender Spaltenzahl.")
                            schreiber.writerow(zeile)
                            anzahl[0] += 1
                def pruefen(temp):
                    with temp.open("r", encoding="utf-8-sig", newline="") as ausgang:
                        if sum(1 for _ in csv.reader(ausgang, delimiter=trennzeichen, strict=True)) != anzahl[0] + 1:
                            raise BusinessFehler("Die CSV-Ausgabe hat nicht die erwartete Zeilenzahl.")
                output = publizieren(kontext, zielordner / quelle.name, schreiben, k.get("konflikt", "FEHLER"), [quelle], pruefen, "csv")
                archiv = archivieren(kontext, {"quelle": str(quelle), "ziel": str(archivordner / quelle.name), "konflikt": k.get("konflikt", "FEHLER")}, {"ausgaben": [output]}) if output["status"] in {"publiziert", "wiederverwendet", "geplant"} else {"status": "nicht_archiviert"}
                berichte.append({"quelle": str(quelle), "status": output["status"], "zeilen": anzahl[0], "ausgabe": output, "archiv": archiv})
            except (AbbruchFehler, UnklarerZustand):
                # Sicherheit und bewusster Abbruch sind keine überspringbaren CSV-Fehlzeilen.
                raise
            except (BusinessFehler, OSError, UnicodeError, csv.Error) as fehler:
                meldung = str(fehler) if isinstance(fehler, BusinessFehler) else "Die CSV-Datei ist ungültig oder nicht lesbar."
                berichte.append({"quelle": str(quelle), "status": "fehler", "meldung": meldung})
                kontext.fehler.append({"block_id": kontext.block_id, "meldung": meldung})
                if k.get("bei_fehler", "STOPP") == "STOPP":
                    raise BusinessFehler(meldung) from fehler
    finally:
        kontext.schritt_key, kontext.aktion_hash = original_key, original_hash
    return {"status": "mit_fehlern" if any(b["status"] == "fehler" for b in berichte) else "erfolgreich", "dateien": berichte, "anzahl": len(berichte)}


HANDLER = {"dateien.stapel": dateistapel, "dateien.archivieren": archivieren,
           "dateien.aktion": datei_aktion, "dateien.beleg_ablegen": beleg_ablegen, "dateien.csv_stapel": csv_stapel}
