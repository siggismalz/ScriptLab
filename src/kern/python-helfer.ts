/** Feste Python-Helfer. Nutzerwerte werden vom Generator ausschließlich als Literale übergeben. */
export interface PythonHelfer {
  importe?: string[];
  braucht?: string[];
  code: string;
}

export const pythonHelfer: Record<string, PythonHelfer> = {
  variante: {
    importe: ['import ctypes'],
    code: `# Windows-Automation konvertiert Werte ohne VBScript-Engine oder COM-Server.
class SL_Datum:
    def __init__(self, wert):
        self.wert = wert

sl_leer = object()

class SL_Daten(ctypes.Union):
    _fields_ = [("zahl", ctypes.c_double), ("ganz", ctypes.c_long),
                ("wahr", ctypes.c_short), ("text", ctypes.c_void_p),
                ("reserve", ctypes.c_void_p * 2)]

class SL_Variante(ctypes.Structure):
    _anonymous_ = ("daten",)
    _fields_ = [("typ", ctypes.c_ushort), ("r1", ctypes.c_ushort),
                ("r2", ctypes.c_ushort), ("r3", ctypes.c_ushort), ("daten", SL_Daten)]

sl_ole = ctypes.WinDLL("oleaut32.dll", winmode=0x800)
sl_ole.SysAllocStringLen.argtypes = [ctypes.c_wchar_p, ctypes.c_uint]
sl_ole.SysAllocStringLen.restype = ctypes.c_void_p
sl_ole.SysStringLen.argtypes = [ctypes.c_void_p]
sl_ole.SysStringLen.restype = ctypes.c_uint
sl_ole.VariantClear.argtypes = [ctypes.POINTER(SL_Variante)]
sl_ole.VariantClear.restype = ctypes.c_long
sl_ole.VariantChangeTypeEx.argtypes = [ctypes.POINTER(SL_Variante), ctypes.POINTER(SL_Variante), ctypes.c_ulong, ctypes.c_ushort, ctypes.c_ushort]
sl_ole.VariantChangeTypeEx.restype = ctypes.c_long
sl_ole.VarCmp.argtypes = [ctypes.POINTER(SL_Variante), ctypes.POINTER(SL_Variante), ctypes.c_ulong, ctypes.c_ulong]
sl_ole.VarCmp.restype = ctypes.c_long
sl_ole.VarR8Round.argtypes = [ctypes.c_double, ctypes.c_int, ctypes.POINTER(ctypes.c_double)]
sl_ole.VarR8Round.restype = ctypes.c_long

def sl_variante(wert):
    ergebnis = SL_Variante()
    if wert is sl_leer:
        return ergebnis
    if isinstance(wert, bool):
        ergebnis.typ, ergebnis.wahr = 11, -1 if wert else 0
    elif isinstance(wert, SL_Datum):
        ergebnis.typ, ergebnis.zahl = 7, wert.wert
    elif isinstance(wert, (int, float)):
        ergebnis.typ, ergebnis.zahl = 5, float(wert)
    elif isinstance(wert, str):
        ergebnis.typ = 8
        ergebnis.text = sl_ole.SysAllocStringLen(wert, len(wert.encode("utf-16-le", "surrogatepass")) // 2)
        if not ergebnis.text:
            raise MemoryError("Der Text konnte nicht gespeichert werden.")
    else:
        raise ValueError("Dieser Wert kann hier nicht verwendet werden.")
    return ergebnis

def sl_umwandeln(wert, typ):
    quelle, ziel = sl_variante(wert), SL_Variante()
    try:
        # ALPHABOOL und LOCALBOOL erhalten die lokalisierten VBS-Wahrheitswörter.
        if sl_ole.VariantChangeTypeEx(ctypes.byref(ziel), ctypes.byref(quelle), 0x400, 0x12, typ) < 0:
            raise ValueError("Der Wert hat nicht den benötigten Typ.")
        if typ == 8:
            return ctypes.string_at(ziel.text, 2 * sl_ole.SysStringLen(ziel.text)).decode("utf-16-le", "surrogatepass")
        if typ == 11:
            return bool(ziel.wahr)
        if typ == 3:
            return ziel.ganz
        return ziel.zahl
    finally:
        sl_ole.VariantClear(ctypes.byref(ziel))
        sl_ole.VariantClear(ctypes.byref(quelle))

def sl_text(wert):
    return sl_umwandeln(wert, 8)
`,
  },
  zahl: {
    importe: ['import math'],
    braucht: ['variante'],
    code: `def sl_zahl(wert):
    if isinstance(wert, (SL_Datum, list)):
        raise ValueError("Hier wird eine Zahl benötigt.")
    try:
        zahl = sl_umwandeln(wert, 5)
    except ValueError:
        raise ValueError("Hier wird eine Zahl benötigt.") from None
    if not math.isfinite(zahl):
        raise ValueError("Die Zahl liegt außerhalb des unterstützten Bereichs.")
    return zahl`,
  },
  wahr: {
    braucht: ['variante'],
    code: `def sl_wahr(wert):
    return sl_umwandeln(wert, 11)`,
  },
  runden: {
    braucht: ['zahl'],
    code: `def sl_runden(wert, stellen):
    ergebnis = ctypes.c_double()
    if sl_ole.VarR8Round(sl_zahl(wert), stellen, ctypes.byref(ergebnis)) < 0:
        raise ValueError("Die Zahl konnte nicht gerundet werden.")
    return ergebnis.value`,
  },
  vergleich: {
    braucht: ['variante'],
    code: `def sl_vergleichen(a, b, art, modus):
    if isinstance(a, list) or isinstance(b, list):
        raise ValueError("Listen können an dieser Stelle nicht verglichen werden.")
    if a is sl_leer:
        a = "" if isinstance(b, str) else 0
    if b is sl_leer:
        b = "" if isinstance(a, str) else 0
    if modus == "zahl":
        a, b = sl_umwandeln(a, 5), sl_umwandeln(b, 5)
        vergleich = (a > b) - (a < b)
    elif modus == "text" or (isinstance(a, str) and isinstance(b, str)):
        # Binärer VBS-Vergleich vergleicht UTF-16-Codeeinheiten.
        a, b = sl_text(a).encode("utf-16-be", "surrogatepass"), sl_text(b).encode("utf-16-be", "surrogatepass")
        vergleich = (a > b) - (a < b)
    else:
        links, rechts = sl_variante(a), sl_variante(b)
        try:
            ergebnis = sl_ole.VarCmp(ctypes.byref(links), ctypes.byref(rechts), 0x400, 0)
            if ergebnis not in (0, 1, 2):
                raise ValueError("Diese Werte können nicht miteinander verglichen werden.")
            vergleich = ergebnis - 1
        finally:
            sl_ole.VariantClear(ctypes.byref(rechts))
            sl_ole.VariantClear(ctypes.byref(links))
    return {"EQ": vergleich == 0, "NE": vergleich != 0, "GT": vergleich > 0, "LT": vergleich < 0}[art]`,
  },
  logik: {
    braucht: ['variante'],
    code: `def sl_logik(a, b, und):
    # Beide Argumente sind vor dem Aufruf bereits ausgewertet.
    if isinstance(a, bool) and isinstance(b, bool):
        return (a and b) if und else (a or b)
    a, b = sl_umwandeln(a, 3), sl_umwandeln(b, 3)
    return a & b if und else a | b

def sl_nicht(wert):
    return not wert if isinstance(wert, bool) else ~sl_umwandeln(wert, 3)`,
  },
  liste: {
    code: `def sl_kopie(wert):
    return [sl_kopie(eintrag) for eintrag in wert] if isinstance(wert, list) else wert

def sl_liste(wert):
    if not isinstance(wert, list):
        raise ValueError("Hier wird eine Liste benötigt. Lege die Variable zuerst mit einer Liste an.")
    return sl_kopie(wert)

def sl_anhaengen(wert, eintrag):
    return sl_liste(wert) + [sl_kopie(eintrag)]`,
  },
  eintrag: {
    braucht: ['liste', 'zahl'],
    code: `def sl_eintrag(wert, index):
    liste = sl_liste(wert)
    nummer = sl_zahl(index)
    if not nummer.is_integer() or nummer < 1 or nummer > len(liste):
        raise ValueError("Der angeforderte Listeneintrag ist nicht vorhanden. Die Nummerierung beginnt bei 1.")
    return sl_kopie(liste[int(nummer) - 1])`,
  },
  anzahl: {
    braucht: ['zahl'],
    code: `def sl_anzahl(wert):
    anzahl = sl_zahl(wert)
    if not anzahl.is_integer() or not 0 <= anzahl <= 1000000:
        raise ValueError("Die Wiederholungsanzahl muss eine ganze Zahl zwischen 0 und 1.000.000 sein.")
    return int(anzahl)`,
  },
  rechnen: {
    braucht: ['zahl'],
    code: `def sl_rechnen(a, b, art):
    a, b = sl_zahl(a), sl_zahl(b)
    if art == "DIV" and b == 0:
        raise ValueError("Eine Division durch null ist nicht möglich.")
    if art == "ADD":
        ergebnis = a + b
    elif art == "SUB":
        ergebnis = a - b
    elif art == "MUL":
        ergebnis = a * b
    else:
        ergebnis = a / b
    if not math.isfinite(ergebnis):
        raise ValueError("Das Rechenergebnis liegt außerhalb des unterstützten Bereichs.")
    return ergebnis`,
  },
  zufall: {
    importe: ['import random'],
    braucht: ['zahl'],
    code: `def sl_zufall(von, bis):
    minimum, maximum = sl_zahl(von), sl_zahl(bis)
    if not minimum.is_integer() or not maximum.is_integer() or minimum > maximum or abs(minimum) > 1000000000 or abs(maximum) > 1000000000:
        raise ValueError("Zufallsgrenzen müssen ganze Zahlen zwischen -1.000.000.000 und 1.000.000.000 sein; das Minimum darf nicht größer sein als das Maximum.")
    return random.randint(int(minimum), int(maximum))`,
  },
  text: {
    braucht: ['variante'],
    code: `def sl_einheiten(text):
    daten = sl_text(text).encode("utf-16-be", "surrogatepass")
    return "".join(chr(int.from_bytes(daten[i:i + 2], "big")) for i in range(0, len(daten), 2))

def sl_enthaelt(text, suchen):
    return sl_einheiten(suchen) in sl_einheiten(text)

def sl_ersetzen(text, suchen, ersatz):
    text, suchen, ersatz = sl_text(text), sl_text(suchen), sl_text(ersatz)
    if not suchen:
        raise ValueError("Der zu ersetzende Suchtext darf nicht leer sein.")
    einheiten = sl_einheiten(text).replace(sl_einheiten(suchen), sl_einheiten(ersatz))
    daten = b"".join(ord(zeichen).to_bytes(2, "big") for zeichen in einheiten)
    return daten.decode("utf-16-be", "surrogatepass")

def sl_laenge(text):
    return len(sl_text(text).encode("utf-16-le", "surrogatepass")) // 2

def sl_schreibweise(text, gross):
    text = sl_text(text)
    kernel = ctypes.WinDLL("kernel32.dll", use_last_error=True, winmode=0x800)
    funktion = kernel.LCMapStringEx
    funktion.argtypes = [ctypes.c_wchar_p, ctypes.c_ulong, ctypes.c_wchar_p, ctypes.c_int, ctypes.c_void_p, ctypes.c_int, ctypes.c_void_p, ctypes.c_void_p, ctypes.c_size_t]
    funktion.restype = ctypes.c_int
    laenge = len(text.encode("utf-16-le", "surrogatepass")) // 2
    if not laenge:
        return ""
    flag = 0x200 if gross else 0x100
    benoetigt = funktion(None, flag, text, laenge, None, 0, None, None, 0)
    if not benoetigt:
        raise OSError("Die Schreibweise konnte nicht geändert werden.")
    ziel = ctypes.create_unicode_buffer(benoetigt)
    if not funktion(None, flag, text, laenge, ziel, benoetigt, None, None, 0):
        raise OSError("Die Schreibweise konnte nicht geändert werden.")
    return ctypes.string_at(ziel, benoetigt * 2).decode("utf-16-le", "surrogatepass")`,
  },
  datum: {
    importe: ['import datetime', 'import math'],
    braucht: ['variante'],
    code: `def sl_jetzt(art):
    jetzt = datetime.datetime.now().replace(microsecond=0)
    tage = (jetzt.date() - datetime.date(1899, 12, 30)).days
    zeit = (jetzt.hour * 3600 + jetzt.minute * 60 + jetzt.second) / 86400
    return SL_Datum(tage if art == "DATUM" else zeit if art == "ZEIT" else tage + zeit)

def sl_datum(wert, format):
    if wert is sl_leer or isinstance(wert, (bool, int, float, list)):
        raise ValueError("Der Datumswert kann nicht formatiert werden.")
    try:
        tage = sl_umwandeln(wert, 7)
        # OLE DATE verwendet bei negativen Tagen einen positiven Zeitbruchteil.
        ganz = math.trunc(tage)
        datum = datetime.datetime(1899, 12, 30) + datetime.timedelta(days=ganz, seconds=round(abs(tage - ganz) * 86400))
        if not 100 <= datum.year <= 9999:
            raise ValueError()
    except (ValueError, OverflowError):
        raise ValueError("Der Datumswert kann nicht formatiert werden.") from None
    tag = f"{datum.year:04d}-{datum.month:02d}-{datum.day:02d}"
    zeit = f"{datum.hour:02d}:{datum.minute:02d}:{datum.second:02d}"
    return tag if format == "DATUM" else zeit if format == "ZEIT" else tag + " " + zeit`,
  },
  warten: {
    importe: ['import time'],
    braucht: ['zahl'],
    code: `def sl_warten(wert):
    sekunden = sl_zahl(wert)
    if not 0 <= sekunden <= 86400:
        raise ValueError("Die Wartezeit muss zwischen 0 und 86.400 Sekunden liegen.")
    time.sleep(sl_umwandeln(sekunden * 1000, 3) / 1000)`,
  },
  dialog: {
    braucht: ['variante'],
    code: `def sl_dialog(text, art):
    try:
        import tkinter
        from tkinter import messagebox, simpledialog, ttk
    except ImportError:
        raise RuntimeError("Dieser Baustein benötigt Python mit installierter Tcl/Tk-Unterstützung.") from None
    fenster = tkinter.Tk()
    fenster.withdraw()
    try:
        text = sl_text(text)
        if art == "NACHRICHT":
            messagebox.showinfo("ScriptLab", text, parent=fenster)
            return None
        if art == "EINGABE":
            class SL_Texteingabe(simpledialog.Dialog):
                def body(self, master):
                    ttk.Label(master, text=text, wraplength=480, justify="left").grid(row=0, column=0, sticky="w", padx=8, pady=8)
                    self.eingabe = ttk.Entry(master, width=56)
                    self.eingabe.grid(row=1, column=0, sticky="ew", padx=8, pady=8)
                    master.columnconfigure(0, weight=1)
                    return self.eingabe

                def buttonbox(self):
                    knoepfe = ttk.Frame(self)
                    ttk.Button(knoepfe, text="OK", command=self.ok).pack(side="left", padx=4, pady=8)
                    ttk.Button(knoepfe, text="Abbrechen", command=self.cancel).pack(side="left", padx=4, pady=8)
                    self.bind("<Return>", self.ok)
                    self.bind("<Escape>", self.cancel)
                    self.protocol("WM_DELETE_WINDOW", self.cancel)
                    knoepfe.pack()

                def apply(self):
                    self.result = self.eingabe.get()

            return SL_Texteingabe(fenster, title="ScriptLab").result or ""
        return messagebox.askyesno("ScriptLab", text, parent=fenster, default="no" if art == "LOESCHEN" else "yes", icon="warning" if art == "LOESCHEN" else "question")
    finally:
        fenster.destroy()`,
  },
  pfad: {
    importe: ['import os'],
    braucht: ['variante'],
    code: `def sl_pfad(wert):
    pfad = sl_text(wert)
    if not pfad.strip() or any(zeichen in pfad for zeichen in ("*", "?", "\\r", "\\n", "\\0")):
        raise ValueError("Der Dateipfad ist leer oder enthält unzulässige Platzhalter.")
    absolut = pfad.startswith("\\\\\\\\") or (len(pfad) >= 3 and pfad[1:3] == ":\\\\")
    if not absolut:
        if ":" in pfad or pfad.startswith(("\\\\", "/")):
            raise ValueError("Bitte einen vollständigen oder zum Script relativen Pfad verwenden.")
        pfad = os.path.join(sl_basis, pfad)
    return os.path.abspath(pfad)

def sl_vorhanden(wert, ordner):
    pfad = sl_pfad(wert)
    return os.path.isdir(pfad) if ordner else os.path.isfile(pfad)

def sl_dateiname(wert):
    return os.path.basename(sl_pfad(wert).rstrip("\\\\/"))`,
  },
  dateien: {
    importe: ['import functools'],
    braucht: ['pfad'],
    code: `def sl_dateien(wert):
    pfad = sl_pfad(wert)
    if not os.path.isdir(pfad):
        raise ValueError("Der Ordner fehlt: " + pfad)
    with os.scandir(pfad) as ordner:
        dateien = [eintrag.path for eintrag in ordner if eintrag.is_file()]
    vergleichen = ctypes.WinDLL("kernel32.dll", winmode=0x800).CompareStringEx
    vergleichen.argtypes = [ctypes.c_wchar_p, ctypes.c_ulong, ctypes.c_wchar_p, ctypes.c_int, ctypes.c_wchar_p, ctypes.c_int, ctypes.c_void_p, ctypes.c_void_p, ctypes.c_size_t]
    vergleichen.restype = ctypes.c_int
    def vergleich(a, b):
        ergebnis = vergleichen(None, 1, a, -1, b, -1, None, None, 0)
        if not ergebnis:
            raise OSError("Dateinamen konnten nicht verglichen werden.")
        return ergebnis - 2
    return sorted(dateien, key=functools.cmp_to_key(vergleich))`,
  },
  ordner: {
    braucht: ['pfad'],
    code: `def sl_ordner(wert):
    pfad = sl_pfad(wert)
    if os.path.isfile(pfad):
        raise ValueError("Am Ordnerpfad ist bereits eine Datei vorhanden: " + pfad)
    os.makedirs(pfad, exist_ok=True)`,
  },
  kopieren: {
    importe: ['import shutil'],
    braucht: ['pfad'],
    code: `def sl_kopieren(von, nach, ersetzen, verschieben):
    quelle, ziel = sl_pfad(von), sl_pfad(nach)
    if os.path.normcase(quelle) == os.path.normcase(ziel) or (os.path.exists(ziel) and os.path.exists(quelle) and os.path.samefile(quelle, ziel)):
        raise ValueError("Quelle und Ziel dürfen nicht dieselbe Datei sein.")
    if not os.path.isfile(quelle):
        raise ValueError("Die Quelldatei fehlt: " + quelle)
    if os.path.isdir(ziel):
        raise ValueError("Bitte einen vollständigen Zieldateinamen angeben: " + ziel)
    if not os.path.isdir(os.path.dirname(ziel)):
        raise ValueError("Der Zielordner fehlt: " + os.path.dirname(ziel))
    if os.path.isfile(ziel) and not ersetzen:
        raise ValueError("Die Zieldatei ist bereits vorhanden: " + ziel)
    with open(quelle, "rb") as eingang, open(ziel, "wb" if ersetzen else "xb") as ausgang:
        shutil.copyfileobj(eingang, ausgang)
    shutil.copystat(quelle, ziel)
    if verschieben:
        os.unlink(quelle)`,
  },
  umbenennen: {
    braucht: ['pfad'],
    code: `def sl_umbenennen(von, neuer_name):
    quelle, name = sl_pfad(von), sl_text(neuer_name)
    if not name.strip() or name in (".", "..") or any(zeichen in name for zeichen in '\\\\/:*?"<>|\\r\\n'):
        raise ValueError("Der neue Dateiname darf keinen Pfad oder ungültige Windows-Zeichen enthalten.")
    ziel = os.path.join(os.path.dirname(quelle), name)
    if os.path.normcase(quelle) == os.path.normcase(ziel):
        raise ValueError("Quelle und neuer Name sind gleich.")
    if not os.path.isfile(quelle):
        raise ValueError("Die Quelldatei fehlt: " + quelle)
    if os.path.exists(ziel):
        raise ValueError("Der neue Dateiname ist bereits belegt: " + ziel)
    os.rename(quelle, ziel)`,
  },
  lesen: {
    braucht: ['pfad'],
    code: `def sl_lesen(wert, kodierung):
    pfad = sl_pfad(wert)
    if not os.path.isfile(pfad):
        raise ValueError("Die Textdatei fehlt: " + pfad)
    with open(pfad, "rb") as datei:
        daten = datei.read()
    try:
        if kodierung == "UTF8":
            if daten.startswith((b"\\xff\\xfe", b"\\xfe\\xff")):
                raise UnicodeError()
            return daten.decode("utf-8-sig", "strict")
        if kodierung == "UTF16":
            if daten.startswith((b"\\xfe\\xff", b"\\xef\\xbb\\xbf")):
                raise UnicodeError()
            if daten.startswith(b"\\xff\\xfe"):
                daten = daten[2:]
            return daten.decode("utf-16-le", "strict")
        if kodierung == "ANSI":
            return daten.decode("mbcs", "replace")
    except UnicodeError:
        raise ValueError("Die vorhandene Datei passt nicht zur gewählten Textkodierung. Die Datei wurde nicht verändert.") from None
    raise ValueError("Die Textkodierung wird nicht unterstützt.")`,
  },
  schreiben: {
    braucht: ['lesen'],
    code: `def sl_schreiben(wert, inhalt, kodierung, anhaengen):
    pfad, text = sl_pfad(wert), sl_text(inhalt)
    if os.path.isdir(pfad):
        raise ValueError("Der Textdateipfad bezeichnet einen Ordner: " + pfad)
    if not os.path.isdir(os.path.dirname(pfad)):
        raise ValueError("Der Zielordner fehlt: " + os.path.dirname(pfad))
    if anhaengen and os.path.isfile(pfad):
        text = sl_lesen(pfad, kodierung) + text
    if kodierung == "UTF8":
        daten = b"\\xef\\xbb\\xbf" + text.encode("utf-8", "replace")
    elif kodierung == "UTF16":
        daten = b"\\xff\\xfe" + text.encode("utf-16-le", "surrogatepass")
    elif kodierung == "ANSI":
        daten = text.encode("mbcs", "replace")
    else:
        raise ValueError("Die Textkodierung wird nicht unterstützt.")
    with open(pfad, "wb") as datei:
        datei.write(daten)`,
  },
  loeschen: {
    braucht: ['pfad'],
    code: `def sl_loeschen(wert, rueckfrage):
    pfad = sl_pfad(wert)
    if not os.path.isfile(pfad):
        raise ValueError("Die zu löschende Datei fehlt: " + pfad)
    if rueckfrage and not sl_dialog("Diese Datei wirklich löschen?\\r\\n" + pfad, "LOESCHEN"):
        return
    os.unlink(pfad)`,
  },
};
