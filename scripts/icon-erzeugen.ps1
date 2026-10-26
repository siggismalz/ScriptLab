# Nur fuer die Entwicklung: zeichnet das eigene einfache ScriptLab-Symbol.
# Keine Bilddateien oder Netzwerkquellen werden gelesen.
Add-Type -AssemblyName System.Drawing
$ordner = Join-Path $PSScriptRoot '..\assets'
$bild = New-Object Drawing.Bitmap(256, 256)
$grafik = [Drawing.Graphics]::FromImage($bild)
$grafik.SmoothingMode = [Drawing.Drawing2D.SmoothingMode]::AntiAlias
$grafik.Clear([Drawing.Color]::Transparent)
$pfad = New-Object Drawing.Drawing2D.GraphicsPath
foreach ($bogen in @(@(8,8,116,116,180,90),@(132,8,116,116,270,90),@(132,132,116,116,0,90),@(8,132,116,116,90,90))) {
    $pfad.AddArc($bogen[0],$bogen[1],$bogen[2],$bogen[3],$bogen[4],$bogen[5])
}
$pfad.CloseFigure()
$farbe = New-Object Drawing.SolidBrush([Drawing.ColorTranslator]::FromHtml('#a69cff'))
$grafik.FillPath($farbe, $pfad)
$schrift = New-Object Drawing.Font('Segoe UI', 140, [Drawing.FontStyle]::Bold, [Drawing.GraphicsUnit]::Pixel)
$textfarbe = New-Object Drawing.SolidBrush([Drawing.ColorTranslator]::FromHtml('#1b1734'))
$format = New-Object Drawing.StringFormat
$format.Alignment = [Drawing.StringAlignment]::Center
$format.LineAlignment = [Drawing.StringAlignment]::Center
$grafik.DrawString('S', $schrift, $textfarbe, [Drawing.RectangleF]::new(0,0,256,246), $format)
$strom = New-Object IO.MemoryStream
$bild.Save($strom, [Drawing.Imaging.ImageFormat]::Png)
$png = $strom.ToArray()
[IO.File]::WriteAllBytes((Join-Path $ordner 'scriptlab.png'), $png)
$icoStrom = New-Object IO.MemoryStream
$schreiber = New-Object IO.BinaryWriter($icoStrom)
$schreiber.Write([uint16]0); $schreiber.Write([uint16]1); $schreiber.Write([uint16]1)
$schreiber.Write([byte]0); $schreiber.Write([byte]0); $schreiber.Write([byte]0); $schreiber.Write([byte]0)
$schreiber.Write([uint16]1); $schreiber.Write([uint16]32); $schreiber.Write([uint32]$png.Length); $schreiber.Write([uint32]22)
$schreiber.Write($png)
[IO.File]::WriteAllBytes((Join-Path $ordner 'scriptlab.ico'), $icoStrom.ToArray())
$schreiber.Dispose(); $icoStrom.Dispose(); $strom.Dispose(); $grafik.Dispose(); $bild.Dispose()
$schrift.Dispose(); $farbe.Dispose(); $textfarbe.Dispose(); $pfad.Dispose(); $format.Dispose()
