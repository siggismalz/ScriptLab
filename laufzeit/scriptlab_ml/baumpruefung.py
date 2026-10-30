"""RF-Knoten vor der nativen Sklearn-Konstruktion aus begrenzten JSON/NPY-Daten prüfen."""
from __future__ import annotations

import io
import math
from scriptlab_business.kontext import BusinessFehler
from .vorbereitung import validieren


def pruefen(schema, archiv, metadaten):
    import numpy as np
    dimensionen = validieren(metadaten["schema"])
    klassen = len(metadaten["klassen"]) or 1
    arrays = {}

    def lesen(node):
        if not isinstance(node, dict):
            raise BusinessFehler("Ein RF-Strukturwert ist ungültig.")
        loader = node.get("__loader__")
        if loader == "JsonNode":
            import json
            wert = json.loads(node["content"])
            if wert is None or type(wert) in {bool, int, float, str}:
                return wert
        elif loader in {"TupleNode", "ListNode"}:
            return [lesen(w) for w in node["content"]]
        elif loader == "DictNode":
            return {k: lesen(v) for k, v in node["content"].items()}
        elif loader == "NdArrayNode" and node.get("type") == "numpy":
            name = node.get("file")
            if name not in arrays:
                if not isinstance(name, str) or name not in archiv.namelist() or not name.endswith(".npy"):
                    raise BusinessFehler("Ein RF-Array fehlt im Modellarchiv.")
                roh = archiv.read(name)
                datei = io.BytesIO(roh)
                version = np.lib.format.read_magic(datei)
                if version not in {(1, 0), (2, 0)}:
                    raise BusinessFehler("Das RF-Arrayformat wird nicht unterstützt.")
                header = np.lib.format.read_array_header_1_0 if version == (1, 0) else np.lib.format.read_array_header_2_0
                shape, _, dtype = header(datei, max_header_size=16384)
                umfang = math.prod(shape) * dtype.itemsize
                if dtype.hasobject or not 0 < dtype.itemsize <= 4096 or len(shape) > 4 or any(type(n) is not int or n < 0 for n in shape) or umfang != len(roh) - datei.tell() or umfang > 256 * 1024 ** 2:
                    raise BusinessFehler("Das RF-Array hat einen ungültigen Typ, Umfang oder Objektinhalt.")
                arrays[name] = np.load(io.BytesIO(roh), allow_pickle=False, max_header_size=16384)
            return arrays[name]
        raise BusinessFehler("Das RF-Archiv enthält eine unerlaubte Strukturkodierung.")

    anzahl_baeume = 0
    def baum(node):
        nonlocal anzahl_baeume
        args = lesen(node["__reduce__"]["args"])
        zustand = lesen(node["content"])
        if len(args) != 3 or args[0] != dimensionen or args[2] != 1 or not isinstance(args[1], np.ndarray) or args[1].shape != (1,) or args[1].dtype.kind not in "iu" or int(args[1][0]) != klassen:
            raise BusinessFehler("Die RF-Baumargumente passen nicht zum Spaltenschema.")
        if not isinstance(zustand, dict) or set(zustand) != {"max_depth", "node_count", "nodes", "values"}:
            raise BusinessFehler("Der RF-Knotenzustand ist unbekannt.")
        n, tiefe = zustand["node_count"], zustand["max_depth"]
        if type(n) is not int or not 1 <= n <= min(2 ** (metadaten["max_tiefe"] + 1) - 1, 2 * metadaten["trainingszeilen"] - 1) or type(tiefe) is not int or not 0 <= tiefe <= metadaten["max_tiefe"]:
            raise BusinessFehler("Die RF-Knotenzahl oder Baumtiefe ist ungültig.")
        nodes, values = zustand["nodes"], zustand["values"]
        felder = {"left_child", "right_child", "feature", "threshold", "impurity", "n_node_samples", "weighted_n_node_samples", "missing_go_to_left"}
        if not isinstance(nodes, np.ndarray) or nodes.shape != (n,) or set(nodes.dtype.names or ()) != felder or not isinstance(values, np.ndarray) or values.dtype != np.float64 or values.shape != (n, 1, klassen) or not np.isfinite(values).all():
            raise BusinessFehler("Die RF-Knoten-/Wertarrays passen nicht zur festen Struktur.")
        if any(nodes.dtype.fields[f][0].kind not in "iu" for f in ("left_child", "right_child", "feature", "n_node_samples", "missing_go_to_left")) or any(nodes.dtype.fields[f][0].kind != "f" for f in ("threshold", "impurity", "weighted_n_node_samples")):
            raise BusinessFehler("Die RF-Knotenindizes haben unzulässige Datentypen.")
        eltern = np.zeros(n, dtype=np.int32)
        tiefen = np.zeros(n, dtype=np.int32)
        for i, knoten in enumerate(nodes):
            links, rechts, merkmal = (int(knoten[f]) for f in ("left_child", "right_child", "feature"))
            if links == rechts == -1:
                if merkmal != -2:
                    raise BusinessFehler("Ein RF-Blatt hat einen ungültigen Merkmalsindex.")
            else:
                if not (i < links < n and i < rechts < n and links != rechts and 0 <= merkmal < dimensionen):
                    raise BusinessFehler("Ein RF-Knoten enthält ungültige Kind-/Merkmalsindizes.")
                eltern[links] += 1
                eltern[rechts] += 1
                tiefen[links] = tiefen[rechts] = tiefen[i] + 1
            if int(knoten["missing_go_to_left"]) not in {0, 1} or not 1 <= int(knoten["n_node_samples"]) <= metadaten["trainingszeilen"] or not all(math.isfinite(float(knoten[f])) for f in ("threshold", "impurity", "weighted_n_node_samples")) or knoten["weighted_n_node_samples"] <= 0:
                raise BusinessFehler("Ein RF-Knoten enthält ungültige Werte.")
        if eltern[0] != 0 or np.any(eltern[1:] != 1) or int(tiefen.max()) != tiefe:
            raise BusinessFehler("Die RF-Baumstruktur enthält unverbundene oder mehrfach referenzierte Knoten.")
        anzahl_baeume += 1

    def besuchen(wert, tiefe=0):
        if tiefe > 100:
            raise BusinessFehler("Das RF-Schema ist zu tief verschachtelt.")
        if isinstance(wert, dict):
            if wert.get("__loader__") == "TreeNode":
                baum(wert)
            elif wert.get("__loader__") == "NdArrayNode":
                lesen(wert)
            for kind in wert.values():
                besuchen(kind, tiefe + 1)
        elif isinstance(wert, list):
            for kind in wert:
                besuchen(kind, tiefe + 1)
    besuchen(schema)
    if anzahl_baeume != metadaten["baeume"]:
        raise BusinessFehler("Die Anzahl gespeicherter RF-Bäume stimmt nicht mit den Metadaten überein.")
    arrays.clear()
