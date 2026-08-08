# Non-admin TCP Web Server for Mobile Wi-Fi Access
$port = 8080
$ip = [System.Net.IPAddress]::Any
$listener = New-Object System.Net.Sockets.TcpListener($ip, $port)

try {
    $listener.Start()
    Write-Host "TCP Web Server running on port $port!"
    Write-Host "Local Wi-Fi Access URL: http://192.168.0.248:$port/index.html"
    
    while ($true) {
        $client = $listener.AcceptTcpClient()
        $stream = $client.GetStream()
        $reader = New-Object System.IO.StreamReader($stream)
        $writer = New-Object System.IO.StreamWriter($stream)
        
        $requestLine = $reader.ReadLine()
        if ([string]::IsNullOrEmpty($requestLine)) { 
            $client.Close()
            continue 
        }
        
        $tokens = $requestLine.Split(' ')
        $url = $tokens[1]
        if ($url -eq "/" -or $url -eq "") { $url = "/index.html" }
        
        $filePath = Join-Path "C:\Users\solan\.gemini\antigravity-ide\scratch\exellar-upload-portal" $url.TrimStart('/')
        
        if (Test-Path $filePath -PathType Leaf) {
            $bytes = [System.IO.File]::ReadAllBytes($filePath)
            
            $mime = "text/html"
            if ($filePath.EndsWith(".css")) { $mime = "text/css" }
            elseif ($filePath.EndsWith(".js")) { $mime = "text/javascript" }
            elseif ($filePath.EndsWith(".jpg") -or $filePath.EndsWith(".jpeg")) { $mime = "image/jpeg" }
            elseif ($filePath.EndsWith(".png")) { $mime = "image/png" }
            elseif ($filePath.EndsWith(".svg")) { $mime = "image/svg+xml" }
            
            $header = "HTTP/1.1 200 OK`r`nContent-Type: $mime`r`nContent-Length: $($bytes.Length)`r`nConnection: close`r`n`r`n"
            $headerBytes = [System.Text.Encoding]::UTF8.GetBytes($header)
            
            $stream.Write($headerBytes, 0, $headerBytes.Length)
            $stream.Write($bytes, 0, $bytes.Length)
        } else {
            $notFound = "HTTP/1.1 404 Not Found`r`nContent-Length: 0`r`nConnection: close`r`n`r`n"
            $notFoundBytes = [System.Text.Encoding]::UTF8.GetBytes($notFound)
            $stream.Write($notFoundBytes, 0, $notFoundBytes.Length)
        }
        
        $writer.Flush()
        $client.Close()
    }
} catch {
    Write-Host "Error: $_"
} finally {
    if ($listener) { $listener.Stop() }
}
