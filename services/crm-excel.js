const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const pathCRM = path.join(__dirname, '..', 'CRM_MdI.xlsx');

function actualizarCRM(contacto, analisisIA, mensajeCliente) {
    try {
        let workbook, datos = [];
        
        if (fs.existsSync(pathCRM)) {
            workbook = XLSX.readFile(pathCRM);
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            datos = XLSX.utils.sheet_to_json(worksheet);
        } else {
            workbook = XLSX.utils.book_new();
        }
        
        const numeroBuscado = contacto.NUMERO.replace(/\D/g, '');
        let filaIndex = datos.findIndex(d => 
            String(d.WhatsApp || '').replace(/\D/g, '') === numeroBuscado
        );
        
        const ahora = new Date();
        const fechaHoy = ahora.toISOString().split('T')[0];
        const proximaFecha = new Date(ahora);
        proximaFecha.setDate(proximaFecha.getDate() + (analisisIA.proxima_accion_dias || 7));
        
        if (filaIndex >= 0) {
            const fila = datos[filaIndex];
            fila.Estado = analisisIA.estado || fila.Estado;
            fila.Ultimo_contacto = fechaHoy;
            fila.Proxima_accion_fecha = proximaFecha.toISOString().split('T')[0];
            fila.Proxima_accion_tipo = analisisIA.proxima_accion_tipo || 'mensaje_followup';
            fila.Proxima_accion_texto = analisisIA.respuesta_sugerida || '';
            fila.Intentos_realizados = (fila.Intentos_realizados || 0) + 1;
            fila.Respuesta_recibida = mensajeCliente;
            fila.Motivo_cierre = analisisIA.motivo_cierre || '';
            fila.Notas_internas = `Sentimiento: ${analisisIA.sentimiento}, Intención: ${analisisIA.intencion}`;
            
            datos[filaIndex] = fila;
        } else {
            datos.push({
                ID: String(datos.length + 1).padStart(3, '0'),
                Nombre: contacto.NOMBRE || 'Desconocido',
                Empresa: contacto.NOMBRE || '',
                Rubro: '',
                WhatsApp: contacto.NUMERO,
                Estado: analisisIA.estado || 'nuevo',
                Subestado: '',
                Ultimo_contacto: fechaHoy,
                Proxima_accion_fecha: proximaFecha.toISOString().split('T')[0],
                Proxima_accion_tipo: analisisIA.proxima_accion_tipo || 'mensaje_followup',
                Proxima_accion_texto: analisisIA.respuesta_sugerida || '',
                Intentos_realizados: 1,
                Max_intentos: 3,
                Ultimo_mensaje_enviado: '',
                Respuesta_recibida: mensajeCliente,
                Motivo_cierre: analisisIA.motivo_cierre || '',
                Notas_internas: `Sentimiento: ${analisisIA.sentimiento}, Intención: ${analisisIA.intencion}`
            });
        }
        
        const nuevaWorksheet = XLSX.utils.json_to_sheet(datos);
        XLSX.utils.book_append_sheet(workbook, nuevaWorksheet, 'CRM', true);
        XLSX.writeFile(workbook, pathCRM);
        console.log(`💾 CRM guardado`);
        
    } catch (error) {
        console.error('❌ Error actualizando CRM:', error.message);
    }
}

module.exports = { actualizarCRM, pathCRM };