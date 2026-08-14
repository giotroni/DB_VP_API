# Riporta il database locale allo stato del dump di produzione.
# Cancella il volume db_data e lo ricrea, riesegue gli script in docker/initdb:
# dump -> FACT_FATTURE_COLLABORATORI -> utente di test -> migration non ancora
# in produzione (spese viaggi/vitto, note di accredito, allineamento delle
# fatture ai PDF, incassi dal registro, storni collegati alle note).
#
#   .\docker\reset-db.ps1
#
# I file del progetto (codice, DB/uploads) non vengono toccati: stanno sull'host.

$ErrorActionPreference = 'Stop'

# Esegui sempre dalla radice del repo, indipendentemente da dove viene lanciato
Set-Location (Split-Path -Parent $PSScriptRoot)

if (-not (Test-Path '.env')) {
    throw "Manca il file .env. Copialo da .env.example:  cp .env.example .env"
}

# Legge il .env in una hashtable (docker compose lo legge da solo, qui serve
# solo per sapere quale dump usare e per interrogare il DB a fine reset)
$cfg = @{}
foreach ($riga in Get-Content '.env') {
    if ($riga -match '^\s*([A-Z_]+)\s*=\s*(.*)$') { $cfg[$Matches[1]] = $Matches[2].Trim() }
}
$backupDate = if ($cfg.BACKUP_DATE) { $cfg.BACKUP_DATE } else { '260804' }
$dbName     = if ($cfg.DB_NAME)     { $cfg.DB_NAME }     else { 'vaglioty_DB_VP' }
$dbUser     = if ($cfg.DB_USER)     { $cfg.DB_USER }     else { 'vaglioty_DB_VP' }
$dbPass     = $cfg.DB_PASSWORD

$dump = "DB/Backup/${backupDate}_vaglioty_DB_VP.sql"
if (-not (Test-Path $dump)) {
    throw "Dump non trovato: $dump (controlla BACKUP_DATE nel file .env)"
}

Write-Host "Reset del database locale dal dump $dump" -ForegroundColor Cyan
Write-Host "Tutte le modifiche fatte in locale al database andranno perse." -ForegroundColor Yellow
$conferma = Read-Host "Procedere? (s/N)"
if ($conferma -notmatch '^[sSyY]$') {
    Write-Host "Annullato."
    exit 1
}

docker compose down -v
docker compose up -d

Write-Host "`nAttendo che il database sia pronto..." -ForegroundColor Cyan
$pronto = $false
foreach ($i in 1..60) {
    $stato = docker inspect --format '{{.State.Health.Status}}' vp_db 2>$null
    if ($stato -eq 'healthy') { $pronto = $true; break }
    Start-Sleep -Seconds 2
}
if (-not $pronto) { throw "Il container vp_db non e' diventato healthy: guarda 'docker compose logs db'" }

Write-Host "`nTabelle importate:" -ForegroundColor Green
docker compose exec -T db mariadb -u $dbUser -p"$dbPass" $dbName `
    -e "SELECT TABLE_NAME, TABLE_ROWS FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() ORDER BY TABLE_NAME;"
