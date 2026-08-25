const express = require('express');
const router = express.Router();
const sessionManager = require('../services/session-manager');
const { guardarEstado, cargarEstado, getDefaultEstado } = require('../state/estado');
const { descargarGoogleSheets } = require('../services/google-drive');
const xlsx = require('xlsx');
const {
    guardarInstancia
} = require('../services/instancias-persistencia');

// v1.2.0
//
// CHANGELOG v1.2.0:
//  • FIX: el rubro se extrae de la CELDA D1 de la planilla (un solo
//    valor para toda la planilla). Antes se buscaba una columna
//    "RUBRO" entre los datos y no la encontraba cuando el encabezado
//    tenía caracteres extra (ej: "RUBRO:").
//  • FIX: se declara la variable "sheet" fuera del if/else para poder
//    leer la celda D1 después de parsear el archivo.
//  • FIX: los contactos se guardan con ambas variantes de
//    mayúscula/minúscula (NOMBRE/NUMERO y nombre/numero) porque el
//    resto del código es inconsistente sobre qué variante usa.
//
// CHANGELOG v1.1.0:
//  • FIX: auto-selección de instancia si no hay activa.
//  • FIX: descarta filas donde el nombre es el encabezado mismo.
//  • FIX: filtrado de números fijos (no tienen WhatsApp).

router.post('/cargar', async (req, res) => {
    try {
        const userId = req.session.userId;
        let instanceId = sessionManager.getActiveInstanceId(userId);

        //------------------------------------------------------
        // FIX: si no hay instancia activa, auto-seleccionar
        //------------------------------------------------------
        if (!instanceId) {
            const instancias = sessionManager.getUserInstances(userId);
            if (instancias.length === 0) {
                return res.status(400).json({
                    error: 'No hay instancias de WhatsApp configuradas. Agregá una cuenta primero.'
                });
            }
            const candidata = instancias.find(i => i.listo) || instancias[0];
            sessionManager.setActiveInstance(userId, candidata.id);
            instanceId = candidata.id;
            console.log(`📂 [CARGAR] Auto-seleccionando instancia: ${instanceId}`);
        }

        console.log(`📂 [CARGAR] Usuario: ${userId}, Instancia: ${instanceId}`);

        //------------------------------------------------------
        // PARSEAR ARCHIVO O DESCARGAR DE DRIVE
        //------------------------------------------------------
        let datos = [];
        let rubro = '';
        let sheet = null;  // ← se declara acá para poder leer D1 después

        if (req.files && req.files.excel) {
            // ── Archivo Excel subido ──
            const file = req.files.excel;
            console.log(`📂 [ARCHIVO] ${file.name}`);
            const workbook = xlsx.read(file.data, { type: 'buffer' });
            sheet = workbook.Sheets[workbook.SheetNames[0]];
            datos = xlsx.utils.sheet_to_json(sheet, { defval: '' });
        } else if (req.query?.urlDrive || req.body?.urlDrive) {
            // ── Google Drive ──
            const url = String(req.query?.urlDrive || req.body?.urlDrive || "").trim();
            console.log(`📂 [DRIVE] URL recibida: "${url}"`);

            if (!url.includes('docs.google.com/spreadsheets')) {
                return res.status(400).json({
                    error: 'La URL no es de Google Sheets. Usá el enlace del archivo de Drive.'
                });
            }

            const dataBuffer = await descargarGoogleSheets(url);
            const workbook = xlsx.read(dataBuffer, { type: 'buffer' });
            sheet = workbook.Sheets[workbook.SheetNames[0]];
            datos = xlsx.utils.sheet_to_json(sheet, { defval: '' });
        } else {
            return res.status(400).json({ error: 'No se proporcionó archivo ni URL de Google Sheets' });
        }

        if (!datos || datos.length === 0) {
            return res.status(400).json({ error: 'El archivo está vacío o no tiene datos' });
        }

        //------------------------------------------------------
        // DETECTAR RUBRO DESDE CELDA D1
        //------------------------------------------------------
        // El rubro está en la celda D1 de la planilla (un solo
        // valor para toda la planilla, no es una columna de datos).
        //------------------------------------------------------
        if (sheet) {
            const cellD1 = sheet['D1'];
            rubro = cellD1 ? String(cellD1.v || '').trim() : '';
        }
        console.log(`🏷️ Rubro (celda D1): "${rubro}"`);

        //------------------------------------------------------
        // DETECTAR COLUMNAS (case-insensitive)
        //------------------------------------------------------
        const headers = Object.keys(datos[0] || {});
        console.log(`📋 Encabezados: ${headers.join(', ')}`);

        const headersLower = headers.map(h => ({
            original: h,
            lower: h.toLowerCase().trim()
        }));

        const nombresValidos = [
            'nombre', 'nombres', 'name', 'cliente',
            'contacto', 'razon social', 'razón social'
        ];
        const numerosValidos = [
            'numero', 'número', 'numeros', 'números',
            'number', 'telefono', 'teléfono', 'phone',
            'whatsapp', 'celular', 'movil', 'móvil', 'cel'
        ];

        let colNombre = headersLower.find(h =>
            nombresValidos.includes(h.lower)
        )?.original || null;

        let colNumero = headersLower.find(h =>
            numerosValidos.includes(h.lower)
        )?.original || null;

        // Segundo intento: buscar por contención parcial
        if (!colNombre) {
            colNombre = headersLower.find(h =>
                h.lower.includes('nombre') || h.lower.includes('cliente')
            )?.original || null;
        }
        if (!colNumero) {
            colNumero = headersLower.find(h =>
                h.lower.includes('numero') || h.lower.includes('número') ||
                h.lower.includes('telefono') || h.lower.includes('teléfono') ||
                h.lower.includes('celular') || h.lower.includes('whatsapp')
            )?.original || null;
        }

        if (!colNombre) {
            return res.status(400).json({
                error: `No se encontró columna de nombres. Columnas detectadas: ${headers.join(', ')}. La columna debe llamarse NOMBRE, Cliente, o similar.`
            });
        }
        if (!colNumero) {
            return res.status(400).json({
                error: `No se encontró columna de números. Columnas detectadas: ${headers.join(', ')}. La columna debe llamarse NUMERO, Telefono, Celular, o similar.`
            });
        }

        console.log(`✅ Columnas: nombre="${colNombre}", numero="${colNumero}"`);

        //------------------------------------------------------
        // PROCESAR CONTACTOS
        //------------------------------------------------------
        const contactos = [];
        const vistos = new Set();
        let saltados = 0;
        let fijos = 0;

        // Prefijos conocidos de números FIJOS en Argentina
        const PREFIJOS_FIJOS = [
            '3514',
            '1154', '1153', '1152', '1151',
            '114', '113', '112', '111',
            '2614', '2615',
            '3414', '3415',
        ];

        function esProbablementeFijo(num) {
            let n = num;
            if (n.startsWith('549')) n = n.slice(3);
            else if (n.startsWith('54')) n = n.slice(2);
            if (n.startsWith('0')) n = n.slice(1);
            return PREFIJOS_FIJOS.some(p => n.startsWith(p));
        }

        for (const row of datos) {
            let nombre = String(row[colNombre] || '').trim();
            let numero = String(row[colNumero] || '').trim();

            if (!nombre) { saltados++; continue; }

            // FIX: descartar fila si el nombre ES el encabezado mismo
            if (nombre.toUpperCase() === colNombre.toUpperCase() ||
                ['NOMBRE', 'NOMBRES', 'NAME', 'CLIENTE', 'CONTACTO'].includes(nombre.toUpperCase())) {
                console.log(`⚠️ Fila de encabezado detectada y descartada: "${nombre}"`);
                saltados++;
                continue;
            }

            // Limpiar número
            numero = numero.replace(/\s/g, '').replace(/[^0-9]/g, '');
            if (!numero || numero.length < 8) { saltados++; continue; }

            if (vistos.has(numero)) { saltados++; continue; }

            // Filtrar números fijos
            if (esProbablementeFijo(numero)) {
                console.log(`📞 Número fijo descartado: ${nombre} (${numero})`);
                fijos++;
                saltados++;
                continue;
            }

            vistos.add(numero);

            contactos.push({
                // Se guardan ambas variantes de mayúscula/minúscula
                NOMBRE: nombre,
                NUMERO: numero,
                nombre: nombre,
                numero: numero,
                estadoEnvio: 'pendiente',
                fechaEnvio: null,
                respondioInfo: false
            });
        }

        console.log(`✅ Contactos válidos: ${contactos.length} (${saltados} saltados, ${fijos} fijos descartados)`);

        if (contactos.length === 0) {
            return res.status(400).json({
                error: `No se encontraron contactos válidos. ${saltados} filas descartadas (${fijos} números fijos).`
            });
        }

        //------------------------------------------------------
        // GUARDAR EN ESTADO
        //------------------------------------------------------
        const userSession = sessionManager.getUserSession(userId);
        if (!userSession) {
            return res.status(400).json({ error: 'No hay sesión de usuario activa' });
        }

        const instancia = userSession.instances.get(instanceId);
        if (!instancia) {
            return res.status(400).json({ error: 'Instancia no encontrada en memoria' });
        }

        let estado = instancia.estado || getDefaultEstado();
        estado.contactosCargados = contactos;
        estado.total = contactos.length;
        estado.actual = 0;
        estado.enviadosOk = 0;
        estado.fallidos = [];
        estado.rubro = rubro;
        estado.enviando = false;
        estado.pausado = false;
        estado.campanaFinalizada = false;
        estado.listo = instancia.listo || false;
        estado.numeroWhatsApp = instancia.numero || '';

        instancia.estado = estado;
        guardarEstado(estado, instanceId);
        guardarInstancia(userId, instanceId, instancia);

        console.log(`💾 Contactos guardados para instancia ${instanceId}`);

        res.json({
            success: true,
            total: contactos.length,
            saltados,
            fijos,
            rubro,
            columnas: { nombre: colNombre, numero: colNumero }
        });

    } catch (error) {
        console.error('❌ Error en /cargar:', error);

        let mensaje = error.message || 'Error al procesar el archivo';
        if (mensaje.includes('401')) {
            mensaje = 'Error 401: La hoja de Google Sheets no es pública. Cambiá los permisos a "Cualquiera con el enlace puede ver".';
        } else if (mensaje.includes('ENOTFOUND') || mensaje.includes('ECONNREFUSED')) {
            mensaje = 'Error de red: No se pudo conectar a Google Drive. Verificá tu conexión a internet.';
        }
        res.status(500).json({ error: mensaje });
    }
});

module.exports = router;