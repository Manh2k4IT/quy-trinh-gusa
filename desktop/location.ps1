$ErrorActionPreference = 'Stop'
$watcher = $null
try {
    Add-Type -AssemblyName System.Device
    $watcher = New-Object System.Device.Location.GeoCoordinateWatcher
    $watcher.Start($false)
    $deadline = [DateTime]::UtcNow.AddSeconds(30)
    while ($watcher.Position.Location.IsUnknown -and $watcher.Permission -ne 'Denied' -and [DateTime]::UtcNow -lt $deadline) {
        Start-Sleep -Milliseconds 250
    }
    if ($watcher.Permission -eq 'Denied') {
        @{ ok = $false; error = @{ code = 1; message = 'Windows denied location access.' } } | ConvertTo-Json -Compress
    } elseif ($watcher.Position.Location.IsUnknown) {
        @{ ok = $false; error = @{ code = 2; message = 'Windows could not determine a location.' } } | ConvertTo-Json -Compress
    } else {
        $location = $watcher.Position.Location
        @{
            ok = $true
            position = @{
                coords = @{
                    latitude = $location.Latitude
                    longitude = $location.Longitude
                    accuracy = $location.HorizontalAccuracy
                }
                timestamp = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
            }
        } | ConvertTo-Json -Depth 4 -Compress
    }
} catch {
    @{ ok = $false; error = @{ code = 2; message = $_.Exception.Message } } | ConvertTo-Json -Compress
} finally {
    if ($null -ne $watcher) { $watcher.Dispose() }
}
