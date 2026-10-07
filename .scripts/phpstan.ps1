param(
  [Parameter(Mandatory = $true)]
  [string]$Path,

  [Nullable[int]]$Level = $null,

  [string]$MemoryLimit = '1G'
)

$ErrorActionPreference = 'Stop'

$scriptParent = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path

if ( (Split-Path $scriptParent -Leaf) -eq '.github' )
{
  $workspaceRoot = (Resolve-Path (Join-Path $scriptParent '..')).Path
}
else
{
  $workspaceRoot = $scriptParent
}

Push-Location $workspaceRoot

$outputFile = [System.IO.Path]::GetTempFileName()
$errorFile = [System.IO.Path]::GetTempFileName()

try
{
  $targetPath = (Resolve-Path -Path $Path -ErrorAction Stop).Path
  $projectExecutable = Join-Path $workspaceRoot 'vendor\bin\phpstan.bat'
  $globalExecutable = Join-Path $env:USERPROFILE '.composer-tools\vendor\bin\phpstan.bat'

  if ( Test-Path $projectExecutable )
  {
    $phpstanExecutable = $projectExecutable
  }
  elseif ( Test-Path $globalExecutable )
  {
    $phpstanExecutable = $globalExecutable
  }
  else
  {
    $phpstanCommand = Get-Command phpstan -ErrorAction SilentlyContinue

    if ( !$phpstanCommand )
    {
      throw 'PHPStan was not found in the project, global Composer tools, or PATH.'
    }

    $phpstanExecutable = $phpstanCommand.Source
  }

  $arguments = @(
    'analyse',
    $targetPath,
    "--memory-limit=$MemoryLimit",
    '--error-format=json',
    '--no-progress'
  )

  # project-specific: the PHP API keeps its Composer dependencies in .api/vendor
  $apiAutoload = Join-Path $workspaceRoot '.api\vendor\autoload.php'
  if ( Test-Path $apiAutoload )
  {
    $arguments += "--autoload-file=$apiAutoload"
  }

  $configFiles = @( 'phpstan.neon', 'phpstan.neon.dist', 'phpstan.dist.neon' )
  $hasRepositoryConfig = $configFiles.Where( { Test-Path (Join-Path $workspaceRoot $_) } ).Count -gt 0

  if ( $null -ne $Level )
  {
    $arguments += "--level=$Level"
  }
  elseif ( !$hasRepositoryConfig )
  {
    $arguments += '--level=6'
  }

  $previousErrorActionPreference = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  & $phpstanExecutable @arguments 1> $outputFile 2> $errorFile
  $phpstanExitCode = $LASTEXITCODE
  $ErrorActionPreference = $previousErrorActionPreference

  $jsonText = Get-Content -Path $outputFile -Raw

  if ( [string]::IsNullOrWhiteSpace( $jsonText ) )
  {
    $errorText = Get-Content -Path $errorFile -Raw
    throw "PHPStan returned no JSON output. $errorText"
  }

  $result = $jsonText | ConvertFrom-Json
  $issues = @()
  $normalizedTarget = $targetPath.TrimEnd( '\', '/' ).ToLowerInvariant()
  $targetIsDirectory = Test-Path $targetPath -PathType Container

  foreach ( $file in $result.files.PSObject.Properties )
  {
    $filePath = $file.Name
    $normalizedFile = $filePath.ToLowerInvariant()
    $isInScope = $normalizedFile -eq $normalizedTarget

    if ( $targetIsDirectory )
    {
      $isInScope = $normalizedFile.StartsWith( $normalizedTarget + [System.IO.Path]::DirectorySeparatorChar )
    }

    if ( $isInScope -and $normalizedFile -notmatch '[\\/]vendor[\\/]' )
    {
      foreach ( $message in $file.Value.messages )
      {
        $issues += [PSCustomObject]@{
          File = $filePath
          Line = $message.line
          Identifier = $message.identifier
          Message = $message.message
        }
      }
    }
  }

  Write-Output "path=$targetPath"
  Write-Output "issue_count=$($issues.Count)"

  if ( $issues.Count -gt 0 )
  {
    $issues |
      Group-Object File |
      Sort-Object Count -Descending |
      ForEach-Object { Write-Output "file=$($_.Name) errors=$($_.Count)" }

    Write-Output '---DETAILS---'

    foreach ( $issue in $issues )
    {
      Write-Output "[$($issue.Identifier)] $($issue.File):$($issue.Line) $($issue.Message)"
    }

    exit 1
  }

  if ( $phpstanExitCode -ne 0 )
  {
    $globalErrors = $result.errors -join [Environment]::NewLine
    throw "PHPStan failed with exit code $phpstanExitCode. $globalErrors"
  }

  exit 0
}
finally
{
  Pop-Location
  Remove-Item $outputFile, $errorFile -Force -ErrorAction SilentlyContinue
}