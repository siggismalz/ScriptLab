using System;
using System.ComponentModel;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;

// Fester Windows-Host. Job Objects begrenzen die Lebensdauer, sie sind keine Sicherheits-Sandbox.
// https://learn.microsoft.com/windows/win32/procthread/job-objects
// https://learn.microsoft.com/windows/win32/api/processthreadsapi/nf-processthreadsapi-updateprocthreadattribute
internal static class LaufzeitHost
{
    private const uint KillOnJobClose = 0x2000;
    private const uint CreateSuspended = 4;
    private const uint ExtendedStartup = 0x80000;
    private const uint CreateNoWindow = 0x08000000;
    private const uint StartUseStdHandles = 0x100;
    private const uint StopExitcode = 0xC000013A;
    private const uint WaitObject = 0;
    private static readonly IntPtr Ungueltig = new IntPtr(-1);

    [StructLayout(LayoutKind.Sequential)]
    private struct SicherheitsAttribute { public int Laenge; public IntPtr Beschreibung; public int Vererbbar; }
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private struct Startinfo
    {
        public int Groesse; public string Reserviert; public string Desktop; public string Titel;
        public uint X, Y, Breite, Hoehe, Spalten, Zeilen, Fuellfarbe, Flags;
        public short Fensteranzeige, Reserviert2; public IntPtr Reserviert3, Eingabe, Ausgabe, Fehler;
    }
    [StructLayout(LayoutKind.Sequential)]
    private struct ErweiterterStart { public Startinfo Start; public IntPtr Attribute; }
    [StructLayout(LayoutKind.Sequential)]
    private struct Prozessinfo { public IntPtr Prozess, Thread; public uint ProzessId, ThreadId; }
    [StructLayout(LayoutKind.Sequential)]
    private struct BasisLimits
    {
        public long Prozesszeit, Jobzeit; public uint Flags;
        public UIntPtr Minimum, Maximum; public uint AktiveProzesse; public UIntPtr Affinitaet;
        public uint Prioritaet, Planung;
    }
    [StructLayout(LayoutKind.Sequential)]
    private struct IoZaehler { public ulong Lesen, Schreiben, Sonstiges, GeleseneBytes, GeschriebeneBytes, SonstigeBytes; }
    [StructLayout(LayoutKind.Sequential)]
    private struct ErweiterteLimits
    {
        public BasisLimits Basis; public IoZaehler Io;
        public UIntPtr Prozessspeicher, Jobspeicher, SpitzenProzessspeicher, SpitzenJobspeicher;
    }
    [StructLayout(LayoutKind.Sequential)]
    private struct JobZaehler
    {
        public long Nutzerzeit, Kernelzeit, ZeitraumNutzerzeit, ZeitraumKernelzeit;
        public uint Seitenfehler, Gesamt, Aktiv, Beendet;
    }

    [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    private static extern IntPtr CreateJobObjectW(IntPtr sicherheit, string name);
    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool SetInformationJobObject(IntPtr job, int klasse, ref ErweiterteLimits daten, uint groesse);
    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool QueryInformationJobObject(IntPtr job, int klasse, out JobZaehler daten, uint groesse, IntPtr zurueck);
    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool TerminateJobObject(IntPtr job, uint code);
    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool IsProcessInJob(IntPtr prozess, IntPtr job, out bool enthalten);
    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool InitializeProcThreadAttributeList(IntPtr liste, int anzahl, uint flags, ref IntPtr groesse);
    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool UpdateProcThreadAttribute(IntPtr liste, uint flags, IntPtr attribut, IntPtr wert, IntPtr groesse, IntPtr vorher, IntPtr zurueck);
    [DllImport("kernel32.dll")]
    private static extern void DeleteProcThreadAttributeList(IntPtr liste);
    [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    private static extern bool CreateProcessW(string anwendung, StringBuilder argumente, IntPtr prozessSicherheit, IntPtr threadSicherheit, bool vererben, uint flags, IntPtr umgebung, string ordner, ref ErweiterterStart start, out Prozessinfo prozess);
    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern uint ResumeThread(IntPtr thread);
    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern uint WaitForSingleObject(IntPtr handle, uint zeit);
    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool GetExitCodeProcess(IntPtr prozess, out uint code);
    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool CloseHandle(IntPtr handle);
    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern IntPtr GetStdHandle(int nummer);
    [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    private static extern IntPtr CreateFileW(string name, uint zugriff, uint teilen, ref SicherheitsAttribute sicherheit, uint modus, uint flags, IntPtr vorlage);
    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool PeekNamedPipe(IntPtr pipe, IntPtr puffer, uint groesse, IntPtr gelesen, out uint vorhanden, IntPtr rest);
    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool ReadFile(IntPtr datei, byte[] puffer, uint groesse, out uint gelesen, IntPtr ueberlappt);
    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool CreatePipe(out IntPtr lesen, out IntPtr schreiben, ref SicherheitsAttribute sicherheit, uint groesse);
    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool SetHandleInformation(IntPtr handle, uint maske, uint flags);

    private sealed class PipePumpe
    {
        public Thread Thread;
        public Exception Fehler;
        public PipePumpe(IntPtr lesen, Stream ziel)
        {
            Thread = new Thread(delegate()
            {
                try
                {
                    byte[] daten = new byte[4096];
                    while (true)
                    {
                        uint anzahl;
                        if (!ReadFile(lesen, daten, (uint)daten.Length, out anzahl, IntPtr.Zero))
                        {
                            if (Marshal.GetLastWin32Error() == 109) break;
                            throw new Win32Exception(Marshal.GetLastWin32Error(), "Ausgabepipe lesen");
                        }
                        if (anzahl == 0) break;
                        ziel.Write(daten, 0, (int)anzahl); ziel.Flush();
                    }
                }
                catch (Exception e) { Fehler = e; }
                finally { CloseHandle(lesen); }
            });
            Thread.IsBackground = true;
            Thread.Start();
        }
    }

    private static void Pruefen(bool gut, string vorgang)
    {
        if (!gut) throw new Win32Exception(Marshal.GetLastWin32Error(), vorgang);
    }

    // Windows-argv-Regeln: Backslashes vor Anführungszeichen und am Ende eines Arguments verdoppeln.
    private static string Argument(string text)
    {
        StringBuilder ausgabe = new StringBuilder("\"");
        int schraeg = 0;
        foreach (char zeichen in text)
        {
            if (zeichen == '\\') { schraeg++; continue; }
            if (zeichen == '"') { ausgabe.Append('\\', schraeg * 2 + 1); ausgabe.Append('"'); }
            else { ausgabe.Append('\\', schraeg); ausgabe.Append(zeichen); }
            schraeg = 0;
        }
        ausgabe.Append('\\', schraeg * 2);
        return ausgabe.Append('"').ToString();
    }

    private static string AbsoluterPfad(string text)
    {
        bool absolut = text.StartsWith("\\\\", StringComparison.Ordinal) ||
            (text.Length >= 3 && Char.IsLetter(text[0]) && text[1] == ':' && (text[2] == '\\' || text[2] == '/'));
        if (!absolut || text.IndexOfAny(new char[] { '\0', '\r', '\n', '"' }) >= 0)
            throw new ArgumentException("Es werden ausschließlich vollständige Windows-Pfade erwartet.");
        return Path.GetFullPath(text);
    }

    // Nur der Hauptthread schreibt Protokollmeldungen: vor den Pumpen oder nach deren Ende.
    private static void Diagnose(string text)
    {
        byte[] daten = Encoding.Unicode.GetBytes(text + "\r\n");
        Stream fehler = Console.OpenStandardError();
        fehler.Write(daten, 0, daten.Length); fehler.Flush();
    }

    private static bool PumpenAbwarten(PipePumpe ausgabe, PipePumpe fehler)
    {
        // Beide Threads abwarten, auch wenn bereits die erste Pipe ihr Zeitlimit überschreitet.
        bool ausgabeBeendet = ausgabe == null || ausgabe.Thread.Join(1000);
        bool fehlerBeendet = fehler == null || fehler.Thread.Join(1000);
        return ausgabeBeendet && fehlerBeendet;
    }

    // Keine vererbte stdin für cscript: nur der Helper liest diese Lebensleitung.
    private static bool KontrollePruefen(IntPtr eingabe, StringBuilder zeile)
    {
        uint vorhanden;
        while (true)
        {
            if (!PeekNamedPipe(eingabe, IntPtr.Zero, 0, IntPtr.Zero, out vorhanden, IntPtr.Zero))
            {
                int fehler = Marshal.GetLastWin32Error();
                if (fehler == 109 || fehler == 232 || fehler == 233) return true;
                throw new Win32Exception(fehler, "Die Kontrollpipe ist nicht verfügbar.");
            }
            if (vorhanden == 0) return false;
            byte[] daten = new byte[Math.Min(vorhanden, 256U)];
            uint gelesen;
            Pruefen(ReadFile(eingabe, daten, (uint)daten.Length, out gelesen, IntPtr.Zero), "Kontrollpipe lesen");
            if (gelesen == 0) return true;
            for (int i = 0; i < gelesen; i++)
            {
                char zeichen = (char)daten[i];
                if (zeichen == '\n')
                {
                    string befehl = zeile.ToString().TrimEnd('\r');
                    if (befehl != "STOP") throw new ArgumentException("Unbekannter Kontrollbefehl.");
                    return true;
                }
                zeile.Append(zeichen);
                if (zeile.Length > 32) throw new ArgumentException("Der Kontrollbefehl ist zu lang.");
            }
        }
    }

    private static void JobBeenden(IntPtr job, IntPtr prozess)
    {
        Pruefen(TerminateJobObject(job, StopExitcode), "Gebundenen Testlauf beenden");
        Stopwatch warten = Stopwatch.StartNew();
        while (warten.ElapsedMilliseconds < 3000)
        {
            JobZaehler zaehler;
            Pruefen(QueryInformationJobObject(job, 1, out zaehler, (uint)Marshal.SizeOf(typeof(JobZaehler)), IntPtr.Zero), "Jobende prüfen");
            if (zaehler.Aktiv == 0 && (prozess == IntPtr.Zero || WaitForSingleObject(prozess, 0) == WaitObject)) return;
            Thread.Sleep(10);
        }
        throw new TimeoutException("Windows hat das Ende des gebundenen Prozesses nicht rechtzeitig bestätigt.");
    }

    private static int Main(string[] args)
    {
        IntPtr job = IntPtr.Zero, liste = IntPtr.Zero, handleListe = IntPtr.Zero, jobListe = IntPtr.Zero;
        IntPtr eingabeNull = IntPtr.Zero, ausgabe = IntPtr.Zero, fehlerausgabe = IntPtr.Zero;
        IntPtr ausgabeLesen = IntPtr.Zero, fehlerLesen = IntPtr.Zero;
        PipePumpe ausgabePumpe = null, fehlerPumpe = null;
        Prozessinfo prozess = new Prozessinfo();
        bool listeInitialisiert = false, zeitlimitErreicht = false;
        try
        {
            if (IntPtr.Size != 8 || args.Length != 8 || args[0] != "--script" || args[2] != "--basis" || args[4] != "--limit-ms" || args[6] != "--token")
                throw new ArgumentException("Erwartet: --script <VBS> --basis <Ordner> --limit-ms <Zeit> --token <Kennung>.");
            string script = AbsoluterPfad(args[1]), basis = AbsoluterPfad(args[3]);
            basis = basis.TrimEnd('\\', '/');
            if (basis.Length == 2 && basis[1] == ':') basis += "\\.";
            int limit;
            if (!String.Equals(Path.GetExtension(script), ".vbs", StringComparison.OrdinalIgnoreCase) || !Int32.TryParse(args[5], out limit) || limit < 100 || limit > 86400000 || !Regex.IsMatch(args[7], "^[A-Za-z0-9_-]{32,128}$"))
                throw new ArgumentException("Scriptpfad, Zeitlimit oder Testkennung sind ungültig.");
            string host = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System), "cscript.exe");
            if (!File.Exists(host)) throw new FileNotFoundException("Der feste Windows-Scripthost ist nicht verfügbar.");
            IntPtr kontrolle = GetStdHandle(-10);
            StringBuilder befehl = new StringBuilder();
            if (KontrollePruefen(kontrolle, befehl)) return unchecked((int)StopExitcode);
            job = CreateJobObjectW(IntPtr.Zero, null);
            Pruefen(job != IntPtr.Zero, "Job anlegen");
            ErweiterteLimits limits = new ErweiterteLimits();
            limits.Basis.Flags = KillOnJobClose;
            Pruefen(SetInformationJobObject(job, 9, ref limits, (uint)Marshal.SizeOf(typeof(ErweiterteLimits))), "Jobgrenzen setzen");
            SicherheitsAttribute sicherheit = new SicherheitsAttribute();
            sicherheit.Laenge = Marshal.SizeOf(typeof(SicherheitsAttribute)); sicherheit.Vererbbar = 1;
            eingabeNull = CreateFileW("NUL", 0x80000000, 3, ref sicherheit, 3, 0, IntPtr.Zero);
            Pruefen(eingabeNull != Ungueltig, "Leere Scripteingabe vorbereiten");
            // cscript benötigt synchrone native Pipes; Node-Windows-Pipehandles sind kein verlässlicher Ersatz.
            Pruefen(CreatePipe(out ausgabeLesen, out ausgabe, ref sicherheit, 0), "Ausgabepipe anlegen");
            Pruefen(CreatePipe(out fehlerLesen, out fehlerausgabe, ref sicherheit, 0), "Fehlerpipe anlegen");
            Pruefen(SetHandleInformation(ausgabeLesen, 1, 0) && SetHandleInformation(fehlerLesen, 1, 0), "Leseseiten nicht vererben");
            IntPtr groesse = IntPtr.Zero;
            InitializeProcThreadAttributeList(IntPtr.Zero, 2, 0, ref groesse);
            liste = Marshal.AllocHGlobal(groesse);
            Pruefen(InitializeProcThreadAttributeList(liste, 2, 0, ref groesse), "Startattribute anlegen");
            listeInitialisiert = true;
            handleListe = Marshal.AllocHGlobal(IntPtr.Size * 3);
            Marshal.WriteIntPtr(handleListe, 0, eingabeNull); Marshal.WriteIntPtr(handleListe, IntPtr.Size, ausgabe); Marshal.WriteIntPtr(handleListe, IntPtr.Size * 2, fehlerausgabe);
            Pruefen(UpdateProcThreadAttribute(liste, 0, new IntPtr(0x20002), handleListe, new IntPtr(IntPtr.Size * 3), IntPtr.Zero, IntPtr.Zero), "Vererbbare Pipes festlegen");
            jobListe = Marshal.AllocHGlobal(IntPtr.Size); Marshal.WriteIntPtr(jobListe, job);
            // Die atomare Jobzuordnung schließt auch die Absturzlücke vor einem nachträglichen Assign.
            Pruefen(UpdateProcThreadAttribute(liste, 0, new IntPtr(0x2000D), jobListe, new IntPtr(IntPtr.Size), IntPtr.Zero, IntPtr.Zero), "Atomare Jobzuordnung festlegen");
            ErweiterterStart start = new ErweiterterStart();
            start.Start.Groesse = Marshal.SizeOf(typeof(ErweiterterStart)); start.Start.Flags = StartUseStdHandles | 1;
            start.Start.Fensteranzeige = 0;
            start.Start.Eingabe = eingabeNull; start.Start.Ausgabe = ausgabe; start.Start.Fehler = fehlerausgabe; start.Attribute = liste;
            StringBuilder argumente = new StringBuilder(Argument(host) + " //Nologo //U //I //E:VBScript " + Argument(script) + " " + Argument("/ScriptLabBasis:" + basis) + " " + Argument("/ScriptLabTestToken:" + args[7]));
            if (argumente.Length > 32000) throw new ArgumentException("Die Windows-Aufrufargumente sind zu lang.");
            if (KontrollePruefen(kontrolle, befehl)) return unchecked((int)StopExitcode);
            Pruefen(CreateProcessW(host, argumente, IntPtr.Zero, IntPtr.Zero, true, CreateSuspended | CreateNoWindow | ExtendedStartup, IntPtr.Zero, basis, ref start, out prozess), "Windows-Scripthost anlegen");
            CloseHandle(ausgabe); ausgabe = IntPtr.Zero;
            CloseHandle(fehlerausgabe); fehlerausgabe = IntPtr.Zero;
            bool enthalten;
            Pruefen(IsProcessInJob(prozess.Prozess, job, out enthalten) && enthalten, "Jobzuordnung bestätigen");
            if (KontrollePruefen(kontrolle, befehl)) { JobBeenden(job, prozess.Prozess); }
            else
            {
                Pruefen(ResumeThread(prozess.Thread) != 0xFFFFFFFF, "Gebundenen Scripthost freigeben");
                Stopwatch laufzeit = Stopwatch.StartNew();
                // Der gebundene Prozess darf schon in seine nativen Pipes schreiben. Weitergegeben
                // werden diese Bytes erst nach der vollständig geschriebenen Startbestätigung.
                Diagnose("SLHOST|GESTARTET|" + DateTime.UtcNow.ToString("o") + "|" + prozess.ProzessId);
                ausgabePumpe = new PipePumpe(ausgabeLesen, Console.OpenStandardOutput()); ausgabeLesen = IntPtr.Zero;
                fehlerPumpe = new PipePumpe(fehlerLesen, Console.OpenStandardError()); fehlerLesen = IntPtr.Zero;
                while (true)
                {
                    uint wartet = WaitForSingleObject(prozess.Prozess, 20);
                    if (wartet == WaitObject) break;
                    Pruefen(wartet == 258, "Auf Scripthost warten");
                    if (ausgabePumpe.Fehler != null || fehlerPumpe.Fehler != null) throw new IOException("Die Ausgabe des Testlaufs konnte nicht weitergegeben werden.");
                    if (KontrollePruefen(kontrolle, befehl)) { JobBeenden(job, prozess.Prozess); break; }
                    if (laufzeit.ElapsedMilliseconds >= limit) { zeitlimitErreicht = true; JobBeenden(job, prozess.Prozess); break; }
                }
            }
            uint code = 0;
            Pruefen(WaitForSingleObject(prozess.Prozess, 0) == WaitObject && GetExitCodeProcess(prozess.Prozess, out code), "Scripthost-Ende bestätigen");
            // Auch noch lebende normale Kindprozesse des Scripts bleiben nicht nach dessen Ende zurück.
            JobBeenden(job, prozess.Prozess);
            if (!PumpenAbwarten(ausgabePumpe, fehlerPumpe)) throw new TimeoutException("Das Ende der Ausgabepipes wurde nicht rechtzeitig bestätigt.");
            if ((ausgabePumpe != null && ausgabePumpe.Fehler != null) || (fehlerPumpe != null && fehlerPumpe.Fehler != null))
                throw new IOException("Die Ausgabe des Testlaufs konnte nicht vollständig weitergegeben werden.");
            // Eine offene letzte Scriptzeile darf die abschließende Protokollmeldung nicht verschlucken.
            if (zeitlimitErreicht) Diagnose("\r\nSLHOST|ZEITLIMIT");
            return unchecked((int)code);
        }
        catch (Exception e)
        {
            string meldung = e.Message;
            if (job != IntPtr.Zero)
            {
                try { JobBeenden(job, prozess.Prozess); }
                catch (Exception endeFehler) { meldung += " Das Jobende konnte nicht bestätigt werden: " + endeFehler.Message; }
            }
            // Bei einer blockierten Ausgabepipe niemals einen zweiten Schreiber daneben starten.
            // Der Fehlercode bleibt 125; der Aufrufer begrenzt auch einen nicht lesenden Helper.
            if (PumpenAbwarten(ausgabePumpe, fehlerPumpe))
            {
                try { Diagnose("\r\nSLHOST|FEHLER|" + meldung.Replace('\r', ' ').Replace('\n', ' ')); }
                catch { /* Eine geschlossene Empfängerpipe verhindert die Diagnose, nicht das Jobende. */ }
            }
            return 125;
        }
        finally
        {
            if (prozess.Thread != IntPtr.Zero) CloseHandle(prozess.Thread);
            if (prozess.Prozess != IntPtr.Zero) CloseHandle(prozess.Prozess);
            if (eingabeNull != IntPtr.Zero && eingabeNull != Ungueltig) CloseHandle(eingabeNull);
            if (ausgabe != IntPtr.Zero) CloseHandle(ausgabe);
            if (fehlerausgabe != IntPtr.Zero) CloseHandle(fehlerausgabe);
            if (ausgabeLesen != IntPtr.Zero) CloseHandle(ausgabeLesen);
            if (fehlerLesen != IntPtr.Zero) CloseHandle(fehlerLesen);
            if (listeInitialisiert) DeleteProcThreadAttributeList(liste);
            if (liste != IntPtr.Zero) Marshal.FreeHGlobal(liste);
            if (handleListe != IntPtr.Zero) Marshal.FreeHGlobal(handleListe);
            if (jobListe != IntPtr.Zero) Marshal.FreeHGlobal(jobListe);
            if (job != IntPtr.Zero) CloseHandle(job);
        }
    }
}
