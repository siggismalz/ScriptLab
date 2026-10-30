"""Vier feste ML-Operationen, lauflokale Modelle und begrenzte CPU-Verarbeitung."""
from __future__ import annotations

from dataclasses import dataclass
import hashlib
import math
from pathlib import Path
import uuid

from scriptlab_business.kontext import BusinessFehler, daten_hash
from scriptlab_business.typen import MLModell
from .vorbereitung import lernen, transformieren, zahl, MAX_MERKMALE, validieren

MAX_TRAININGSZEILEN = 100000
MAX_MATRIX_BYTES = 128 * 1024 ** 2
PAKETGROESSE = 512


def _ml_profil(kontext):
    kontext.pruefen()
    if not kontext.ml_aktiv:
        raise BusinessFehler("Diese ML-Operation benötigt einen ausdrücklich als ML-Workflow gestarteten Lauf (ml_aktiv=True). Starte einen neuen ML-Lauf; ein bereits begonnenes Journal wird nicht nachträglich umgestellt.")


def _felder(k, e, konfiguration, eingaben):
    if not isinstance(k, dict) or set(k) - set(konfiguration) or not isinstance(e, dict) or set(e) != set(eingaben):
        raise BusinessFehler("Die ML-Operation enthält unbekannte Felder oder fehlende Eingaben.")


@dataclass
class Modell:
    metadaten: dict
    schaetzer: object
    quellen: tuple = ()
    originale: tuple = ()


def _modell(kontext, referenz):
    kennung = referenz.get("ml_modell") if isinstance(referenz, dict) else None
    modelle = kontext.dienste.setdefault("ml_modelle", {})
    if not isinstance(kennung, str) or kennung not in modelle:
        raise BusinessFehler("Das ML-Modell gehört nicht zu diesem Lauf. Lade eine gespeicherte .slmodell-Datei.")
    return modelle[kennung]


def _merken(kontext, modell):
    from scriptlab_business.dateien import datei_fingerabdruck, quellen_pruefen
    if not modell.originale:
        modell.originale = tuple(datei_fingerabdruck(kontext, p) for p in modell.quellen)
    quellen_pruefen(kontext, modell.originale)
    gewichte = _gewichtsfingerabdruck(kontext, modell)
    quellen_pruefen(kontext, modell.originale)
    kennung = uuid.uuid4().hex
    kontext.dienste.setdefault("ml_modelle", {})[kennung] = modell
    m = modell.metadaten
    kontext._ml_herkunft[kennung] = daten_hash({"metadaten": m, "gewichte": gewichte, "originale": modell.originale})
    return MLModell(kennung, m["aufgabe"], m["verfahren"], tuple(s["name"] for s in m["schema"]), m["zielspalte"], m["metriken"]).json()


def _gewichtsfingerabdruck(kontext, modell):
    """Gewichtsidentität ohne zufällige ZIP-Namen, Zeitstempel oder Strukturpadding."""
    pruefsumme = hashlib.sha256()
    def array(name, wert):
        kontext.pruefen()
        pruefsumme.update(daten_hash({"name": name, "typ": wert.dtype.str, "form": wert.shape}).encode("ascii"))
        pruefsumme.update(wert.tobytes(order="C"))
    if modell.metadaten["verfahren"] == "RANDOM_FOREST":
        for i, baum in enumerate(modell.schaetzer.estimators_):
            zustand = baum.tree_.__getstate__()
            pruefsumme.update(daten_hash({"baum": i, "tiefe": zustand["max_depth"], "knoten": zustand["node_count"]}).encode("ascii"))
            for feld in sorted(zustand["nodes"].dtype.names):
                array(f"{i}/{feld}", zustand["nodes"][feld])
            array(f"{i}/werte", zustand["values"])
    else:
        for name, wert in sorted(modell.schaetzer.state_dict().items()):
            array(name, wert.detach().cpu().contiguous().numpy())
    return pruefsumme.hexdigest()


def _ganzzahl(k, name, standard, unten, oben):
    wert = k.get(name, standard)
    if type(wert) is not int or not unten <= wert <= oben:
        raise BusinessFehler(f"„{name}“ muss eine ganze Zahl zwischen {unten} und {oben} sein.")
    return wert


def architektur(eingang, ausgang):
    import torch
    torch.set_num_threads(1)
    return torch.nn.Sequential(torch.nn.Linear(eingang, 64), torch.nn.ReLU(),
                               torch.nn.Linear(64, 32), torch.nn.ReLU(), torch.nn.Linear(32, ausgang))


def _vorhersage(modell, matrix):
    import numpy as np
    m = modell.metadaten
    if m["verfahren"] == "RANDOM_FOREST":
        roh = modell.schaetzer.predict(matrix)
    else:
        import torch
        modell.schaetzer.eval()
        with torch.inference_mode():
            ausgabe = modell.schaetzer(torch.from_numpy(matrix))
            roh = ausgabe.argmax(dim=1).numpy() if m["aufgabe"] == "KLASSIFIKATION" else ausgabe[:, 0].numpy() * m["zielskala"] + m["zielmittel"]
    if m["aufgabe"] == "KLASSIFIKATION":
        return [m["klassen"][int(w)] for w in roh]
    if not np.isfinite(roh).all():
        raise BusinessFehler("Das Modell hat keine endlichen Vorhersagen erzeugt.")
    return [float(w) for w in roh]


def trainieren(kontext, k, e):
    if kontext.modus != "ausfuehren":
        return {"status": "geplant", "operation": "ml.trainieren"}
    _ml_profil(kontext)
    import numpy as np
    from sklearn.model_selection import train_test_split
    from sklearn.metrics import accuracy_score, f1_score, mean_absolute_error, mean_squared_error, r2_score
    from scriptlab_business.daten import engine
    from scriptlab_business.dateien import datei_fingerabdruck
    from .format import versionen

    _felder(k, e, ("aufgabe", "verfahren", "zielspalte", "merkmale", "testanteil", "zufallsseed", "baeume", "max_tiefe", "epochen"), ("tabelle",))
    kontext.pruefen()
    profilversionen = versionen()
    daten = engine(kontext)
    tabelle = daten.tabelle(e.get("tabelle"))
    aufgabe, verfahren = k.get("aufgabe", "KLASSIFIKATION"), k.get("verfahren", "RANDOM_FOREST")
    if aufgabe not in {"KLASSIFIKATION", "REGRESSION"} or verfahren not in {"RANDOM_FOREST", "PYTORCH"}:
        raise BusinessFehler("Wähle Klassifikation oder Regression und ein unterstütztes ML-Verfahren.")
    ziel = k.get("zielspalte")
    namen = [s.name for s in tabelle.spalten]
    merkmale = k.get("merkmale")
    if not isinstance(ziel, str) or ziel not in namen or not isinstance(merkmale, list) or not 1 <= len(merkmale) <= MAX_MERKMALE or any(not isinstance(n, str) or n not in namen for n in merkmale) or len(set(merkmale)) != len(merkmale) or ziel in merkmale:
        raise BusinessFehler("Wähle eine vorhandene Zielspalte und unterschiedliche Merkmale ohne die Zielspalte.")
    testanteil = k.get("testanteil", .2)
    if type(testanteil) not in {float, int} or not .05 <= testanteil <= .5:
        raise BusinessFehler("Der Testanteil muss zwischen 0,05 und 0,5 liegen.")
    seed = _ganzzahl(k, "zufallsseed", 42, 0, 2147483647)
    baeume = _ganzzahl(k, "baeume", 100, 1, 1000)
    tiefe = _ganzzahl(k, "max_tiefe", 12, 1, 32)
    epochen = _ganzzahl(k, "epochen", 50, 1, 1000)
    schema = [{"name": n, "typ": next(s.typ for s in tabelle.spalten if s.name == n)} for n in merkmale]
    indizes = [namen.index(n) for n in merkmale]
    zielindex = namen.index(ziel)
    x, y, umfang = [], [], 0
    for zeile in daten.zeilen(tabelle):
        kontext.pruefen()
        if zeile[zielindex] is None:
            raise BusinessFehler("Die Zielspalte enthält fehlende Werte. Bereinige sie vor dem Training.")
        werte = tuple(zeile[i] for i in indizes)
        umfang += sum(len(str(w)) for w in (*werte, zeile[zielindex]))
        if len(x) >= MAX_TRAININGSZEILEN or umfang > 64 * 1024 ** 2:
            raise BusinessFehler("Das lokale ML-Training ist auf 100000 Zeilen und 64 MiB Merkmals-/Zieltext begrenzt. Begrenze die Trainingsquelle vorher.")
        x.append(werte)
        y.append(zeile[zielindex])
    if len(x) < 10:
        raise BusinessFehler("Das ML-Training benötigt mindestens zehn Zeilen für getrennte Trainings- und Testdaten.")
    klassen = []
    if aufgabe == "KLASSIFIKATION":
        if any(type(w) not in {str, int, bool, float} or (isinstance(w, float) and not math.isfinite(w)) for w in y) or len({type(w) for w in y}) != 1:
            raise BusinessFehler("Klassifikationsziele müssen einheitliche Text-, Wahrheits- oder endliche Zahlenwerte sein.")
        klassen = sorted(set(y))
        if not 2 <= len(klassen) <= 256 or min(y.count(w) for w in klassen) < 2:
            raise BusinessFehler("Klassifikation benötigt 2–256 Klassen und mindestens zwei Zeilen je Klasse.")
        ziele = np.asarray([klassen.index(w) for w in y], dtype=np.int64)
    else:
        ziele = np.asarray([zahl(w) for w in y], dtype=np.float64)
    try:
        train, test = train_test_split(np.arange(len(x)), test_size=testanteil, random_state=seed,
                                       stratify=ziele if klassen else None)
    except ValueError as fehler:
        raise BusinessFehler("Für den gewählten Testanteil fehlen genügend Zeilen je Klasse. Vergrößere die Daten oder ändere den Testanteil.") from fehler
    if len(test) < 2:
        raise BusinessFehler("Der Testanteil muss mindestens zwei zurückgehaltene Zeilen enthalten.")
    if verfahren == "RANDOM_FOREST":
        knotengrenze = baeume * min(2 ** (tiefe + 1) - 1, 2 * len(train) - 1)
        if knotengrenze * (64 + 8 * max(1, len(klassen))) > 128 * 1024 ** 2:
            raise BusinessFehler("Die gewählte Waldgröße überschreitet die konservative Strukturgrenze von 128 MiB. Reduziere Bäume, Tiefe oder Klassen.")
    gelernt = lernen([x[int(i)] for i in train], schema)
    dimensionen = validieren(gelernt)
    if len(x) * dimensionen * 4 > MAX_MATRIX_BYTES:
        raise BusinessFehler("Die transformierte ML-Matrix überschreitet 128 MiB. Reduziere Zeilen, Merkmale oder Kategorien.")
    xt = transformieren([x[int(i)] for i in train], gelernt)
    xv = transformieren([x[int(i)] for i in test], gelernt)
    yt = ziele[train]
    zielmittel, zielskala = 0., 1.
    if verfahren == "RANDOM_FOREST":
        from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
        klasse = RandomForestClassifier if klassen else RandomForestRegressor
        modell = klasse(n_estimators=1, max_depth=tiefe, random_state=seed, n_jobs=1, warm_start=True)
        # Zwischen begrenzten Baumgruppen kooperativ abbrechen; kein zweiter Fit auf Testdaten.
        for anzahl in range(1, baeume + 1):
            if anzahl != baeume and anzahl % 10:
                continue
            kontext.pruefen()
            modell.set_params(n_estimators=anzahl)
            modell.fit(xt, yt)
        modell.set_params(warm_start=False)
    else:
        import torch
        torch.set_num_threads(1)
        torch.manual_seed(seed)
        modell = architektur(dimensionen, len(klassen) if klassen else 1)
        if not klassen:
            zielmittel = float(np.mean(yt))
            zielskala = float(np.std(yt)) or 1.
        ziel_tensor = torch.tensor(yt if klassen else (yt - zielmittel) / zielskala,
                                   dtype=torch.long if klassen else torch.float32)
        eingang = torch.from_numpy(xt)
        optimizer = torch.optim.Adam(modell.parameters(), lr=.001)
        verlust = torch.nn.CrossEntropyLoss() if klassen else torch.nn.MSELoss()
        for epoche in range(epochen):
            kontext.pruefen()
            modell.train()
            reihenfolge = torch.randperm(len(train))
            for paket in reihenfolge.split(256):
                kontext.pruefen()
                optimizer.zero_grad()
                roh = modell(eingang[paket])
                fehler = verlust(roh if klassen else roh[:, 0], ziel_tensor[paket])
                if not torch.isfinite(fehler):
                    raise BusinessFehler("Das neuronale Training wurde numerisch instabil. Prüfe Werte und Merkmale.")
                fehler.backward()
                optimizer.step()
            kontext.ereignis("ml_fortschritt", epoche=epoche + 1, epochen=epochen)
    quellen = daten.quellpfade(tabelle)
    metadaten = {"version": 1, "format": "ScriptLab-ML", "ml_version": "1.0.0", "versionen": profilversionen,
                 "laufzeitfingerabdruck": kontext.runtime_hash,
                 "aufgabe": aufgabe, "verfahren": verfahren, "zielspalte": ziel,
                 "zieltyp": next(s.typ for s in tabelle.spalten if s.name == ziel), "schema": gelernt,
                 "klassen": klassen, "zielmittel": zielmittel, "zielskala": zielskala,
                 "trainingszeilen": len(train), "testzeilen": len(test), "testanteil": testanteil,
                 "zufallsseed": seed, "baeume": baeume, "max_tiefe": tiefe, "epochen": epochen,
                 "trainingsfingerabdruck": daten_hash([datei_fingerabdruck(kontext, p) for p in quellen]), "metriken": {}}
    intern = Modell(metadaten, modell, quellen)
    vorhersagen = _vorhersage(intern, xv)
    if klassen:
        erwartet = ziele[test]
        kodiert = [klassen.index(w) for w in vorhersagen]
        metriken = {"accuracy": float(accuracy_score(erwartet, kodiert)), "f1_macro": float(f1_score(erwartet, kodiert, average="macro", zero_division=0))}
    else:
        erwartet = ziele[test]
        metriken = {"mae": float(mean_absolute_error(erwartet, vorhersagen)),
                    "rmse": float(math.sqrt(mean_squared_error(erwartet, vorhersagen))),
                    "r2": float(r2_score(erwartet, vorhersagen)) if np.var(erwartet) > 0 else None}
    if any(w is not None and not math.isfinite(w) for w in metriken.values()):
        raise BusinessFehler("Die Testmetriken überschreiten den unterstützten Zahlenbereich.")
    metadaten["metriken"] = metriken
    kontext.pruefen()
    ergebnis = _merken(kontext, intern)
    ereignis = {"aufgabe": aufgabe, "verfahren": verfahren, "trainingszeilen": len(train), "testzeilen": len(test),
                "merkmale": merkmale, "zielspalte": ziel, "metriken": metriken}
    kontext.ml_training.append({"art": "ml_training", "block_id": kontext.block_id, **ereignis})
    kontext.ereignis("ml_training", **ereignis)
    return ergebnis


def speichern(kontext, k, e):
    if kontext.modus != "ausfuehren" or _geplant(e):
        return {"status": "geplant", "operation": "ml.speichern"}
    _ml_profil(kontext)
    from scriptlab_business.dateien import publizieren, quellen_pruefen
    from .format import schreiben, lesen
    _felder(k, e, ("pfad", "konflikt"), ("modell",))
    modell = _modell(kontext, e.get("modell"))
    quellen_pruefen(kontext, modell.originale)
    pfad = k.get("pfad", "modell.slmodell")
    if not isinstance(pfad, str) or Path(pfad).suffix.lower() != ".slmodell":
        raise BusinessFehler("Speichere das Modell als .slmodell-Datei.")
    return publizieren(kontext, pfad, lambda p: schreiben(p, modell), k.get("konflikt", "FEHLER"),
                       modell.quellen, lambda p: lesen(p, kontext), ausgabe_id="ml-modell")


def laden(kontext, k, e):
    _ml_profil(kontext)
    from scriptlab_business.dateien import datei_fingerabdruck, quellen_pruefen
    from .format import lesen
    _felder(k, e, ("pfad",), ())
    pfad = kontext.pfad(k.get("pfad", "modell.slmodell"))
    if pfad.suffix.lower() != ".slmodell":
        raise BusinessFehler("Lade eine unterstützte .slmodell-Datei.")
    fingerprint = datei_fingerabdruck(kontext, pfad)
    kontext.quelle_merken(fingerprint)
    modell = lesen(pfad, kontext)
    quellen_pruefen(kontext, [fingerprint])
    modell.quellen = (pfad,)
    modell.originale = (fingerprint,)
    return _merken(kontext, modell)


def vorhersagen(kontext, k, e):
    if _geplant(e):
        return {"status": "geplant", "operation": "ml.vorhersagen"}
    _ml_profil(kontext)
    from scriptlab_business.daten import engine, _bezeichner, _Quelle
    from scriptlab_business.dateien import quellen_pruefen
    _felder(k, e, ("ausgabespalte",), ("modell", "tabelle"))
    modell = _modell(kontext, e.get("modell"))
    quellen_pruefen(kontext, modell.originale)
    daten = engine(kontext)
    tabelle = daten.tabelle(e.get("tabelle"))
    spalte = k.get("ausgabespalte", "Vorhersage")
    namen = [s.name for s in tabelle.spalten]
    if not isinstance(spalte, str) or not spalte.strip() or "\0" in spalte or spalte.casefold() in [n.casefold() for n in namen]:
        raise BusinessFehler("Die Vorhersagespalte benötigt einen neuen, eindeutigen Namen.")
    schema = modell.metadaten["schema"]
    if any(s["name"] not in namen or next(v.typ for v in tabelle.spalten if v.name == s["name"]) != s["typ"] for s in schema):
        raise BusinessFehler("Merkmalsnamen oder Datentypen passen nicht zum gespeicherten Modell.")
    indizes = [namen.index(s["name"]) for s in schema]
    name = "ml_" + uuid.uuid4().hex
    reihenfolge = "sl_" + uuid.uuid4().hex
    # Nur vorhandene DuckDB-Schematypen verwenden, keine SQL-Typen aus Modellmetadaten.
    klassen = modell.metadaten["klassen"]
    typ = "DOUBLE" if not klassen or type(klassen[0]) is float else "BOOLEAN" if type(klassen[0]) is bool else "BIGINT" if type(klassen[0]) is int and all(-(2**63) <= w < 2**63 for w in klassen) else "VARCHAR"
    definitionen = [f"{_bezeichner(s.name)} {s.typ}" for s in tabelle.spalten]
    daten._verbindung.execute(f"CREATE TABLE {_bezeichner(name)} ({','.join(definitionen)}, {_bezeichner(spalte)} {typ}, {_bezeichner(reihenfolge)} BIGINT)")
    modellquellen = tuple(_Quelle(Path(q["pfad"]), q["bytes"], q["sha256"], tuple(q["stat"])) for q in modell.originale)
    quellen = tuple(dict.fromkeys((*daten._plan(tabelle).quellen, *modellquellen)))
    zaehler, paket = 0, []
    def schreiben():
        nonlocal zaehler
        kontext.pruefen()
        matrix = transformieren([tuple(z[i] for i in indizes) for z in paket], schema)
        prognose = _vorhersage(modell, matrix)
        werte = [(*z, float(w) if typ == "DOUBLE" else str(w) if typ == "VARCHAR" else w, zaehler + i) for i, (z, w) in enumerate(zip(paket, prognose))]
        daten._verbindung.executemany(f"INSERT INTO {_bezeichner(name)} VALUES ({','.join('?' for _ in range(len(namen)+2))})", werte)
        zaehler += len(paket)
        paket.clear()
    try:
        for zeile in daten.zeilen(tabelle, PAKETGROESSE):
            paket.append(zeile)
            if len(paket) == PAKETGROESSE:
                schreiben()
        if paket:
            schreiben()
        kontext.pruefen()
        quellen_pruefen(kontext, modell.originale)
        rueckgabe = daten._neu(f"SELECT {','.join(_bezeichner(n) for n in [*namen,spalte])} FROM {_bezeichner(name)} ORDER BY {_bezeichner(reihenfolge)}", quellen=quellen)
        return rueckgabe.json()
    except BaseException:
        daten._verbindung.execute(f"DROP TABLE IF EXISTS {_bezeichner(name)}")
        raise


HANDLER = {"ml.trainieren": trainieren, "ml.speichern": speichern, "ml.laden": laden, "ml.vorhersagen": vorhersagen}


def _geplant(wert):
    if isinstance(wert, dict):
        ml = wert.get("ml_geplant") is True or str(wert.get("operation", "")).startswith("ml.")
        return (wert.get("status") == "geplant" and ml) or any(_geplant(v) for v in wert.values())
    return isinstance(wert, list) and any(_geplant(v) for v in wert)
