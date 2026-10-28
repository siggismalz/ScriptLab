# Entwicklungswerkzeug: leitet PNG und Windows-ICO aus dem bearbeitbaren SVG ab.
# Benötigt Windows/.NET System.Drawing; keine Fonts, Downloads oder externen Renderer.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$ordner = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\assets'))
[xml]$quelle = Get-Content -LiteralPath (Join-Path $ordner 'scriptlab.svg') -Raw
# Dieses kleine Entwicklungswerkzeug rendert bewusst nur die verwendete SVG-Teilmenge.
# Eine spaetere Asset-Aenderung darf nicht unbemerkt eine abweichende Rasterausgabe liefern.
if ($quelle.DocumentElement.GetAttribute('viewBox') -ne '0 0 64 64') {
    throw 'Das Icon benoetigt eine viewBox von 0 0 64 64.'
}
foreach ($knoten in $quelle.SelectNodes('//*')) {
    if ($knoten.LocalName -notin @('svg', 'title', 'g', 'rect', 'polyline')) {
        throw "Nicht unterstuetztes SVG-Element: $($knoten.LocalName). Generator bewusst anpassen."
    }
    if ($knoten.HasAttribute('transform') -or $knoten.HasAttribute('style') -or $knoten.HasAttribute('opacity')) {
        throw 'Transformationen, CSS und Transparenzeffekte werden vom Icon-Generator nicht unterstuetzt.'
    }
}
$iconOrdner = Join-Path $ordner 'icons'
[IO.Directory]::CreateDirectory($iconOrdner) | Out-Null
$groessen = @(16, 24, 32, 48, 256)
$bilder = @()

function Zahl($knoten, $name, $standard = 0) {
    if ($knoten.HasAttribute($name)) {
        return [single]::Parse($knoten.GetAttribute($name), [Globalization.CultureInfo]::InvariantCulture)
    }
    return [single]$standard
}
function Farbe($knoten, $name) {
    $aktuell = $knoten
    while ($aktuell -and $aktuell -is [Xml.XmlElement]) {
        if ($aktuell.HasAttribute($name)) { return $aktuell.GetAttribute($name) }
        $aktuell = $aktuell.ParentNode
    }
    throw "SVG-Farbe $name fehlt."
}
function Rechteckpfad([single]$x, [single]$y, [single]$breite, [single]$hoehe, [single]$radius) {
    $pfad = [Drawing.Drawing2D.GraphicsPath]::new()
    if ($radius -le 0) {
        $pfad.AddRectangle([Drawing.RectangleF]::new($x, $y, $breite, $hoehe))
    } else {
        $d = [single]($radius * 2)
        $pfad.AddArc($x, $y, $d, $d, [single]180, [single]90)
        $pfad.AddArc([single]($x + $breite - $d), $y, $d, $d, [single]270, [single]90)
        $pfad.AddArc([single]($x + $breite - $d), [single]($y + $hoehe - $d), $d, $d, [single]0, [single]90)
        $pfad.AddArc($x, [single]($y + $hoehe - $d), $d, $d, [single]90, [single]90)
        $pfad.CloseFigure()
    }
    return ,$pfad
}

foreach ($groesse in $groessen) {
    # Achtfache Auflösung vermeidet gezackte Kanten in den kleinen Windows-Größen.
    $zwischenbild = [Drawing.Bitmap]::new($groesse * 8, $groesse * 8)
    $grafik = [Drawing.Graphics]::FromImage($zwischenbild)
    $grafik.SmoothingMode = [Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $grafik.Clear([Drawing.Color]::Transparent)
    $faktor = [single]($groesse * 8 / 64)
    $grafik.ScaleTransform($faktor, $faktor)
    foreach ($element in $quelle.SelectNodes('//*[local-name()="rect" or local-name()="polyline"]')) {
        if ($element.LocalName -eq 'rect') {
            $pfad = Rechteckpfad (Zahl $element 'x') (Zahl $element 'y') (Zahl $element 'width') (Zahl $element 'height') (Zahl $element 'rx')
            $pinsel = [Drawing.SolidBrush]::new([Drawing.ColorTranslator]::FromHtml((Farbe $element 'fill')))
            $grafik.FillPath($pinsel, $pfad)
            $pfad.Dispose(); $pinsel.Dispose()
        } else {
            $punkte = [Drawing.PointF[]]@($element.GetAttribute('points').Split(' ', [StringSplitOptions]::RemoveEmptyEntries) | ForEach-Object {
                $paar = $_.Split(',')
                [Drawing.PointF]::new([single]::Parse($paar[0], [Globalization.CultureInfo]::InvariantCulture), [single]::Parse($paar[1], [Globalization.CultureInfo]::InvariantCulture))
            })
            $stift = [Drawing.Pen]::new([Drawing.ColorTranslator]::FromHtml((Farbe $element 'stroke')), (Zahl $element 'stroke-width'))
            $stift.LineJoin = [Drawing.Drawing2D.LineJoin]::Round
            $grafik.DrawLines($stift, $punkte)
            $stift.Dispose()
        }
    }
    $grafik.Dispose()
    $bild = [Drawing.Bitmap]::new($groesse, $groesse)
    $kleinGrafik = [Drawing.Graphics]::FromImage($bild)
    $kleinGrafik.CompositingQuality = [Drawing.Drawing2D.CompositingQuality]::HighQuality
    $kleinGrafik.InterpolationMode = [Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $kleinGrafik.PixelOffsetMode = [Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $kleinGrafik.DrawImage($zwischenbild, [Drawing.Rectangle]::new(0, 0, $groesse, $groesse))
    $kleinGrafik.Dispose(); $zwischenbild.Dispose()
    $strom = [IO.MemoryStream]::new()
    $bild.Save($strom, [Drawing.Imaging.ImageFormat]::Png)
    $png = $strom.ToArray()
    [IO.File]::WriteAllBytes((Join-Path $iconOrdner "scriptlab-$groesse.png"), $png)
    if ($groesse -eq 256) { [IO.File]::WriteAllBytes((Join-Path $ordner 'scriptlab.png'), $png) }
    $bilder += @{ groesse = $groesse; png = $png }
    $strom.Dispose(); $bild.Dispose()
}

# Fünf PNG-Bildressourcen im ICO; 0 steht im Header normgerecht für 256 Pixel.
$icoStrom = [IO.MemoryStream]::new()
$schreiber = [IO.BinaryWriter]::new($icoStrom)
$schreiber.Write([uint16]0); $schreiber.Write([uint16]1); $schreiber.Write([uint16]$bilder.Count)
$offset = 6 + 16 * $bilder.Count
foreach ($eintrag in $bilder) {
    $headerGroesse = if ($eintrag.groesse -eq 256) { 0 } else { $eintrag.groesse }
    $schreiber.Write([byte]$headerGroesse); $schreiber.Write([byte]$headerGroesse)
    $schreiber.Write([byte]0); $schreiber.Write([byte]0)
    $schreiber.Write([uint16]1); $schreiber.Write([uint16]32)
    $schreiber.Write([uint32]$eintrag.png.Length); $schreiber.Write([uint32]$offset)
    $offset += $eintrag.png.Length
}
foreach ($eintrag in $bilder) { $schreiber.Write([byte[]]$eintrag.png) }
[IO.File]::WriteAllBytes((Join-Path $ordner 'scriptlab.ico'), $icoStrom.ToArray())
$schreiber.Dispose(); $icoStrom.Dispose()
Write-Output ('ScriptLab-Icon aus SVG erzeugt: ' + ($groessen -join ', ') + ' px.')
