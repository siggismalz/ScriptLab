# Unabhängiger Review CI-01: VBS-Ausgabegrenzen bei 8.3-Pfaden

Reviewer: Fachagent Generatoren/VBS; produktive Korrektur durch Geschäftsdatenagent. `src/kern/generator.ts` wurde unabhängig gelesen, nicht verändert. Die neue interne Funktion `SL_Vergleichspfad` vereinheitlicht bestehende Vorfahren für den Grenzvergleich anhand ihres `ShortPath` und hängt noch nicht vorhandene Restkomponenten an. Der tatsächlich verwendete Ausgabepfad bleibt unverändert. Die nachfolgende Prüfung sämtlicher vorhandener Vorfahren auf Windows-Reparsepunkte bleibt erhalten. Nachbarpräfixe werden weiterhin durch eine Pfadtrennergrenze getrennt. Der Helper wird nur bei gesetzter interner `ausgabeWurzel` erzeugt; normale eigenständige Exporte erhalten dadurch keine neue Grenze.

**Keine blockierenden Sicherheits-/Kompatibilitätsbefunde im geprüften Diff.** Keine allgemeine Shellschnittstelle und keine Änderung an Projektformat oder Block-IDs. Die Korrektur macht aus der Ausgabebegrenzung weiterhin keine allgemeine Prozess-Sandbox.

Zusätzliche direkte unabhängige Windows-VBS-Gegenproben mit synthetischem Tempverzeichnis und einem tatsächlich vom Langnamen abweichenden 8.3-Root:

1. Zwei fehlende interne Ordnerebenen über absoluten Langzielpfad bei kurzer Root angelegt: bestanden.
2. Dritte fehlende Ebene angelegt: bestanden.
3. Mehrstufiges externes Ziel abgewiesen, keine Zielerzeugung: bestanden.
4. Ähnlich benannter Nachbarordner abgewiesen: bestanden.
5. Interne Junction auf externen eigenen Testordner abgewiesen: bestanden.

Ausgeführt wurde tatsächlich erzeugter VBS-Testquelltext über das feste Windows-`cscript.exe`; die Diagnosefassung enthielt ausschließlich zusätzliche Textmarker zur Pfadverfolgung. Eigene UTF-16LE-Dateideskriptoren erfassten die Ausgabe. Rohbeleg lokal `artifacts/qualitaet-ci01-direkt-review.json`, reproduzierbarer Diagnoseharness `artifacts/qualitaet-ci01-direkt-bauen.mjs`.

**Zeitgrenze:** Die erste uninstrumentierte Direktprobe erreichte eine eigens gesetzte 7-s-Diagnosefrist. Die instrumentierte Wiederholung mit 15-s-Beobachtungsfrist bestand vollständig. Eine Schleife oder konkrete Verzögerungsursache wurde dabei nicht nachgewiesen. Dies wurde an beide beteiligten Agenten gemeldet und ist kein verschwiegener grüner Erstlauf. Produktionsfristen wurden vom Reviewer nicht verändert. Die separaten vollständigen Dienst-/Integrationsläufe des implementierenden Agenten und des Hauptagenten bleiben eigene Nachweise.

Keine UNC-/Netzlaufwerks- oder Unternehmensrichtlinienprüfung. Keine produktiven Dateien, keine eigenen Commits/Pushes durch den Reviewer.
