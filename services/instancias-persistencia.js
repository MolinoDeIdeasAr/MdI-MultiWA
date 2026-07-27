const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const INSTANCIAS_FILE = path.join(DATA_DIR, 'instancias.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// Obtener todas las instancias de un usuario
function obtenerInstanciasPorUsuario(userId) {
    try {
        if (fs.existsSync(INSTANCIAS_FILE)) {
            const raw = fs.readFileSync(INSTANCIAS_FILE, 'utf8');
            const data = JSON.parse(raw);
            return data[userId] || [];
        }
    } catch (err) {
        console.error('❌ Error al obtener instancias:', err);
    }
    return [];
}

// Obtener todos los usuarios
function obtenerTodosLosUsuarios() {
    try {
        if (fs.existsSync(INSTANCIAS_FILE)) {
            const raw = fs.readFileSync(INSTANCIAS_FILE, 'utf8');
            const data = JSON.parse(raw);
            return Object.keys(data);
        }
    } catch (err) {
        console.error('❌ Error al obtener usuarios:', err);
    }
    return [];
}

// Guardar instancia
function guardarInstancia(userId, instanceId, data) {
    try {
        let todasLasInstancias = {};
        if (fs.existsSync(INSTANCIAS_FILE)) {
            const raw = fs.readFileSync(INSTANCIAS_FILE, 'utf8');
            todasLasInstancias = JSON.parse(raw);
        }
        
        if (!todasLasInstancias[userId]) {
            todasLasInstancias[userId] = [];
        }
        
        const index = todasLasInstancias[userId].findIndex(i => i.id === instanceId);
        const instanciaData = {
            id: instanceId,
            numero: data.numero || null,
            listo: data.listo || false,
            estado: data.estado || null,
            fechaCreacion: data.fechaCreacion || new Date().toISOString()
        };
        
        if (index !== -1) {
            todasLasInstancias[userId][index] = instanciaData;
        } else {
            todasLasInstancias[userId].push(instanciaData);
        }
        
        fs.writeFileSync(INSTANCIAS_FILE, JSON.stringify(todasLasInstancias, null, 2), 'utf8');
        return true;
    } catch (err) {
        console.error('❌ Error al guardar instancia:', err);
        return false;
    }
}

// Eliminar instancia
function eliminarInstancia(userId, instanceId) {
    try {
        if (fs.existsSync(INSTANCIAS_FILE)) {
            const raw = fs.readFileSync(INSTANCIAS_FILE, 'utf8');
            const data = JSON.parse(raw);
            
            if (data[userId]) {
                data[userId] = data[userId].filter(i => i.id !== instanceId);
                if (data[userId].length === 0) {
                    delete data[userId];
                }
                fs.writeFileSync(INSTANCIAS_FILE, JSON.stringify(data, null, 2), 'utf8');
                return true;
            }
        }
    } catch (err) {
        console.error('❌ Error al eliminar instancia:', err);
    }
    return false;
}

module.exports = {
    obtenerInstanciasPorUsuario,
    obtenerTodosLosUsuarios,
    guardarInstancia,
    eliminarInstancia
};