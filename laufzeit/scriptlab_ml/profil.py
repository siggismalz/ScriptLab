"""Vollständige optionale Profilidentität, ausschließlich über lokale Metadaten."""
from __future__ import annotations

import hashlib
from importlib.metadata import version, PackageNotFoundError
from pathlib import Path
import sys

from scriptlab_business.kontext import BusinessFehler, daten_hash

# Entspricht sämtlichen direkten und transitiven Pins in requirements-ml.in.
ML_PAKETE = (
    "torch", "numpy", "scipy", "scikit-learn", "skops", "joblib", "cloudpickle",
    "narwhals", "threadpoolctl", "packaging", "prettytable", "wcwidth", "filelock",
    "setuptools", "sympy", "mpmath", "networkx", "jinja2", "markupsafe", "fsspec",
    "typing-extensions",
)


def identitaet(*, streng=True):
    # Quelle, eingefrorener Laufordner und eigenständiger Export besitzen denselben Aufbau.
    pfad = Path(__file__).resolve().parent.parent / "requirements-ml.lock"
    try:
        vorher = pfad.stat()
        if not 0 < vorher.st_size <= 1024 ** 2:
            raise BusinessFehler("Die feste ML-Lockdatei ist leer oder zu groß.")
        inhalt = pfad.read_bytes()
        nachher = pfad.stat()
        if (vorher.st_size, vorher.st_mtime_ns) != (nachher.st_size, nachher.st_mtime_ns) or len(inhalt) != vorher.st_size:
            raise BusinessFehler("Die feste ML-Lockdatei wurde während der Prüfung verändert.")
    except OSError as fehler:
        raise BusinessFehler("Die feste requirements-ml.lock fehlt oder ist nicht lesbar. Verwende ein vollständig eingerichtetes ML-Profil beziehungsweise Exportpaket.") from fehler
    pakete = {}
    for name in ML_PAKETE:
        try:
            pakete[name] = version(name)
        except PackageNotFoundError as fehler:
            if streng:
                raise BusinessFehler("Das optionale ML-Profil fehlt oder ist unvollständig. Richte es in den Einstellungen bewusst ein.") from fehler
            pakete[name] = None
    ergebnis = {"python": sys.version.split()[0], "pakete": pakete,
                "lock_sha256": hashlib.sha256(inhalt).hexdigest()}
    return {**ergebnis, "fingerabdruck": daten_hash(ergebnis)}
