"""Synthetische CPU-ML-Verträge; Backendfälle benötigen das bewusst eingerichtete ML-Profil."""
from __future__ import annotations

import csv
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import zipfile

from scriptlab_business.ausfuehrung import schritt, _bericht_speichern
from scriptlab_business.daten import engine
from scriptlab_business.kontext import Kontext, BusinessFehler, AbbruchFehler, daten_hash

ML_VERFUEGBAR = all(importlib.util.find_spec(p) is not None for p in ("numpy", "sklearn", "skops", "torch"))


class Grundlage(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="ScriptLab-ML-Test-")
        self.basis = Path(self.temp.name).resolve()
        self.meldungen = []
        self.kontexte = []
        self.kontext = self.neuer_kontext()

    def neuer_kontext(self, modus="ausfuehren", **optionen):
        optionen.setdefault("ml_aktiv", True)
        kontext = Kontext(self.basis, modus, workflow_hash="synthetischer-ml-test", ereignis_callback=self.meldungen.append, **optionen)
        self.kontexte.append(kontext)
        return kontext

    def tearDown(self):
        for kontext in reversed(self.kontexte):
            kontext.schliessen()
        self.temp.cleanup()

    def tabelle(self, aufgabe="KLASSIFIKATION", anzahl=200, kontext=None):
        kontext = kontext or self.kontext
        pfad = self.basis / f"{aufgabe}-{anzahl}.csv"
        with pfad.open("w", encoding="utf-8", newline="") as datei:
            w = csv.writer(datei, delimiter=";")
            w.writerow(["ID", "Zahl", "Gruppe", "Ziel"])
            for i in range(anzahl):
                zahl = (i % 100 - 50) / 10
                gruppe = "A" if zahl < 0 else "B"
                ziel = gruppe if aufgabe == "KLASSIFIKATION" else 3 * zahl + 2
                w.writerow([f"{i:06}", zahl, gruppe, ziel])
        daten = engine(kontext)
        t = daten.importieren("CSV", str(pfad))
        t = daten.spalten(t, {"aktion": "TYP", "spalte": "Zahl", "typ": "ZAHL"})
        if aufgabe == "REGRESSION":
            t = daten.spalten(t, {"aktion": "TYP", "spalte": "Ziel", "typ": "ZAHL"})
        return t

    def training(self, verfahren="RANDOM_FOREST", aufgabe="KLASSIFIKATION", **cfg):
        t = self.tabelle(aufgabe)
        konfiguration = {"verfahren": verfahren, "aufgabe": aufgabe, "zielspalte": "Ziel", "merkmale": ["Zahl", "Gruppe"], **cfg}
        referenz = schritt(self.kontext, "train", "ml.trainieren", konfiguration, {"tabelle": t.json()})
        return referenz, t


class MLPlanTests(Grundlage):
    def test_normale_geplante_dateiausgaben_behalten_ihre_bestehende_pruefbehandlung(self):
        k = self.neuer_kontext("prueflauf", ml_aktiv=False)
        aufrufe = []
        def pruefen(kontext, konfiguration, eingaben):
            aufrufe.append(eingaben)
            return {"bestehende_pruefung": True}
        with patch("scriptlab_business.ausfuehrung._handler", return_value={"dateien.archivieren": pruefen}):
            ergebnis = schritt(k, "archiv", "dateien.archivieren", {}, {"ausgaben": {"status": "geplant", "pfad": "fachliches-ziel.csv"}})
        self.assertEqual(ergebnis, {"bestehende_pruefung": True})
        self.assertEqual(len(aufrufe), 1)

    def test_ungebundener_direktaufruf_wird_vor_schweren_importen_abgewiesen(self):
        k = self.neuer_kontext(ml_aktiv=False)
        for operation in ("ml.trainieren", "ml.speichern", "ml.laden", "ml.vorhersagen"):
            with self.subTest(operation=operation), patch.dict("sys.modules", {"numpy": None, "sklearn": None, "torch": None, "skops": None}), self.assertRaisesRegex(BusinessFehler, "ml_aktiv=True"):
                schritt(k, "kein-ml-lauf", operation, {}, {})
        self.assertIsNone(k._journal)
        self.assertEqual(k.ml_training, [])

    def test_optionale_paketversionen_aendern_nur_expliziten_ml_laufzeithash(self):
        from scriptlab_business.kontext import runtime_hash_berechnen
        from scriptlab_ml.profil import version, ML_PAKETE
        festgelegt = [z.split("==")[0] for z in (Path(__file__).resolve().parents[2] / "laufzeit" / "requirements-ml.in").read_text(encoding="utf-8").splitlines() if "==" in z and not z.startswith("#")]
        self.assertEqual(set(ML_PAKETE), set(festgelegt))
        self.assertEqual(len(ML_PAKETE), 21)
        basis = runtime_hash_berechnen()
        ml = runtime_hash_berechnen(True)
        for paket in ("joblib", "threadpoolctl"):
            def ersetzt(name):
                return "synthetische-andere-version" if name == paket else version(name)
            with self.subTest(paket=paket), patch("scriptlab_ml.profil.version", side_effect=ersetzt):
                self.assertEqual(runtime_hash_berechnen(), basis)
                self.assertNotEqual(runtime_hash_berechnen(True), ml)

    def test_ml_lock_ist_pflicht_und_aendert_nur_ml_hash_vor_journalstart(self):
        from scriptlab_business.kontext import runtime_hash_berechnen
        basis, ml = runtime_hash_berechnen(), runtime_hash_berechnen(True)
        lesen = Path.read_bytes
        def geaendert(pfad):
            inhalt = lesen(pfad)
            return bytes([inhalt[0] ^ 1]) + inhalt[1:] if pfad.name == "requirements-ml.lock" else inhalt
        with patch.object(Path, "read_bytes", geaendert):
            self.assertEqual(runtime_hash_berechnen(), basis)
            self.assertNotEqual(runtime_hash_berechnen(True), ml)
        def fehlend(pfad):
            if pfad.name == "requirements-ml.lock":
                raise FileNotFoundError("Synthetisch fehlende Lockdatei")
            return lesen(pfad)
        with patch.object(Path, "read_bytes", fehlend):
            self.assertEqual(runtime_hash_berechnen(), basis)
            with self.assertRaisesRegex(BusinessFehler, "requirements-ml.lock"):
                Kontext(self.basis, "ausfuehren", ml_aktiv=True)

    def test_train_save_und_nachfolger_bleiben_ohne_profil_geplant(self):
        for modus in ("vorschau", "prueflauf"):
            with self.subTest(modus=modus):
                k = self.neuer_kontext(modus)
                with patch.dict("sys.modules", {"scriptlab_ml.verarbeitung": None}):
                    train = schritt(k, "train", "ml.trainieren", {}, {})
                    save = schritt(k, "save", "ml.speichern", {"pfad": "niemals.slmodell"}, {"modell": {"referenz": "train"}})
                    predict = schritt(k, "predict", "ml.vorhersagen", {}, {"modell": {"referenz": "train"}})
                    export = schritt(k, "export", "daten.exportieren", {"format": "CSV", "pfad": "niemals.csv"}, {"tabelle": {"referenz": "predict"}})
                self.assertTrue(all(w["status"] == "geplant" for w in (train, save, predict, export)))
                self.assertFalse((self.basis / "niemals.slmodell").exists())
                self.assertFalse((self.basis / "niemals.csv").exists())
                self.assertEqual(k.ml_training, [])

    def test_ml_handle_enthaelt_keine_gewichte_oder_rohdaten(self):
        from scriptlab_business.typen import MLModell
        self.assertEqual(set(MLModell("x", "REGRESSION", "PYTORCH", ("A",), "Y", {}).json()),
                         {"ml_modell", "aufgabe", "verfahren", "merkmale", "zielspalte", "metriken"})


@unittest.skipUnless(ML_VERFUEGBAR, "Optionales ML-Profil ist in diesem Interpreter nicht eingerichtet.")
class MLVerarbeitungTests(Grundlage):
    def test_archiv_und_journal_binden_alle_profilversionen_und_lock(self):
        from scriptlab_ml.profil import version
        from scriptlab_ml.verarbeitung import _modell
        from scriptlab_ml.format import schreiben
        ref, _ = self.training(baeume=10)
        schritt(self.kontext, "save", "ml.speichern", {}, {"modell": ref})
        modell = _modell(self.kontext, ref)
        self.assertEqual(len(modell.metadaten["versionen"]["pakete"]), 21)
        self.assertEqual(modell.metadaten["laufzeitfingerabdruck"], self.kontext.runtime_hash)
        original = (self.basis / "modell.slmodell").read_bytes()
        for paket in ("joblib", "threadpoolctl"):
            def ersetzt(name):
                return "synthetische-andere-version" if name == paket else version(name)
            with self.subTest(paket=paket), patch("scriptlab_ml.profil.version", side_effect=ersetzt):
                k = self.neuer_kontext()
                self.assertNotEqual(k.runtime_hash, self.kontext.runtime_hash)
                self.assertIsNone(k._journal)
                with self.assertRaises(BusinessFehler):
                    schritt(k, "load", "ml.laden", {}, {})
                with self.assertRaises(BusinessFehler):
                    schreiben(self.basis / "niemals.slmodell", modell)
        lesen = Path.read_bytes
        def geaendert(pfad):
            inhalt = lesen(pfad)
            return bytes([inhalt[0] ^ 1]) + inhalt[1:] if pfad.name == "requirements-ml.lock" else inhalt
        with patch.object(Path, "read_bytes", geaendert):
            k = self.neuer_kontext()
            self.assertNotEqual(k.runtime_hash, self.kontext.runtime_hash)
            with self.assertRaises(BusinessFehler):
                schritt(k, "load", "ml.laden", {}, {})
        self.assertEqual((self.basis / "modell.slmodell").read_bytes(), original)
        self.assertFalse((self.basis / "niemals.slmodell").exists())

    def test_resume_bindet_tatsaechliche_gewichte_und_stabile_modellquelle(self):
        from scriptlab_ml.verarbeitung import _modell, _gewichtsfingerabdruck
        from scriptlab_ml.format import schreiben
        ref, _ = self.training(aufgabe="REGRESSION", baeume=10, max_tiefe=4)
        schritt(self.kontext, "save", "ml.speichern", {}, {"modell": ref})
        def lauf(fortsetzen=False):
            with Kontext(self.basis, "ausfuehren", workflow_hash="ml-resume-gewichte", ml_aktiv=True, fortsetzen=fortsetzen) as k:
                t = schritt(k, "quelle", "daten.importieren", {"format": "CSV", "pfad": "REGRESSION-200.csv"}, {})
                for name in ("Zahl", "Ziel"):
                    t = schritt(k, f"typ-{name}", "daten.spalten", {"aktion": "TYP", "spalte": name, "typ": "ZAHL"}, {"tabelle": t})
                m = schritt(k, "load", "ml.laden", {}, {})
                p = schritt(k, "predict", "ml.vorhersagen", {}, {"modell": m, "tabelle": t})
                return schritt(k, "export", "daten.exportieren", {"format": "CSV", "pfad": "prognose.csv"}, {"tabelle": p})
        self.assertEqual(lauf()["status"], "publiziert")
        original = (self.basis / "prognose.csv").read_bytes()
        self.assertEqual(lauf(True)["status"], "wiederverwendet")
        intern = _modell(self.kontext, ref)
        metadaten = json.loads(json.dumps(intern.metadaten))
        gewicht_vorher = _gewichtsfingerabdruck(self.kontext, intern)
        for baum in intern.schaetzer.estimators_:
            baum.tree_.value[:] += 100
        self.assertEqual(intern.metadaten, metadaten)
        self.assertNotEqual(_gewichtsfingerabdruck(self.kontext, intern), gewicht_vorher)
        schreiben(self.basis / "modell.slmodell", intern)
        with self.assertRaisesRegex(BusinessFehler, "andere Eingaben oder Quellen"):
            lauf(True)
        self.assertEqual((self.basis / "prognose.csv").read_bytes(), original)

    def test_geaenderte_modellquelle_verhindert_predict_und_nachgelagerten_export(self):
        ref, t = self.training()
        schritt(self.kontext, "save", "ml.speichern", {}, {"modell": ref})
        geladen = schritt(self.kontext, "load", "ml.laden", {}, {})
        prognose = schritt(self.kontext, "predict", "ml.vorhersagen", {}, {"modell": geladen, "tabelle": t.json()})
        with (self.basis / "modell.slmodell").open("ab") as datei:
            datei.write(b"Nach dem Laden geaendert")
        with self.assertRaises(BusinessFehler):
            schritt(self.kontext, "export", "daten.exportieren", {"format": "CSV", "pfad": "unveroeffentlicht.csv"}, {"tabelle": prognose})
        self.assertFalse((self.basis / "unveroeffentlicht.csv").exists())
        with self.assertRaises(BusinessFehler):
            schritt(self.kontext, "predict-neu", "ml.vorhersagen", {}, {"modell": geladen, "tabelle": t.json()})

    def test_fehlende_und_unbekannte_merkmale_werden_mit_gelernter_transformation_vorhergesagt(self):
        ref, _ = self.training()
        p = self.basis / "unbekannt.csv"
        p.write_text("ID;Zahl;Gruppe\n001;;NEU\n002;1.5;\n003;-2.5;A\n", encoding="utf-8")
        d = engine(self.kontext)
        t = d.spalten(d.importieren("CSV", str(p)), {"aktion": "TYP", "spalte": "Zahl", "typ": "ZAHL"})
        alt = list(d.zeilen(t))
        ergebnis = schritt(self.kontext, "predict", "ml.vorhersagen", {}, {"modell": ref, "tabelle": t.json()})
        zeilen = list(d.zeilen(d.tabelle(ergebnis)))
        self.assertEqual([z[:-1] for z in zeilen], alt)
        self.assertTrue(all(z[-1] in {"A", "B"} for z in zeilen))

    def test_torch_weights_only_und_feste_architektur_weisen_falsche_gewichte_ab(self):
        import torch
        ref, _ = self.training("PYTORCH")
        schritt(self.kontext, "save", "ml.speichern", {}, {"modell": ref})
        with zipfile.ZipFile(self.basis / "modell.slmodell") as z:
            manifest = json.loads(z.read("modell.json"))
            payload = z.read("gewichte.pt")
        original = torch.load
        for art in ("form", "typ", "nicht_endlich"):
            gewichte = original(io.BytesIO(payload), weights_only=True, map_location="cpu")
            if art == "form":
                gewichte["0.weight"] = torch.zeros((1, 1))
            elif art == "typ":
                gewichte["0.weight"] = "Kein Tensor"
            else:
                gewichte["0.weight"][0, 0] = float("nan")
            roh = io.BytesIO()
            torch.save(gewichte, roh)
            m = json.loads(json.dumps(manifest))
            m["sha256"] = hashlib.sha256(roh.getvalue()).hexdigest()
            m.pop("fingerabdruck")
            m["fingerabdruck"] = daten_hash(m)
            p = self.basis / f"torch-{art}.slmodell"
            with zipfile.ZipFile(p, "w") as z:
                z.writestr("modell.json", json.dumps(m))
                z.writestr("gewichte.pt", roh.getvalue())
            with self.subTest(art=art), patch.object(torch, "load", wraps=original) as loader:
                with self.assertRaises(BusinessFehler):
                    schritt(self.kontext, "bad-weights", "ml.laden", {"pfad": p.name}, {})
                self.assertTrue(loader.call_args.kwargs["weights_only"])
                self.assertEqual(loader.call_args.kwargs["map_location"], "cpu")

    def test_konstantes_regressionsziel_meldet_r2_als_nicht_definiert(self):
        p = self.basis / "konstant.csv"
        p.write_text("X;Y\n" + "".join(f"{i};7\n" for i in range(40)), encoding="utf-8")
        d = engine(self.kontext)
        t = d.importieren("CSV", str(p))
        for n in ("X", "Y"):
            t = d.spalten(t, {"aktion": "TYP", "spalte": n, "typ": "ZAHL"})
        ref = schritt(self.kontext, "constant", "ml.trainieren", {"aufgabe": "REGRESSION", "merkmale": ["X"], "zielspalte": "Y"}, {"tabelle": t.json()})
        self.assertEqual(ref["metriken"], {"mae": 0., "rmse": 0., "r2": None})

    def test_rf_abbruch_zwischen_baumgruppen_meldet_keinen_trainingserfolg(self):
        from sklearn.ensemble import RandomForestClassifier
        original = RandomForestClassifier.fit
        aufrufe = []
        def unterbrechen(modell, *args, **kwargs):
            ergebnis = original(modell, *args, **kwargs)
            aufrufe.append(modell.n_estimators)
            self.kontext.abgebrochen = True
            return ergebnis
        with patch.object(RandomForestClassifier, "fit", unterbrechen), self.assertRaises(AbbruchFehler):
            self.training()
        self.assertEqual(aufrufe, [10])
        self.assertEqual(self.kontext.ml_training, [])

    def test_beide_backends_und_aufgaben_mit_persistenz_und_unabhaengigen_metriken(self):
        from sklearn.model_selection import train_test_split
        from scriptlab_ml.verarbeitung import _modell, _vorhersage
        from scriptlab_ml.vorbereitung import transformieren
        for verfahren in ("RANDOM_FOREST", "PYTORCH"):
            for aufgabe in ("KLASSIFIKATION", "REGRESSION"):
                with self.subTest(verfahren=verfahren, aufgabe=aufgabe):
                    ref, t = self.training(verfahren, aufgabe)
                    intern = _modell(self.kontext, ref)
                    alle = list(engine(self.kontext).zeilen(t))
                    _, test = train_test_split(list(range(200)), test_size=.2, random_state=42,
                                               stratify=[z[3] for z in alle] if aufgabe == "KLASSIFIKATION" else None)
                    x = transformieren([(alle[i][1], alle[i][2]) for i in test], intern.metadaten["schema"])
                    prognose = _vorhersage(intern, x)
                    if aufgabe == "KLASSIFIKATION":
                        erwartet = [alle[i][3] for i in test]
                        accuracy = sum(a == b for a, b in zip(erwartet, prognose)) / len(test)
                        f1 = []
                        for klasse in ("A", "B"):
                            tp = sum(a == b == klasse for a, b in zip(erwartet, prognose))
                            fp = sum(a != klasse and b == klasse for a, b in zip(erwartet, prognose))
                            fn = sum(a == klasse and b != klasse for a, b in zip(erwartet, prognose))
                            f1.append(2 * tp / (2 * tp + fp + fn) if tp else 0)
                        self.assertAlmostEqual(ref["metriken"]["accuracy"], accuracy)
                        self.assertAlmostEqual(ref["metriken"]["f1_macro"], sum(f1) / 2)
                        self.assertGreaterEqual(accuracy, .8)
                    else:
                        erwartet = [alle[i][3] for i in test]
                        differenz = [a - b for a, b in zip(erwartet, prognose)]
                        mittel = sum(erwartet) / len(test)
                        self.assertAlmostEqual(ref["metriken"]["mae"], sum(abs(w) for w in differenz) / len(test))
                        self.assertAlmostEqual(ref["metriken"]["rmse"], (sum(w*w for w in differenz) / len(test)) ** .5)
                        self.assertAlmostEqual(ref["metriken"]["r2"], 1 - sum(w*w for w in differenz) / sum((w-mittel)**2 for w in erwartet))
                    self.assertEqual(intern.metadaten["trainingszeilen"], 160)
                    self.assertEqual(intern.metadaten["testzeilen"], 40)
                    if verfahren == "RANDOM_FOREST":
                        self.assertEqual(len(intern.schaetzer.estimators_samples_[0]), 160)
                    ziel = f"{verfahren}-{aufgabe}.slmodell"
                    gespeichert = schritt(self.kontext, "save", "ml.speichern", {"pfad": ziel}, {"modell": ref})
                    self.assertEqual(gespeichert["status"], "publiziert")
                    geladen = schritt(self.kontext, "load", "ml.laden", {"pfad": ziel}, {})
                    wieder = _vorhersage(_modell(self.kontext, geladen), x)
                    self.assertEqual(prognose, wieder)
                    self.assertEqual(geladen["metriken"], ref["metriken"])
        bericht = json.loads(_bericht_speichern(self.kontext, "erfolgreich", None).read_text(encoding="utf-8"))
        self.assertEqual(len(bericht["ml_training"]), 4)
        self.assertEqual(bericht["ml_training"], self.kontext.ml_training)
        self.assertTrue(any(e["art"] == "ml_fortschritt" and e["epoche"] == 50 for e in self.meldungen))

    def test_preprocessing_lernt_weder_testmittel_noch_testkategorien(self):
        from sklearn.model_selection import train_test_split
        from scriptlab_ml.verarbeitung import _modell
        train, test = train_test_split(list(range(100)), test_size=.2, random_state=42)
        pfad = self.basis / "leakage.csv"
        with pfad.open("w", encoding="utf-8", newline="") as datei:
            w = csv.writer(datei, delimiter=";")
            w.writerow(["Zahl", "Gruppe", "Ziel"])
            for i in range(100):
                w.writerow([1000000 if i in test else i, "NUR_TEST" if i in test else "TRAIN", i * 2])
        d = engine(self.kontext)
        t = d.importieren("CSV", str(pfad))
        for spalte in ("Zahl", "Ziel"):
            t = d.spalten(t, {"aktion": "TYP", "spalte": spalte, "typ": "ZAHL"})
        ref = schritt(self.kontext, "leakage", "ml.trainieren", {"aufgabe": "REGRESSION", "zielspalte": "Ziel", "merkmale": ["Zahl", "Gruppe"]}, {"tabelle": t.json()})
        schema = _modell(self.kontext, ref).metadaten["schema"]
        self.assertAlmostEqual(schema[0]["mittel"], sum(train) / len(train))
        self.assertEqual(schema[1]["kategorien"], ["TRAIN"])

    def test_vorhersage_streamt_ueber_paketgrenzen_und_erhaelt_kennungen_und_reihenfolge(self):
        ref, _ = self.training()
        t = self.tabelle(anzahl=1203)
        vorher = list(engine(self.kontext).zeilen(t))
        ergebnis = schritt(self.kontext, "predict", "ml.vorhersagen", {}, {"modell": ref, "tabelle": t.json()})
        nachher = list(engine(self.kontext).zeilen(engine(self.kontext).tabelle(ergebnis)))
        self.assertEqual([z[:-1] for z in nachher], vorher)
        self.assertEqual(nachher[0][0], "000000")
        self.assertEqual(nachher[-1][0], "001202")
        self.assertTrue(all(z[-1] in {"A", "B"} for z in nachher))

    def test_gespeichertes_modell_darf_in_prueflauf_und_vorschau_lesend_vorhersagen(self):
        ref, _ = self.training()
        schritt(self.kontext, "save", "ml.speichern", {}, {"modell": ref})
        original = (self.basis / "modell.slmodell").read_bytes()
        for modus in ("vorschau", "prueflauf"):
            k = self.neuer_kontext(modus)
            t = self.tabelle(kontext=k)
            geladen = schritt(k, "load", "ml.laden", {}, {})
            ergebnis = schritt(k, "predict", "ml.vorhersagen", {}, {"modell": geladen, "tabelle": t.json()})
            self.assertEqual(len(list(engine(k).zeilen(engine(k).tabelle(ergebnis)))), 200)
            geplant = schritt(k, "save", "ml.speichern", {}, {"modell": geladen})
            self.assertEqual(geplant["status"], "geplant")
            self.assertEqual(original, (self.basis / "modell.slmodell").read_bytes())
            self.assertEqual(k.ml_training, [])

    def test_fehlerhafte_trainingskonfiguration_und_fremder_modellverweis(self):
        t = self.tabelle()
        for cfg in ({"merkmale": ["Ziel"], "zielspalte": "Ziel"}, {"merkmale": ["fehlt"], "zielspalte": "Ziel"},
                    {"merkmale": ["Zahl"], "zielspalte": "fehlt"}, {"merkmale": ["Zahl"], "zielspalte": "Ziel", "testanteil": 0}):
            with self.subTest(cfg=cfg), self.assertRaises(BusinessFehler):
                schritt(self.kontext, "bad", "ml.trainieren", cfg, {"tabelle": t.json()})
        with self.assertRaises(BusinessFehler):
            schritt(self.kontext, "bad", "ml.vorhersagen", {}, {"modell": {"ml_modell": "fremd"}, "tabelle": t.json()})
        klein = self.tabelle(anzahl=4)
        with self.assertRaisesRegex(BusinessFehler, "zehn"):
            schritt(self.kontext, "small", "ml.trainieren", {"zielspalte": "Ziel", "merkmale": ["Zahl"]}, {"tabelle": klein.json()})

    def test_fehlende_ziele_leere_merkmale_und_schlechte_stratifizierung(self):
        d = engine(self.kontext)
        for name, inhalt, meldung in (
            ("ziel", "X;Y\n" + "1;\n" * 20, "fehlende"),
            ("merkmal", "X;Y\n" + " ;A\n" * 10 + " ;B\n" * 10, "vollständig leer"),
            ("klasse", "X;Y\n" + "1;A\n" * 19 + "1;B\n", "zwei Zeilen"),
        ):
            if name == "merkmal":
                inhalt = inhalt.replace(" ;", ";")
            p = self.basis / f"{name}.csv"
            p.write_text(inhalt, encoding="utf-8")
            t = d.importieren("CSV", str(p))
            with self.subTest(name=name), self.assertRaisesRegex(BusinessFehler, meldung):
                schritt(self.kontext, name, "ml.trainieren", {"zielspalte": "Y", "merkmale": ["X"]}, {"tabelle": t.json()})

    def test_namenskonflikt_falsches_schema_und_originalerhalt(self):
        ref, t = self.training()
        with self.assertRaisesRegex(BusinessFehler, "eindeutigen"):
            schritt(self.kontext, "predict", "ml.vorhersagen", {"ausgabespalte": "ID"}, {"modell": ref, "tabelle": t.json()})
        falsch = engine(self.kontext).spalten(t, {"aktion": "TYP", "spalte": "Zahl", "typ": "TEXT"})
        with self.assertRaisesRegex(BusinessFehler, "Datentypen"):
            schritt(self.kontext, "predict", "ml.vorhersagen", {}, {"modell": ref, "tabelle": falsch.json()})
        p = self.basis / "original.slmodell"
        p.write_bytes(b"Unveraendertes Original")
        with self.assertRaises(BusinessFehler):
            schritt(self.kontext, "save", "ml.speichern", {"pfad": p.name}, {"modell": ref})
        self.assertEqual(p.read_bytes(), b"Unveraendertes Original")
        ausgabe = schritt(self.kontext, "skip", "ml.speichern", {"pfad": p.name, "konflikt": "UEBERSPRINGEN"}, {"modell": ref})
        self.assertEqual(ausgabe["status"], "uebersprungen")
        self.assertEqual(p.read_bytes(), b"Unveraendertes Original")

    def test_abbruch_waehrend_torch_epoche_publiziert_keinen_trainingserfolg(self):
        def ereignis(wert):
            self.meldungen.append(wert)
            if wert["art"] == "ml_fortschritt":
                self.kontext.abgebrochen = True
        self.kontext.ereignis_callback = ereignis
        with self.assertRaises(AbbruchFehler):
            self.training("PYTORCH")
        self.assertEqual(self.kontext.ml_training, [])
        self.assertFalse(any(e["art"] == "ml_training" for e in self.meldungen))

    def test_modellarchive_weisen_tamper_versionen_pfade_und_fremde_typen_ab(self):
        import skops.io as sio
        from types import SimpleNamespace
        ref, _ = self.training()
        schritt(self.kontext, "save", "ml.speichern", {}, {"modell": ref})
        p = self.basis / "modell.slmodell"
        with zipfile.ZipFile(p) as z:
            manifest = json.loads(z.read("modell.json"))
            payload = z.read("modell.skops")
        for art in ("fingerabdruck", "version", "pfad", "typ", "metadaten"):
            m = json.loads(json.dumps(manifest))
            inhalt = payload
            if art == "fingerabdruck":
                inhalt = payload[:-1] + bytes([payload[-1] ^ 1])
            elif art == "version":
                m["metadaten"]["versionen"]["python"] = "0.0.0"
            elif art == "typ":
                inhalt = sio.dumps(SimpleNamespace(fremd=True))
                m["sha256"] = hashlib.sha256(inhalt).hexdigest()
            if art != "fingerabdruck":
                m.pop("fingerabdruck")
                m["fingerabdruck"] = daten_hash(m)
            ziel = self.basis / f"ungueltig-{art}.slmodell"
            with zipfile.ZipFile(ziel, "w") as z:
                z.writestr("modell.json", b" " * (2 * 1024**2 + 1) if art == "metadaten" else json.dumps(m))
                z.writestr("modell.skops", inhalt)
                if art == "pfad":
                    z.writestr("../fremd.txt", "niemals entpacken")
            with self.subTest(art=art), self.assertRaises(BusinessFehler):
                schritt(self.kontext, "bad-load", "ml.laden", {"pfad": ziel.name}, {})
        self.assertFalse((self.basis.parent / "fremd.txt").exists())

    def test_manipulierte_rf_indizes_und_npy_header_werden_vor_konstruktion_abgewiesen(self):
        import numpy as np
        import skops.io as sio
        ref, _ = self.training()
        schritt(self.kontext, "save", "ml.speichern", {}, {"modell": ref})
        with zipfile.ZipFile(self.basis / "modell.slmodell") as z:
            manifest = json.loads(z.read("modell.json"))
            payload = z.read("modell.skops")
        with zipfile.ZipFile(io.BytesIO(payload)) as z:
            dateien = {n: z.read(n) for n in z.namelist()}
        schema = json.loads(dateien["schema.json"])
        def baum(wert):
            if isinstance(wert, dict):
                if wert.get("__loader__") == "TreeNode":
                    return wert
                for v in wert.values():
                    gefunden = baum(v)
                    if gefunden is not None:
                        return gefunden
            elif isinstance(wert, list):
                for v in wert:
                    gefunden = baum(v)
                    if gefunden is not None:
                        return gefunden
            return None
        knotenname = baum(schema)["content"]["content"]["nodes"]["file"]
        knoten = np.load(io.BytesIO(dateien[knotenname]), allow_pickle=False)
        for art in ("kind", "merkmal", "zyklus", "npy_umfang"):
            geaendert = knoten.copy()
            if art == "kind":
                geaendert[0]["left_child"] = len(knoten) + 20
            elif art == "merkmal":
                geaendert[0]["feature"] = 90000
            elif art == "zyklus":
                geaendert[0]["left_child"] = 0
            roh = io.BytesIO()
            if art == "npy_umfang":
                np.lib.format.write_array_header_1_0(roh, {"descr": geaendert.dtype.descr, "fortran_order": False, "shape": (1000000000,)})
            else:
                np.save(roh, geaendert, allow_pickle=False)
            innen = io.BytesIO()
            with zipfile.ZipFile(innen, "w") as z:
                for name, daten in dateien.items():
                    z.writestr(name, roh.getvalue() if name == knotenname else daten)
            m = json.loads(json.dumps(manifest))
            m["sha256"] = hashlib.sha256(innen.getvalue()).hexdigest()
            m.pop("fingerabdruck")
            m["fingerabdruck"] = daten_hash(m)
            p = self.basis / f"knoten-{art}.slmodell"
            with zipfile.ZipFile(p, "w") as z:
                z.writestr("modell.json", json.dumps(m))
                z.writestr("modell.skops", innen.getvalue())
            with self.subTest(art=art), patch.object(sio, "loads", side_effect=AssertionError("Der native Loader darf nicht erreicht werden.")) as loader:
                with self.assertRaises(BusinessFehler):
                    schritt(self.kontext, "invalid-tree", "ml.laden", {"pfad": p.name}, {})
                loader.assert_not_called()


if __name__ == "__main__":
    unittest.main()
