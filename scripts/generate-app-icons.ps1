$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$root = Split-Path $PSScriptRoot -Parent
$source = [System.Drawing.Image]::FromFile((Join-Path $root 'motif 2223 green.png'))

function New-IconPng([int]$size, [double]$coverage = 0.9) {
    $bitmap = New-Object System.Drawing.Bitmap($size, $size)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $stream = New-Object System.IO.MemoryStream
    try {
        $graphics.Clear([System.Drawing.Color]::White)
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $scale = $size * $coverage / [Math]::Max($source.Width, $source.Height)
        $width = [int][Math]::Round($source.Width * $scale)
        $height = [int][Math]::Round($source.Height * $scale)
        $graphics.DrawImage($source, [int](($size - $width) / 2), [int](($size - $height) / 2), $width, $height)
        $bitmap.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
        return ,$stream.ToArray()
    } finally {
        $stream.Dispose()
        $graphics.Dispose()
        $bitmap.Dispose()
    }
}

function Write-IconPng([string]$relativePath, [int]$size, [double]$coverage = 0.9) {
    $target = Join-Path $root $relativePath
    [System.IO.Directory]::CreateDirectory((Split-Path $target -Parent)) | Out-Null
    [System.IO.File]::WriteAllBytes($target, (New-IconPng $size $coverage))
}

try {
    Write-IconPng 'desktop\icons\app.png' 512
    Write-IconPng 'app-icons\icon-192.png' 192
    Write-IconPng 'app-icons\icon-512.png' 512
    Write-IconPng 'app-icons\apple-touch-icon.png' 180
    Write-IconPng 'app-icons\favicon.png' 32
    $sizes = @(16, 24, 32, 48, 64, 128, 256)
    $frames = @($sizes | ForEach-Object { ,(New-IconPng $_) })
    $stream = [System.IO.File]::Create((Join-Path $root 'desktop\icons\app.ico'))
    $writer = New-Object System.IO.BinaryWriter($stream)
    try {
        $writer.Write([uint16]0)
        $writer.Write([uint16]1)
        $writer.Write([uint16]$sizes.Count)
        $offset = 6 + 16 * $sizes.Count
        for ($i = 0; $i -lt $sizes.Count; $i++) {
            $dimension = $sizes[$i] % 256
            $writer.Write([byte]$dimension)
            $writer.Write([byte]$dimension)
            $writer.Write([byte]0)
            $writer.Write([byte]0)
            $writer.Write([uint16]1)
            $writer.Write([uint16]32)
            $writer.Write([uint32]$frames[$i].Length)
            $writer.Write([uint32]$offset)
            $offset += $frames[$i].Length
        }
        foreach ($frame in $frames) { $writer.Write([byte[]]$frame) }
    } finally {
        $writer.Dispose()
        $stream.Dispose()
    }
    $densities = @(
        @{ Name = 'mdpi'; Size = 48; Foreground = 108 },
        @{ Name = 'hdpi'; Size = 72; Foreground = 162 },
        @{ Name = 'xhdpi'; Size = 96; Foreground = 216 },
        @{ Name = 'xxhdpi'; Size = 144; Foreground = 324 },
        @{ Name = 'xxxhdpi'; Size = 192; Foreground = 432 }
    )
    foreach ($density in $densities) {
        $directory = "android\app\src\main\res\mipmap-$($density.Name)"
        Write-IconPng "$directory\ic_launcher.png" $density.Size
        Write-IconPng "$directory\ic_launcher_round.png" $density.Size
        Write-IconPng "$directory\ic_launcher_foreground.png" $density.Foreground 0.6
    }
    Write-IconPng 'ios\App\App\Assets.xcassets\AppIcon.appiconset\AppIcon-512@2x.png' 1024
    Write-Output 'Generated Windows, Android and iOS app icons.'
} finally {
    $source.Dispose()
}
