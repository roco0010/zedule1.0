# ===============================
# Script PowerShell para limpiar repo y preparar Netlify
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

# 2️⃣ Asegura que .gitignore tenga estas entradas
$gitignorePath = ".gitignore"
$ignoreEntries = @(".env", ".env.local", ".env.example", "firebaseConfig.js", "dist/", "node_modules/")

foreach ($entry in $ignoreEntries) {
    if (-not (Get-Content $gitignorePath | Select-String -SimpleMatch $entry)) {
        Add-Content $gitignorePath $entry
        Write-Output "Added $entry to .gitignore"
    } else {
        Write-Output "$entry already in .gitignore"
    }
}

# 3️⃣ Borra node_modules y dist (si existen)
if (Test-Path "node_modules") { Remove-Item -Recurse -Force "node_modules"; Write-Output "Deleted node_modules" }
if (Test-Path "dist") { Remove-Item -Recurse -Force "dist"; Write-Output "Deleted dist" }

# 4️⃣ Borra package-lock.json (opcional para instalación limpia)
if (Test-Path "package-lock.json") { Remove-Item -Force "package-lock.json"; Write-Output "Deleted package-lock.json" }

# 5️⃣ Reinstala dependencias
Write-Output "Installing npm dependencies..."
npm install

# 6️⃣ Commit de limpieza
git add .
git commit -m "Clean secrets, update .gitignore, reinstall dependencies for Netlify" -m "Ready for Netlify deploy"
Write-Output "✅ Script completado. Ahora haz 'git push origin main' y dispara un nuevo deploy en Netlify."
