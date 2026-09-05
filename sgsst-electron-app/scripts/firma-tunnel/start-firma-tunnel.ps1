<#
=============================================================================
 K+AIR Firma Electrónica — Servidor casero con túnel Cloudflare NAMED
=============================================================================
 Qué hace, EN ESTE ORDEN:

   1. Inicia un túnel NAMED Cloudflare (kair-firma → firma.kair.fyi) hacia
      127.0.0.1:3001. La URL es FIJA — no se captura del log como antes
      con los quick tunnels temporales.
   2. (Re)inicia firma-service para que adopte la URL del .env. El orden
      sigue siendo OBLIGATORIO: túnel → servicio.
   3. Modo supervisión: cada 60 s verifica que cloudflared y el servicio
      sigan vivos y que /health responda por el túnel fijo. Si algo cae,
      repite el ciclo (misma URL — los enlaces SIGUEN funcionando).

 Requisitos:
   - cloudflared instalado (winget install Cloudflare.cloudflared)
   - ~/.cloudflared/cert.pem  (de `cloudflared tunnel login`)
   - ~/.cloudflared/config.yml  (apunta a tunnel kair-firma + ingress)
   - Tunnel persistente: `cloudflared tunnel create kair-firma`
   - DNS: `cloudflared tunnel route dns kair-firma firma.kair.fyi`
   - .env con PUBLIC_URL=https://firma.kair.fyi

 Uso:
   powershell -ExecutionPolicy Bypass -File start-firma-tunnel.ps1
   powershell -ExecutionPolicy Bypass -File start-firma-tunnel.ps1 -Once
     (arranca todo y sale sin supervisor; útil para pruebas)

 Estado visible en: scripts/firma-tunnel/estado.txt
=============================================================================
#>
param(
  [switch]$Once
)

$ErrorActionPreference = 'Stop'
$ScriptDir   = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot    = Split-Path -Parent (Split-Path -Parent $ScriptDir)
$FirmaDir    = Join-Path $RepoRoot 'firma-service'
$EnvFile     = Join-Path $FirmaDir '.env'
$EstadoFile  = Join-Path $ScriptDir 'estado.txt'
$LogDir      = Join-Path $ScriptDir 'logs'
$TunnelLog   = Join-Path $LogDir 'cloudflared.log'
$ServiceLog  = Join-Path $LogDir 'firma-service.log'

# Ruta del binario (MSI instala en Program Files (x86) en Windows 32/64).
# Usamos [Environment]::GetEnvironmentVariable para evitar el quirk del parser
# de PowerShell con "$env:ProgramFiles(x86)" (lo trata como "$env:ProgramFiles (x86)").
$pf86 = [Environment]::GetEnvironmentVariable('ProgramFiles(x86)')
$pf   = [Environment]::GetEnvironmentVariable('ProgramFiles')
$Cloudflared = Join-Path $pf86 'cloudflared\cloudflared.exe'
if (-not (Test-Path $Cloudflared)) {
  $Cloudflared = Join-Path $pf 'cloudflared\cloudflared.exe'
}

New-Item -ItemType Directory -Path $LogDir -Force | Out-Null

# Traza de pasos a archivo (diagnóstico cuando corre como tarea programada,
# donde no hay consola para leer Write-Host).
$PasoLog = Join-Path $LogDir 'pasos.log'
function Paso([string]$msg) {
  Add-Content $PasoLog -Value ("[" + (Get-Date -Format 'HH:mm:ss') + "] " + $msg)
}

function Write-Estado {
  param([string]$TunnelUrl, [string]$Nota)
  $line = @(
    ("ultima_actualizacion = " + (Get-Date -Format 'yyyy-MM-dd HH:mm:ss')),
    ("tunnel_url = " + $(if ($TunnelUrl) { $TunnelUrl } else { '(ninguna)' })),
    ("firma_service = http://localhost:3001"),
    ("nota = " + $Nota)
  ) -join "`n"
  $line | Set-Content -Path $EstadoFile -Encoding utf8
}

function Test-Port3001Free {
  return -not (Test-NetConnection -ComputerName 127.0.0.1 -Port 3001 -InformationLevel Quiet -WarningAction SilentlyContinue)
}

function Stop-FirmaService {
  # Detiene cualquier proceso escuchando en 3001 (nuestro node) para poder
  # reiniciarlo con el .env nuevo. El auto-arranque de K+AIR detecta el
  # puerto ocupado más adelante y no duplica (main.js ya lo valida).
  $conns = Get-NetTCPConnection -LocalPort 3001 -State Listen -ErrorAction SilentlyContinue
  foreach ($c in $conns) {
    try {
      $p = Get-Process -Id $c.OwningProcess -ErrorAction Stop
      Write-Host "[firma-tunnel] Deteniendo proceso en 3001: PID $($p.Id) ($($p.ProcessName))"
      Stop-Process -Id $p.Id -Force
    } catch { }
  }
}

function Start-FirmaService {
  # Arranca el servicio en background con log a archivo (sin ventana).
  $pinfo = New-Object System.Diagnostics.ProcessStartInfo
  $pinfo.FileName = 'node'
  $pinfo.Arguments = 'src/server.js'
  $pinfo.WorkingDirectory = $FirmaDir
  $pinfo.UseShellExecute = $false
  $pinfo.RedirectStandardOutput = $true
  $pinfo.RedirectStandardError = $true
  $pinfo.CreateNoWindow = $true
  $proc = New-Object System.Diagnostics.Process
  $proc.StartInfo = $pinfo
  # Logueo pasivo de la salida (se acumula en el log; no es rotativo,
  # es solo para diagnóstico: journal.log único por arranque).
  $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
  $svcLog = Join-Path $LogDir "firma-service-$stamp.log"
  $proc.add_OutputDataReceived({ param($s,$e) if ($e.Data) { Add-Content $svcLog $e.Data } })
  $proc.add_ErrorDataReceived({ param($s,$e) if ($e.Data) { Add-Content $svcLog $e.Data } })
  [void]$proc.Start()
  $proc.BeginOutputReadLine()
  $proc.BeginErrorReadLine()
  Write-Host "[firma-tunnel] firma-service iniciado PID $($proc.Id) (log: $svcLog)"
  return $proc
}

function Wait-TunnelUrl {
  # Espera a que cloudflared escriba la URL del quick tunnel (puede ir a
  # stdout o stderr según versión). Buscamos en ambos archivos.
  $tunnelErr = $TunnelLog + '.err'
  $deadline = (Get-Date).AddSeconds(45)
  while ((Get-Date) -lt $deadline) {
    foreach ($f in @($TunnelLog, $tunnelErr)) {
      if ((Test-Path $f) -and ((Get-Item $f).Length -gt 0)) {
        $content = Get-Content $f -Raw -ErrorAction SilentlyContinue
        if ([string]::IsNullOrEmpty($content)) { continue }
        $m = [regex]::Match($content, 'https://[a-z0-9\-]+\.trycloudflare\.com', 'IgnoreCase')
        if ($m -and $m.Success) { return $m.Value }
      }
    }
    Start-Sleep -Milliseconds 400
  }
  return $null
}

function Update-EnvPublicUrl {
  param([string]$Url)
  if (-not (Test-Path $EnvFile)) { throw "No existe $EnvFile" }
  $bak = $EnvFile + '.bak-' + (Get-Date -Format 'yyyyMMddHHmmss')
  Copy-Item $EnvFile $bak -Force
  # Línea por línea (NO -Raw + -NoNewline: eso colapsa el .env a una sola
  # línea y rompe el parser de dotenv — bug real encontrado en validación).
  $lines = Get-Content $EnvFile
  $keys = @('PUBLIC_URL','PUBLIC_URL_FIRMA')
  $found = @{}
  for ($i = 0; $i -lt $lines.Count; $i++) {
    foreach ($key in $keys) {
      if ($lines[$i] -match ("^" + [regex]::Escape($key) + "=")) {
        $lines[$i] = "$key=$Url"
        $found[$key] = $true
      }
    }
  }
  # Si alguna key no existía, se agrega al final (línea nueva propia)
  foreach ($key in $keys) {
    if (-not $found.ContainsKey($key)) { $lines += "$key=$Url" }
  }
  Set-Content $EnvFile -Value $lines -Encoding utf8
  Write-Host "[firma-tunnel] .env actualizado → $Url (backup: $bak)"
}

function Start-Tunnel {
  if (Test-Path $TunnelLog) { Remove-Item $TunnelLog -Force }
  $tunnelErr = $TunnelLog + '.err'
  if (Test-Path $tunnelErr) { Remove-Item $tunnelErr -Force }
  Write-Host "[firma-tunnel] Levantando túnel NAMED (kair-firma → firma.kair.fyi)…"
  $p = Start-Process -FilePath $Cloudflared `
        -ArgumentList 'tunnel','run','kair-firma' `
        -RedirectStandardOutput $TunnelLog -RedirectStandardError $tunnelErr `
        -NoNewWindow -PassThru
  return $p
}

function Start-CicloCompleto {
  # URL fija del named tunnel (kair-firma → firma.kair.fyi).
  # No se captura del log como antes con quick tunnels: con named tunnel
  # la URL es estable y NO cambia entre reinicios.
  $url = 'https://firma.kair.fyi'

  # 1. Servicio al menos local para que el túnel tenga algo que proxiar
  if (Test-Port3001Free) {
    Write-Host '[firma-tunnel] 3001 libre → arrancando firma-service (con .env actual)'
    $script:SvcProc = Start-FirmaService
    Start-Sleep -Seconds 3
  } else {
    Write-Host '[firma-tunnel] 3001 ocupado: asumo que firma-service corre'
  }

  # 2. Túnel NAMED (URL fija, no se captura del log)
  $script:TunnelProc = Start-Tunnel
  Start-Sleep -Seconds 5  # dejar que cloudflared registre la conexión

  # 3. Reinicio del servicio para que adopte el .env actualizado (orden crítico)
  Stop-FirmaService
  Start-Sleep -Milliseconds 800
  $script:SvcProc = Start-FirmaService

  Write-Estado -TunnelUrl $url -Nota 'ciclo completo OK (named tunnel)'
  Write-Host "[firma-tunnel] ✔ URL pública: $url"
  return $url
}

# ═════════════════════════ Cuerpo principal ═════════════════════════

if (-not (Test-Path $Cloudflared)) { throw "cloudflared no encontrado. Instalar: winget install Cloudflare.cloudflared" }
if (-not (Test-Path (Join-Path $FirmaDir 'src\server.js'))) { throw "No se encontró firma-service en $FirmaDir" }

$url = Start-CicloCompleto

if ($Once) {
  Write-Host '[firma-tunnel] Modo -Once: arranque listo, sin supervisor.'
  exit 0
}

Write-Host '[firma-tunnel] Supervisor activo (Ctrl+C para detener). Cada ciclo verifica salud.'
while ($true) {
  Start-Sleep -Seconds 60

  $tunnelAlive = $script:TunnelProc -and (-not $script:TunnelProc.HasExited)
  $healthOk = $false
  if ($url) {
    try {
      $r = Invoke-WebRequest -Uri "$url/health" -UseBasicParsing -TimeoutSec 10
      $healthOk = ($r.StatusCode -eq 200)
    } catch { $healthOk = $false }
  }

  if ($tunnelAlive -and $healthOk) { continue }

  Write-Host '[firma-tunnel] Detecté túnel caído o /health sin responder. Regenerando ciclo…'
  try {
    if ($script:TunnelProc -and -not $script:TunnelProc.HasExited) { Stop-Process -Id $script:TunnelProc.Id -Force -ErrorAction SilentlyContinue }
    $url = Start-CicloCompleto
  } catch {
    Write-Estado -TunnelUrl '' -Nota ('regeneración fallida: ' + $_.Exception.Message)
    Write-Host "[firma-tunnel] Falló regeneración ($($_.Exception.Message)); reintentando en 60s"
  }
}
