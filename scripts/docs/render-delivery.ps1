# QA visual en Windows, sin Chrome ni Python. Ejecutar desde la raíz del repo.
# Si la política bloquea .ps1: Get-Content -Raw scripts/docs/render-delivery.ps1 | Invoke-Expression
$ErrorActionPreference = 'Stop'
$qaRoot = (Join-Path (Get-Location) 'docs/informes/_qa/entrega')
New-Item -ItemType Directory -Path $qaRoot -Force | Out-Null
Add-Type -AssemblyName System.Runtime.WindowsRuntime
Add-Type -AssemblyName System.Drawing
[void][Windows.Storage.StorageFile,Windows.Storage,ContentType=WindowsRuntime]
[void][Windows.Data.Pdf.PdfDocument,Windows.Data.Pdf,ContentType=WindowsRuntime]
[void][Windows.Storage.Streams.InMemoryRandomAccessStream,Windows.Storage.Streams,ContentType=WindowsRuntime]
[void][Windows.Storage.Streams.DataReader,Windows.Storage.Streams,ContentType=WindowsRuntime]
$taskMethod = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.IsGenericMethod -and $_.GetGenericArguments().Count -eq 1 -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' } | Select-Object -First 1
$actionMethod = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and -not $_.IsGenericMethod -and $_.GetParameters().Count -eq 1 } | Select-Object -First 1
function Await-Result($operation, $resultType) {
  $task = $taskMethod.MakeGenericMethod($resultType).Invoke($null, @($operation))
  $task.GetAwaiter().GetResult()
}
foreach ($pdfFile in Get-ChildItem 'docs/informes/entrega/*.pdf') {
  $file = Await-Result ([Windows.Storage.StorageFile]::GetFileFromPathAsync($pdfFile.FullName)) ([Windows.Storage.StorageFile])
  $document = Await-Result ([Windows.Data.Pdf.PdfDocument]::LoadFromFileAsync($file)) ([Windows.Data.Pdf.PdfDocument])
  Write-Output "$($pdfFile.Name): $($document.PageCount) paginas"
  for ($index = 0; $index -lt $document.PageCount; $index++) {
    $page = $document.GetPage($index)
    $stream = [Windows.Storage.Streams.InMemoryRandomAccessStream]::new()
    $renderTask = $actionMethod.Invoke($null, @($page.RenderToStreamAsync($stream)))
    [void]$renderTask.GetAwaiter().GetResult()
    $stream.Seek(0)
    $reader = [Windows.Storage.Streams.DataReader]::new($stream.GetInputStreamAt(0))
    [void](Await-Result ($reader.LoadAsync([uint32]$stream.Size)) ([uint32]))
    $bytes = New-Object byte[] ([int]$stream.Size)
    $reader.ReadBytes($bytes)
    [IO.File]::WriteAllBytes((Join-Path $qaRoot "$($pdfFile.BaseName)-$($index + 1).png"), $bytes)
    $reader.Dispose()
    $stream.Dispose()
    $page.Dispose()
  }
  for ($start = 0; $start -lt $document.PageCount; $start += 4) {
    $sheet = New-Object Drawing.Bitmap 1192,1686
    $graphics = [Drawing.Graphics]::FromImage($sheet)
    $graphics.Clear([Drawing.Color]::LightGray)
    for ($slot = 0; $slot -lt 4 -and ($start + $slot) -lt $document.PageCount; $slot++) {
      $source = [Drawing.Image]::FromFile((Join-Path $qaRoot "$($pdfFile.BaseName)-$($start + $slot + 1).png"))
      $left = [int](($slot % 2) * 596)
      $top = [int]([math]::Floor($slot / 2) * 843)
      $graphics.DrawImage($source, $left, $top, 595, 842)
      $source.Dispose()
    }
    $sheet.Save((Join-Path $qaRoot "$($pdfFile.BaseName)-contact-$([int]($start / 4) + 1).png"), [Drawing.Imaging.ImageFormat]::Png)
    $graphics.Dispose()
    $sheet.Dispose()
  }
}
