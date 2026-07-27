const fs = require('fs');
const path = require('path');

const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
const MAX_AGE_DAYS = 7; // Borrar archivos de más de 7 días

if (!fs.existsSync(UPLOADS_DIR)) {
    console.log('📂 No existe carpeta uploads');
    process.exit(0);
}

const files = fs.readdirSync(UPLOADS_DIR);
let borrados = 0;
let total = 0;

for (const file of files) {
    total++;
    const filePath = path.join(UPLOADS_DIR, file);
    const stats = fs.statSync(filePath);
    const age = (Date.now() - stats.mtimeMs) / (1000 * 60 * 60 * 24);
    
    if (age > MAX_AGE_DAYS) {
        fs.unlinkSync(filePath);
        borrados++;
        console.log(`🗑️ Eliminado: ${file} (${age.toFixed(1)} días)`);
    }
}

console.log(`✅ Limpieza completada: ${borrados} archivos eliminados de ${total} totales`);