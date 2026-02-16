# ===============================
# Script PowerShell: Limpiar repo y preparar Netlify con .env.example
# ===============================

# 1️⃣ Borra archivos con secretos del repo (sin eliminar tu copia local)
$secretFiles = @(".env", ".env.local", ".env.example", "firebaseConfig.js")

foreach ($file in $secretFiles) {
    if (Test-Path $file) {
        git rm --cached $file -f
        Write-Output "Removed $file from git index"
    } else {
        Write-Output "$file not found, skipping"
    }
}

# 2️⃣ Asegura que .gitignore tenga las entradas correctas
$gitignorePath = ".gitignore"
$ignoreEntries = @(".env", ".env.local", ".env.example", "firebaseConfig.js", "dist/", "node_modules/")

foreach ($entry in $ignoreEntries) {
    if (-not (Get-Content $gitignorePath -Raw | Select-String -SimpleMatch $entry)) {
        Add-Content $gitignorePath $entry
        Write-Output "Added $entry to .gitignore"
    } else {
        Write-Output "$entry already in .gitignore"
    }
}

# 3️⃣ Borra node_modules, dist y package-lock.json si existen
foreach ($path in @("node_modules", "dist", "package-lock.json")) {
    if (Test-Path $path) {
        Remove-Item -Recurse -Force $path
        Write-Output "Deleted $path"
    }
}

# 4️⃣ Reinstala dependencias
Write-Output "Installing npm dependencies..."
npm install

# 5️⃣ Crear .env.example con placeholders
$envExampleContent = @"
VITE_FIREBASE_API_KEY=your_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id
"@

$envExamplePath = ".env.example"
Set-Content -Path $envExamplePath -Value $envExampleContent -Force
Write-Output "Created .env.example with placeholders"

# 6️⃣ Commit limpio
git add .
git commit -m "Clean secrets, update .gitignore, reinstall dependencies, add .env.example" -m "Ready for Netlify deploy"

Write-Output "✅ Script completado. Ahora haz 'git push origin main' y dispara un nuevo deploy en Netlify."
