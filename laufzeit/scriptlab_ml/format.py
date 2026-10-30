"""Versioniertes Modellarchiv mit festen Typen; kein pickle/joblib-Fallback."""
from __future__ import annotations

import hashlib
import io
import json
import math
from pathlib import PurePosixPath
import zipfile

from scriptlab_business.kontext import BusinessFehler, daten_hash
from .vorbereitung import validieren

MAX_ARCHIV_BYTES = 256 * 1024 ** 2
MAX_METADATA_BYTES = 2 * 1024 ** 2
SKOPS_TYPEN = frozenset({
    "sklearn.ensemble._forest.RandomForestClassifier", "sklearn.ensemble._forest.RandomForestRegressor",
    "sklearn.tree._classes.DecisionTreeClassifier", "sklearn.tree._classes.DecisionTreeRegressor",
    "sklearn.tree._tree.Tree",
    *[f"builtins.{n}" for n in ("dict", "list", "tuple", "str", "int", "float", "bool", "NoneType")],
    *[f"numpy.{n}" for n in ("ndarray", "dtype", "int32", "int64", "uint32", "uint64", "float32", "float64", "bool_", "object_")],
})


def versionen():
    from .profil import identitaet
    return identitaet()


def _json(daten):
    def paare(werte):
        ergebnis = {}
        for k, v in werte:
            if k in ergebnis:
                raise BusinessFehler("Das Modell enthält doppelte Metadatenfelder.")
            ergebnis[k] = v
        return ergebnis
    def konstante(_):
        raise BusinessFehler("Das Modell enthält ungültige Zahlen.")
    return json.loads(daten, object_pairs_hook=paare, parse_constant=konstante)


def _archiv(archiv, *, maximal=MAX_ARCHIV_BYTES):
    infos = archiv.infolist()
    namen = [i.filename for i in infos]
    if len(infos) > 5000 or len(set(namen)) != len(namen) or sum(i.file_size for i in infos) > maximal:
        raise BusinessFehler("Das Modellarchiv überschreitet die Eintrags-/Größengrenze oder enthält doppelte Namen.")
    for i in infos:
        p = PurePosixPath(i.filename)
        if p.is_absolute() or ".." in p.parts or "\\" in i.filename or ":" in i.filename or i.flag_bits & 1 or (i.external_attr >> 16) & 0o170000 == 0o120000:
            raise BusinessFehler("Das Modellarchiv enthält einen unerlaubten Pfad, Link oder verschlüsselten Eintrag.")
        if i.file_size > max(1024 * 1024, i.compress_size * 200):
            raise BusinessFehler("Die Kompressionsrate des Modellarchivs ist unzulässig.")
    return set(namen)


def _metadaten(m, laufzeit_hash=None):
    felder = {"version", "format", "ml_version", "versionen", "laufzeitfingerabdruck", "aufgabe", "verfahren", "zielspalte", "zieltyp", "schema", "klassen", "zielmittel", "zielskala", "trainingszeilen", "testzeilen", "testanteil", "zufallsseed", "baeume", "max_tiefe", "epochen", "trainingsfingerabdruck", "metriken"}
    if not isinstance(m, dict) or set(m) != felder or m["version"] != 1 or m["format"] != "ScriptLab-ML" or m["ml_version"] != "1.0.0":
        raise BusinessFehler("Die Modelldatei hat ein unbekanntes Format oder eine unbekannte Version.")
    if m["versionen"] != versionen():
        raise BusinessFehler("Die Python-/ML-Paketversionen passen nicht zur Modelldatei. Verwende dasselbe ML-Profil.")
    if laufzeit_hash is None:
        from scriptlab_business.kontext import runtime_hash_berechnen
        laufzeit_hash = runtime_hash_berechnen(True)
    if m["laufzeitfingerabdruck"] != laufzeit_hash:
        raise BusinessFehler("Die vollständige ML-Laufzeit oder ihre Lockdatei passt nicht zum Modell. Verwende dieselbe geprüfte Laufzeit.")
    dimensionen = validieren(m["schema"])
    if m["aufgabe"] not in {"KLASSIFIKATION", "REGRESSION"} or m["verfahren"] not in {"RANDOM_FOREST", "PYTORCH"}:
        raise BusinessFehler("Die Modelldatei verwendet eine unbekannte Aufgabe oder Architektur.")
    if not isinstance(m["zielspalte"], str) or not m["zielspalte"] or m["zielspalte"] in [s["name"] for s in m["schema"]] or not isinstance(m["zieltyp"], str):
        raise BusinessFehler("Die Zielspalte der Modelldatei ist ungültig.")
    if any(type(m[n]) is not int or not a <= m[n] <= b for n, a, b in (("trainingszeilen", 2, 100000), ("testzeilen", 2, 100000), ("zufallsseed", 0, 2147483647), ("baeume", 1, 1000), ("max_tiefe", 1, 32), ("epochen", 1, 1000))):
        raise BusinessFehler("Die Trainingsangaben der Modelldatei sind ungültig.")
    if type(m["testanteil"]) not in {int, float} or not .05 <= m["testanteil"] <= .5:
        raise BusinessFehler("Der gespeicherte Testanteil ist ungültig.")
    if any(type(m[n]) not in {int, float} or not math.isfinite(m[n]) for n in ("zielmittel", "zielskala")) or m["zielskala"] <= 0:
        raise BusinessFehler("Die Zielskalierung der Modelldatei ist ungültig.")
    klassen = m["klassen"]
    if not isinstance(klassen, list) or any(type(w) not in {str, int, float, bool} or (type(w) is float and not math.isfinite(w)) for w in klassen):
        raise BusinessFehler("Die gespeicherten Zielklassen sind ungültig.")
    if (m["aufgabe"] == "KLASSIFIKATION" and (not 2 <= len(klassen) <= 256 or len(set(klassen)) != len(klassen) or len({type(w) for w in klassen}) != 1)) or (m["aufgabe"] == "REGRESSION" and klassen):
        raise BusinessFehler("Die gespeicherten Klassen passen nicht zur ML-Aufgabe.")
    metriken = {"accuracy", "f1_macro"} if klassen else {"mae", "rmse", "r2"}
    if not isinstance(m["metriken"], dict) or set(m["metriken"]) != metriken or any((w is None and n != "r2") or (w is not None and (type(w) not in {int, float} or not math.isfinite(w))) for n, w in m["metriken"].items()):
        raise BusinessFehler("Die gespeicherten Testmetriken sind ungültig.")
    if not isinstance(m["trainingsfingerabdruck"], str) or len(m["trainingsfingerabdruck"]) != 64:
        raise BusinessFehler("Der Trainingsfingerabdruck ist ungültig.")
    return dimensionen


def _skops_pruefen(daten, metadaten):
    import skops.io as sio
    # Der innere ZIP-Baum bleibt ebenfalls begrenzt; keine Pfade werden entpackt.
    with zipfile.ZipFile(io.BytesIO(daten)) as archiv:
        _archiv(archiv)
        if "schema.json" not in archiv.namelist() or archiv.getinfo("schema.json").file_size > MAX_METADATA_BYTES:
            raise BusinessFehler("Das Skops-Modellschema fehlt oder ist zu groß.")
        schema = _json(archiv.read("schema.json"))
        from .baumpruefung import pruefen
        pruefen(schema, archiv, metadaten)
    def pruefen(wert, tiefe=0):
        if tiefe > 100:
            raise BusinessFehler("Das Skops-Modellschema ist zu tief verschachtelt.")
        if isinstance(wert, dict):
            loader = wert.get("__loader__")
            if loader is not None and loader not in {"JsonNode", "DictNode", "ListNode", "TupleNode", "TypeNode", "ObjectNode", "NdArrayNode", "TreeNode"}:
                raise BusinessFehler("Das Skops-Modellschema enthält einen nicht freigegebenen Loader.")
            if "__module__" in wert and "__class__" in wert:
                typ = f"{wert['__module__']}.{wert['__class__']}"
                if typ not in SKOPS_TYPEN:
                    raise BusinessFehler(f"Der Modelltyp wird nicht geladen: {typ}")
                if (loader == "TreeNode" and typ != "sklearn.tree._tree.Tree") or (loader == "ObjectNode" and typ not in {"sklearn.ensemble._forest.RandomForestClassifier", "sklearn.ensemble._forest.RandomForestRegressor", "sklearn.tree._classes.DecisionTreeClassifier", "sklearn.tree._classes.DecisionTreeRegressor"}):
                    raise BusinessFehler("Ein Skops-Typ verwendet einen unzulässigen Loader.")
            for kind in wert.values():
                pruefen(kind, tiefe + 1)
        elif isinstance(wert, list):
            for kind in wert:
                pruefen(kind, tiefe + 1)
    pruefen(schema)
    unbekannt = set(sio.get_untrusted_types(data=daten))
    if not unbekannt.issubset(SKOPS_TYPEN):
        raise BusinessFehler("Die Modelldatei enthält nicht freigegebene Skops-Typen.")


def schreiben(pfad, modell):
    m = modell.metadaten
    _metadaten(m)
    if m["verfahren"] == "RANDOM_FOREST":
        import skops.io as sio
        payload = sio.dumps(modell.schaetzer)
        _skops_pruefen(payload, m)
        name = "modell.skops"
    else:
        import torch
        datei = io.BytesIO()
        torch.save(modell.schaetzer.state_dict(), datei)
        payload, name = datei.getvalue(), "gewichte.pt"
    manifest = {"metadaten": m, "nutzlast": name, "sha256": hashlib.sha256(payload).hexdigest()}
    manifest["fingerabdruck"] = daten_hash(manifest)
    kopf = json.dumps(manifest, ensure_ascii=True, sort_keys=True, allow_nan=False).encode("utf-8")
    if len(kopf) > MAX_METADATA_BYTES or len(payload) + len(kopf) > MAX_ARCHIV_BYTES:
        raise BusinessFehler("Das Modell überschreitet die Grenze von 256 MiB oder 2 MiB Metadaten.")
    with zipfile.ZipFile(pfad, "w", compression=zipfile.ZIP_STORED) as archiv:
        archiv.writestr("modell.json", kopf)
        archiv.writestr(name, payload)


def lesen(pfad, kontext):
    from .verarbeitung import Modell, architektur
    kontext.pruefen()
    try:
        if pfad.stat().st_size > MAX_ARCHIV_BYTES + 4096:
            raise BusinessFehler("Die Modelldatei überschreitet die geprüfte Archivgrenze von 256 MiB.")
        with zipfile.ZipFile(pfad) as archiv:
            namen = _archiv(archiv)
            if "modell.json" not in namen or archiv.getinfo("modell.json").file_size > MAX_METADATA_BYTES:
                raise BusinessFehler("Die begrenzten Modellmetadaten fehlen.")
            manifest = _json(archiv.read("modell.json"))
            if not isinstance(manifest, dict) or set(manifest) != {"metadaten", "nutzlast", "sha256", "fingerabdruck"}:
                raise BusinessFehler("Das Modellmanifest ist ungültig.")
            fingerabdruck = manifest.pop("fingerabdruck")
            if fingerabdruck != daten_hash(manifest):
                raise BusinessFehler("Der Fingerabdruck der Modellmetadaten stimmt nicht.")
            m = manifest["metadaten"]
            dimensionen = _metadaten(m, kontext.runtime_hash)
            name = "modell.skops" if m["verfahren"] == "RANDOM_FOREST" else "gewichte.pt"
            if manifest["nutzlast"] != name or namen != {"modell.json", name}:
                raise BusinessFehler("Die Modelldatei enthält unbekannte oder fehlende Bestandteile.")
            payload = archiv.read(name)
        if hashlib.sha256(payload).hexdigest() != manifest["sha256"]:
            raise BusinessFehler("Der Fingerabdruck der Modellgewichte stimmt nicht.")
        kontext.pruefen()
        if name == "modell.skops":
            import skops.io as sio
            from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
            _skops_pruefen(payload, m)
            modell = sio.loads(payload, trusted=list(SKOPS_TYPEN))
            erwartet = RandomForestClassifier if m["aufgabe"] == "KLASSIFIKATION" else RandomForestRegressor
            if type(modell) is not erwartet or modell.n_features_in_ != dimensionen or len(modell.estimators_) != m["baeume"] or modell.n_estimators != m["baeume"] or modell.max_depth != m["max_tiefe"] or modell.n_jobs != 1 or modell.warm_start is not False or modell.random_state != m["zufallsseed"]:
                raise BusinessFehler("Die gespeicherten Random-Forest-Gewichte passen nicht zum Modellvertrag.")
            from sklearn.tree import DecisionTreeClassifier, DecisionTreeRegressor
            import numpy as np
            baumtyp = DecisionTreeClassifier if m["klassen"] else DecisionTreeRegressor
            if modell.n_outputs_ != 1 or any(type(b) is not baumtyp or b.n_features_in_ != dimensionen or b.n_outputs_ != 1 for b in modell.estimators_) or (m["klassen"] and (not np.array_equal(modell.classes_, np.arange(len(m["klassen"]))) or modell.n_classes_ != len(m["klassen"]))):
                raise BusinessFehler("Die RF-Klassen oder Einzelbäume passen nicht zum festen Modellvertrag.")
        else:
            import torch
            with zipfile.ZipFile(io.BytesIO(payload)) as archiv:
                _archiv(archiv)
            gewichte = torch.load(io.BytesIO(payload), map_location="cpu", weights_only=True)
            modell = architektur(dimensionen, len(m["klassen"]) if m["klassen"] else 1)
            erwartet = modell.state_dict()
            if not isinstance(gewichte, dict) or set(gewichte) != set(erwartet) or any(type(w) is not torch.Tensor or w.device.type != "cpu" or w.dtype != torch.float32 or w.shape != erwartet[n].shape or not torch.isfinite(w).all() for n, w in gewichte.items()):
                raise BusinessFehler("Die Modellgewichte passen nicht zur festen CPU-Architektur 64/32.")
            modell.load_state_dict(gewichte, strict=True)
            modell.eval()
        kontext.pruefen()
        return Modell(m, modell)
    except BusinessFehler:
        raise
    except Exception as fehler:
        raise BusinessFehler("Die Modelldatei konnte nicht geprüft werden. Verwende eine unveränderte .slmodell-Datei aus demselben ML-Profil.") from fehler
