# =========================
# Script PowerShell: Preparar repo para Netlify
# =========================

# 1️⃣ Borra archivos con secretos del repo (sin eliminar local)
git rm --cached .env, .env.local, .env.example, firebaseConfig.js -r -f

# 2️⃣ Asegura que .gitignore tenga las entradas correctas
$gitignorePath = ".gitignore"
$entries = @(".env", ".env.local", ".env.example", "firebaseConfig.js", "dist/", "node_modules/")

foreach ($entry in $entries) {
    if (-not (Select-String -Path $gitignorePath -Pattern [regex]::Escape($entry) -Quiet)) {
        Add-Content $gitignorePath $entry
    }
}

# 3️⃣ Borra node_modules y dist
Remove-Item -Recurse -Force node_modules
Remove-Item -Recurse -Force dist

# 4️⃣ Borra package-lock.json (opcional, para asegurar instalación limpia)
Remove-Item -Force package-lock.json -ErrorAction SilentlyContinue

# 5️⃣ Reinstala dependencias
npm install

# 6️⃣ Asegura que Vite sea ejecutable (para Linux/Netlify)
if (Test-Path "node_modules/.bin/vite") {
    icacls "node_modules\.bin\vite" /grant *S-1-1-0:(RX)
}

# 7️⃣ Commit de limpieza
git add .
git commit -m "Clean secrets, update .gitignore, reinstall dependencies for Netlify"

Write-Output "✅ Script completado. Ahora haz 'git push origin main' y dispara un nuevo deploy en Netlify."
