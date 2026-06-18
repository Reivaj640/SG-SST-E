// Genera un .ico multi-resolución desde KIAR256.ico usando solo módulos nativos de Node
// No requiere dependencias externas (sin ImageMagick, sin sharp, sin png-to-ico)

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Buscar PowerShell
function runPS(scriptContent) {
  const tmpScript = path.join(require('os').tmpdir(), `gen-ico-${Date.now()}.ps1`);
  fs.writeFileSync(tmpScript, '\uFEFF' + scriptContent, { encoding: 'utf8' }); // BOM para UTF-8
  try {
    const out = execSync(`powershell -ExecutionPolicy Bypass -NoProfile -File "${tmpScript}"`, {
      encoding: 'buffer',
      maxBuffer: 50 * 1024 * 1024
    });
    return out.toString('utf8');
  } finally {
    try { fs.unlinkSync(tmpScript); } catch (e) {}
  }
}

const sourcePath = path.join(__dirname, '..', 'assets', 'KIAR256.ico');
const outputPath = path.join(__dirname, '..', 'assets', 'K+AIR-multires.ico');

if (!fs.existsSync(sourcePath)) {
  console.error(`No existe el icono fuente: ${sourcePath}`);
  process.exit(1);
}

const psScript = `
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$src = '${sourcePath.replace(/\\/g, '\\\\')}'
$out = '${outputPath.replace(/\\/g, '\\\\')}'
$img = [System.Drawing.Image]::FromFile($src)
$sizes = @(16, 24, 32, 48, 64, 128, 256)
$tmp = Join-Path $env:TEMP ('kair-' + [Guid]::NewGuid())
New-Item -ItemType Directory -Force -Path $tmp | Out-Null
$entries = @()
foreach ($s in $sizes) {
    $bmp = New-Object System.Drawing.Bitmap($s, $s, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $g.Clear([System.Drawing.Color]::Transparent)
    $g.DrawImage($img, 0, 0, $s, $s)
    $p = Join-Path $tmp ($s.ToString() + '.png')
    $bmp.Save($p, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()
    $bytes = [System.IO.File]::ReadAllBytes($p)
    $entries += [pscustomobject]@{ Size = $s; Bytes = $bytes }
    Write-Host ('SIZE ' + $s + ': ' + $bytes.Length + ' bytes')
}
$img.Dispose()
$n = $entries.Count
$hdr = 6 + 16 * $n
$off = $hdr
foreach ($e in $entries) {
    $e | Add-Member -NotePropertyName Offset -NotePropertyValue $off -Force
    $off += $e.Bytes.Length
}
$fs = [System.IO.File]::Create($out)
$bw = New-Object System.IO.BinaryWriter($fs)
$bw.Write([UInt16]0)
$bw.Write([UInt16]1)
$bw.Write([UInt16]$n)
foreach ($e in $entries) {
    $dim = if ($e.Size -ge 256) { 0 } else { $e.Size }
    $bw.Write([byte]$dim)
    $bw.Write([byte]$dim)
    $bw.Write([byte]0)
    $bw.Write([byte]0)
    $bw.Write([UInt16]1)
    $bw.Write([UInt16]32)
    $bw.Write([UInt32]$e.Bytes.Length)
    $bw.Write([UInt32]$e.Offset)
}
foreach ($e in $entries) {
    $bw.Write($e.Bytes)
}
$bw.Close()
$fs.Close()
# NO usar Remove-Item: limpiamos via Node despues
Write-Host ('TEMP_DIR=' + $tmp)
Write-Host ('OUTPUT_SIZE=' + (Get-Item $out).Length)
`;

console.log('Generando icono multi-resolución...');
const result = runPS(psScript);
console.log(result);

const tempDirMatch = result.match(/TEMP_DIR=(.+)/);
const tempDir = tempDirMatch ? tempDirMatch[1].trim() : null;

if (tempDir && fs.existsSync(tempDir)) {
  try {
    const files = fs.readdirSync(tempDir);
    for (const f of files) fs.unlinkSync(path.join(tempDir, f));
    fs.rmdirSync(tempDir);
  } catch (e) {
    // Limpieza silenciosa
  }
}

if (fs.existsSync(outputPath)) {
  const stats = fs.statSync(outputPath);
  console.log(`\n✓ Icono multi-res creado: ${outputPath}`);
  console.log(`  Tamaño total: ${stats.length} bytes`);
} else {
  console.error(`\n✗ No se generó el archivo de salida`);
  process.exit(1);
}
