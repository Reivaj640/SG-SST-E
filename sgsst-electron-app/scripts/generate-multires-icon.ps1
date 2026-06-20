Add-Type -AssemblyName System.Drawing

$sourcePath = 'C:\Proyectos de Programación\Clone de Git\SG-SST-E\sgsst-electron-app\assets\KIAR256.ico'
$outputPath = 'C:\Proyectos de Programación\Clone de Git\SG-SST-E\sgsst-electron-app\assets\K+AIR-multires.ico'

if (-not (Test-Path $sourcePath)) {
    Write-Error "No se encontró el icono fuente: $sourcePath"
    exit 1
}

# Cargar imagen fuente (256x256)
$sourceImage = [System.Drawing.Image]::FromFile($sourcePath)

# Resoluciones estándar que Windows espera para iconos
$sizes = @(16, 24, 32, 48, 64, 128, 256)

# Directorio temporal para PNGs intermedios
$tempDir = Join-Path $env:TEMP "kair-icons-$([Guid]::NewGuid())"
New-Item -ItemType Directory -Force -Path $tempDir | Out-Null

$pngEntries = @()
foreach ($size in $sizes) {
    $bitmap = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $graphics.Clear([System.Drawing.Color]::Transparent)
    $graphics.DrawImage($sourceImage, 0, 0, $size, $size)

    $pngPath = Join-Path $tempDir "icon-$size.png"
    $bitmap.Save($pngPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $graphics.Dispose()
    $bitmap.Dispose()

    $pngBytes = [System.IO.File]::ReadAllBytes($pngPath)
    $pngEntries += @{ Size = $size; Bytes = $pngBytes }
    Write-Host "Generado: ${size}x${size} ($($pngBytes.Length) bytes)"
}

$sourceImage.Dispose()

# Construir .ico multi-resolución
$numImages = $pngEntries.Count
$headerSize = 6 + (16 * $numImages)

# Calcular offsets
$currentOffset = $headerSize
foreach ($entry in $pngEntries) {
    $entry | Add-Member -NotePropertyName Offset -NotePropertyValue $currentOffset
    $currentOffset += $entry.Bytes.Length
}

$fs = [System.IO.File]::Create($outputPath)
$bw = New-Object System.IO.BinaryWriter($fs)

# Header: Reserved(2) + Type(2)=1 + Count(2)
$bw.Write([UInt16]0)
$bw.Write([UInt16]1)
$bw.Write([UInt16]$numImages)

# Directory entries: 16 bytes cada uno
foreach ($entry in $pngEntries) {
    $dim = if ($entry.Size -ge 256) { 0 } else { $entry.Size }
    $bw.Write([byte]$dim)        # Width (0 = 256)
    $bw.Write([byte]$dim)        # Height (0 = 256)
    $bw.Write([byte]0)           # ColorCount
    $bw.Write([byte]0)           # Reserved
    $bw.Write([UInt16]1)         # Planes
    $bw.Write([UInt16]32)        # BitCount
    $bw.Write([UInt32]$entry.Bytes.Length)
    $bw.Write([UInt32]$entry.Offset)
}

# Image data
foreach ($entry in $pngEntries) {
    $bw.Write($entry.Bytes)
}

$bw.Close()
$fs.Close()

# Cleanup
Remove-Item -Recurse -Force $tempDir

Write-Host ""
Write-Host "✓ Icono multi-resolución creado: $outputPath" -ForegroundColor Green
Write-Host "  Tamaños embebidos: $($sizes -join ', ')"
$fileInfo = Get-Item $outputPath
Write-Host "  Peso total: $($fileInfo.Length) bytes"
