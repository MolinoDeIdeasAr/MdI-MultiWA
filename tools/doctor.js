'use strict';

/**
 * =============================================================
 * MdI MultiWA
 * tools/doctor.js
 *
 * Doctor del Proyecto
 *
 * v1.0.0
 *
 * Diagnóstico completo del proyecto.
 * =============================================================
 */

const fs = require('fs');
const path = require('path');
const cp = require('child_process');

//==============================================================
// CONFIG
//==============================================================

const CONFIG = {

    extensiones: [

        '.js'

    ],

    ignorarDirectorios: new Set([

        'node_modules',

        '.git',

        '.vscode',

        '.idea',

        '.wwebjs_auth',

        '.wwebjs_cache',

        'chrome-profiles',

        'sessions',

        'uploads',

        'tmp',

        'images',

        'dist',

        'build'

    ]),

    ignorarArchivos: [

        '- copia',

        '.old',

        '.bak',

        '.backup'

    ],

    generarReporte: true,

    archivoReporte:

        'doctor-report.txt'

};

//==============================================================
// ESTADO GLOBAL
//==============================================================

const doctor = {

    inicio:

        new Date(),

    archivos: [],

    sintaxis: [],

    imports: [],

    exports: [],

    dependencias: [],

    duplicados: [],

    warnings: [],

    errores: [],

    estadisticas: {

        archivos:0,

        ok:0,

        error:0,

        warnings:0

    }

};

//==============================================================
// COLORES
//==============================================================

const COLOR = {

    RESET  : '\x1b[0m',

    ROJO   : '\x1b[31m',

    VERDE  : '\x1b[32m',

    AMARILLO:'\x1b[33m',

    AZUL   : '\x1b[36m',

    GRIS   : '\x1b[90m'

};

//==============================================================
// LOG
//==============================================================

function logInfo(texto){

    console.log(

        COLOR.AZUL +

        texto +

        COLOR.RESET

    );

}

function logOK(texto){

    console.log(

        COLOR.VERDE +

        texto +

        COLOR.RESET

    );

}

function logWarning(texto){

    console.log(

        COLOR.AMARILLO +

        texto +

        COLOR.RESET

    );

}

function logError(texto){

    console.log(

        COLOR.ROJO +

        texto +

        COLOR.RESET

    );

}

//==============================================================
// HEADER
//==============================================================

function imprimirHeader(){

    console.clear();

    console.log('');

    console.log('===================================================');

    console.log('              MdI MultiWA DOCTOR');

    console.log('===================================================');

    console.log('');

    console.log(

        'Proyecto :',

        process.cwd()

    );

    console.log(

        'Node     :',

        process.version

    );

    console.log(

        'Fecha    :',

        new Date().toLocaleString()

    );

    console.log('');

}

//==============================================================
// SCANNER
//==============================================================

function recorrerProyecto(){

    doctor.archivos=[];

    logInfo(

        '🔎 Escaneando proyecto...'

    );

    recorrerDirectorio(

        process.cwd()

    );

    doctor.estadisticas.archivos=

        doctor.archivos.length;

    logOK(

        `✔ ${doctor.archivos.length} archivos encontrados`

    );

}

//==============================================================
// RECORRER DIRECTORIO
//==============================================================

function recorrerDirectorio(

    directorio

){

    let contenido=[];

    try{

        contenido=

            fs.readdirSync(

                directorio,

                {

                    withFileTypes:true

                }

            );

    }

    catch(err){

        doctor.warnings.push({

            tipo:'DIRECTORIO',

            ruta:directorio,

            error:err.message

        });

        return;

    }

    for(const item of contenido){

        const rutaCompleta=

            path.join(

                directorio,

                item.name

            );

        //------------------------------------------------------
        // DIRECTORIOS
        //------------------------------------------------------

        if(item.isDirectory()){

            if(

                CONFIG.ignorarDirectorios.has(

                    item.name

                )

            ){

                continue;

            }

            recorrerDirectorio(

                rutaCompleta

            );

            continue;

        }

        //------------------------------------------------------
        // EXTENSIÓN
        //------------------------------------------------------

        const extension=

            path.extname(

                item.name

            ).toLowerCase();

        if(

            !CONFIG.extensiones.includes(

                extension

            )

        ){

            continue;

        }

        //------------------------------------------------------
        // ARCHIVOS IGNORADOS
        //------------------------------------------------------

        let ignorar=false;

        for(const patron of CONFIG.ignorarArchivos){

            if(

                item.name.includes(

                    patron

                )

            ){

                ignorar=true;

                break;

            }

        }

        if(

            ignorar

        ){

            continue;

        }

        //------------------------------------------------------
        // AGREGAR
        //------------------------------------------------------

        doctor.archivos.push({

            nombre:item.name,

            ruta:rutaCompleta,

            relativa:path.relative(

                process.cwd(),

                rutaCompleta

            ),

            extension,

            carpeta:path.dirname(

                rutaCompleta

            ),

            tamano:

                fs.statSync(

                    rutaCompleta

                ).size

        });

    }

}

//==============================================================
// BUSCAR ARCHIVO
//==============================================================

function buscarArchivo(

    relativa

){

    return doctor.archivos.find(

        a=>a.relativa===relativa

    );

}

//==============================================================
// OBTENER CONTENIDO
//==============================================================

function leerArchivo(

    archivo

){

    try{

        return fs.readFileSync(

            archivo.ruta,

            'utf8'

        );

    }

    catch(err){

        doctor.errores.push({

            tipo:'LECTURA',

            archivo:archivo.relativa,

            error:err.message

        });

        return '';

    }

}

//==============================================================
// SYNTAX CHECKER
//==============================================================

function verificarSintaxis(){

    logInfo(

        '\n🧠 Verificando sintaxis...\n'

    );

    doctor.sintaxis=[];

    for(const archivo of doctor.archivos){

        verificarArchivo(

            archivo

        );

    }

}

//==============================================================
// VERIFICAR ARCHIVO
//==============================================================

function verificarArchivo(

    archivo

){

    try{

        cp.execSync(

            `node --check "${archivo.ruta}"`,

            {

                stdio:'pipe',

                encoding:'utf8'

            }

        );

        doctor.sintaxis.push({

            archivo:archivo.relativa,

            ok:true,

            mensaje:''

        });

        doctor.estadisticas.ok++;

        logOK(

            `✔ ${archivo.relativa}`

        );

    }

    catch(err){

        const salida=

            obtenerMensajeError(

                err

            );

        doctor.sintaxis.push({

            archivo:archivo.relativa,

            ok:false,

            mensaje:salida

        });

        doctor.errores.push({

            tipo:'SINTAXIS',

            archivo:archivo.relativa,

            mensaje:salida

        });

        doctor.estadisticas.error++;

        logError(

            `✖ ${archivo.relativa}`

        );

        mostrarErrorSintaxis(

            salida

        );

    }

}

//==============================================================
// EXTRAER MENSAJE
//==============================================================

function obtenerMensajeError(

    err

){

    let salida='';

    if(

        err.stdout

    ){

        salida+=

            err.stdout.toString();

    }

    if(

        err.stderr

    ){

        salida+=

            err.stderr.toString();

    }

    if(

        !salida && err.message

    ){

        salida=

            err.message;

    }

    return salida.trim();

}

//==============================================================
// MOSTRAR ERROR
//==============================================================

function mostrarErrorSintaxis(

    texto

){

    if(

        !texto

    ){

        return;

    }

    const lineas=

        texto

        .split('\n')

        .slice(0,12);

    for(const linea of lineas){

        console.log(

            '   ',

            linea

        );

    }

    console.log('');

}

//==============================================================
// RESUMEN SINTAXIS
//==============================================================

function resumenSintaxis(){

    const ok=

        doctor.sintaxis.filter(

            x=>x.ok

        ).length;

    const error=

        doctor.sintaxis.length-ok;

    console.log('');

    console.log(

        '------------------------------------------'

    );

    console.log(

        `Sintaxis OK      : ${ok}`

    );

    console.log(

        `Sintaxis ERROR   : ${error}`

    );

    console.log(

        '------------------------------------------'

    );

    console.log('');

}

//==============================================================
// REQUIRE / IMPORT ANALYZER
//==============================================================

function analizarImports(){

    logInfo(

        '\n📦 Analizando imports...\n'

    );

    doctor.imports=[];

    for(const archivo of doctor.archivos){

        analizarArchivoImports(

            archivo

        );

    }

    logOK(

        `✔ ${doctor.imports.length} archivos analizados`

    );

}

//==============================================================
// ANALIZAR UN ARCHIVO
//==============================================================

function analizarArchivoImports(

    archivo

){

    const codigo=

        leerArchivo(

            archivo

        );

    const imports=[];

    //----------------------------------------------------------
    // require(...)
    //----------------------------------------------------------

    const regexRequire=

        /require\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g;

    let match;

    while(

        (match=regexRequire.exec(codigo))!==null

    ){

        imports.push({

            tipo:'require',

            modulo:match[1],

            linea:

                obtenerLinea(

                    codigo,

                    match.index

                )

        });

    }

    //----------------------------------------------------------
    // import ...
    //----------------------------------------------------------

    const regexImport=

        /import\s+.*?\s+from\s+['"`]([^'"`]+)['"`]/g;

    while(

        (match=regexImport.exec(codigo))!==null

    ){

        imports.push({

            tipo:'import',

            modulo:match[1],

            linea:

                obtenerLinea(

                    codigo,

                    match.index

                )

        });

    }

    //----------------------------------------------------------
    // import "..."
    //----------------------------------------------------------

    const regexImportSolo=

        /import\s+['"`]([^'"`]+)['"`]/g;

    while(

        (match=regexImportSolo.exec(codigo))!==null

    ){

        imports.push({

            tipo:'import',

            modulo:match[1],

            linea:

                obtenerLinea(

                    codigo,

                    match.index

                )

        });

    }

    //----------------------------------------------------------
    // GUARDAR
    //----------------------------------------------------------

    doctor.imports.push({

        archivo:

            archivo.relativa,

        imports

    });

}

//==============================================================
// OBTENER NÚMERO DE LÍNEA
//==============================================================

function obtenerLinea(

    codigo,

    indice

){

    return codigo

        .substring(

            0,

            indice

        )

        .split('\n')

        .length;

}

//==============================================================
// MOSTRAR IMPORTS
//==============================================================

function mostrarImports(){

    console.log('');

    console.log(

        '================ IMPORTS ================'

    );

    console.log('');

    for(const archivo of doctor.imports){

        console.log(

            archivo.archivo

        );

        if(

            archivo.imports.length===0

        ){

            console.log(

                '   (sin imports)'

            );

        }

        for(const imp of archivo.imports){

            console.log(

                `   ${imp.tipo} -> ${imp.modulo} (L${imp.linea})`

            );

        }

        console.log('');

    }

}

//==============================================================
// RESOLVER IMPORTS
//==============================================================

function resolverImports(){

    logInfo(

        '\n🔗 Resolviendo dependencias...\n'

    );

    doctor.dependencias=[];

    for(const archivo of doctor.imports){

        resolverArchivo(

            archivo

        );

    }

}

//==============================================================
// RESOLVER ARCHIVO
//==============================================================

function resolverArchivo(

    archivoImports

){

    const resultado={

        archivo:

            archivoImports.archivo,

        dependencias:[]

    };

    for(const imp of archivoImports.imports){

        resultado.dependencias.push(

            resolverModulo(

                archivoImports.archivo,

                imp

            )

        );

    }

    doctor.dependencias.push(

        resultado

    );

}

//==============================================================
// RESOLVER MÓDULO
//==============================================================

function resolverModulo(

    archivoOrigen,

    imp

){

    //----------------------------------------------------------
    // MÓDULOS NATIVOS
    //----------------------------------------------------------

    if(

        esModuloNativo(

            imp.modulo

        )

    ){

        return{

            ...imp,

            tipoModulo:'core',

            existe:true,

            ruta:null

        };

    }

    //----------------------------------------------------------
    // NODE_MODULES
    //----------------------------------------------------------

    if(

        !imp.modulo.startsWith('.')

    ){

        return{

            ...imp,

            tipoModulo:'externo',

            existe:true,

            ruta:null

        };

    }

    //----------------------------------------------------------
    // RUTA ABSOLUTA
    //----------------------------------------------------------

    const origen=

        path.dirname(

            path.join(

                process.cwd(),

                archivoOrigen

            )

        );

    let destino=

        path.resolve(

            origen,

            imp.modulo

        );

    //----------------------------------------------------------
    // EXTENSIONES
    //----------------------------------------------------------

    const candidatos=[

        destino,

        destino+'.js',

        path.join(

            destino,

            'index.js'

        )

    ];

    let encontrado=null;

    for(const candidato of candidatos){

        if(

            fs.existsSync(

                candidato

            )

        ){

            encontrado=candidato;

            break;

        }

    }

    //----------------------------------------------------------
    // ERROR
    //----------------------------------------------------------

    if(

        !encontrado

    ){

        doctor.errores.push({

            tipo:'IMPORT',

            archivo:archivoOrigen,

            modulo:imp.modulo,

            linea:imp.linea,

            mensaje:'Archivo inexistente'

        });

        logError(

            `❌ ${archivoOrigen}`

        );

        console.log(

            `   L${imp.linea} -> ${imp.modulo}`

        );

        return{

            ...imp,

            tipoModulo:'local',

            existe:false,

            ruta:null

        };

    }

    //----------------------------------------------------------
    // OK
    //----------------------------------------------------------

    return{

        ...imp,

        tipoModulo:'local',

        existe:true,

        ruta:path.relative(

            process.cwd(),

            encontrado

        )

    };

}

//==============================================================
// MODULOS NATIVOS
//==============================================================

function esModuloNativo(

    nombre

){

    return [

        'fs',

        'path',

        'http',

        'https',

        'url',

        'os',

        'crypto',

        'stream',

        'events',

        'util',

        'zlib',

        'buffer',

        'child_process',

        'net',

        'tls',

        'dns',

        'readline'

    ].includes(

        nombre

    );

}

//==============================================================
// RESUMEN DEPENDENCIAS
//==============================================================

function resumenDependencias(){

    let total=0;

    let faltantes=0;

    for(const archivo of doctor.dependencias){

        for(const dep of archivo.dependencias){

            total++;

            if(

                !dep.existe

            ){

                faltantes++;

            }

        }

    }

    console.log('');

    console.log(

        '------------------------------------------'

    );

    console.log(

        `Dependencias : ${total}`

    );

    console.log(

        `Faltantes    : ${faltantes}`

    );

    console.log(

        '------------------------------------------'

    );

    console.log('');

}

//==============================================================
// EXPORT ANALYZER
//==============================================================

function analizarExports(){

    logInfo(

        '\n📤 Analizando exports...\n'

    );

    doctor.exports=[];

    for(const archivo of doctor.archivos){

        analizarExportsArchivo(

            archivo

        );

    }

}

//==============================================================
// EXPORTS DE UN ARCHIVO
//==============================================================

function analizarExportsArchivo(

    archivo

){

    const codigo=

        leerArchivo(

            archivo

        );

    const resultado={

        archivo:archivo.relativa,

        exports:[]

    };

    //----------------------------------------------------------
    // module.exports = { ... }
    //----------------------------------------------------------

    const objeto=

        /module\.exports\s*=\s*\{([\s\S]*?)\}/m;

    const matchObjeto=

        codigo.match(

            objeto

        );

    if(matchObjeto){

        const cuerpo=

            matchObjeto[1];

        cuerpo

            .split(',')

            .forEach(item=>{

                const nombre=

                    item

                    .trim()

                    .replace(/\r/g,'')

                    .replace(/\n/g,'');

                if(

                    nombre.length

                ){

                    resultado.exports.push({

                        tipo:'module',

                        nombre

                    });

                }

            });

    }

    //----------------------------------------------------------
    // exports.xxx =
    //----------------------------------------------------------

    const regexExports=

        /exports\.([A-Za-z0-9_]+)\s*=/g;

    let match;

    while(

        (match=regexExports.exec(codigo))!==null

    ){

        resultado.exports.push({

            tipo:'exports',

            nombre:match[1]

        });

    }

    //----------------------------------------------------------
    // module.exports = funcion
    //----------------------------------------------------------

    const regexFuncion=

        /module\.exports\s*=\s*([A-Za-z0-9_]+)/g;

    while(

        (match=regexFuncion.exec(codigo))!==null

    ){

        if(

            match[1]!=='{'

        ){

            resultado.exports.push({

                tipo:'default',

                nombre:match[1]

            });

        }

    }

    //----------------------------------------------------------
    // export default
    //----------------------------------------------------------

    const regexDefault=

        /export\s+default\s+([A-Za-z0-9_]+)/g;

    while(

        (match=regexDefault.exec(codigo))!==null

    ){

        resultado.exports.push({

            tipo:'esm-default',

            nombre:match[1]

        });

    }

    //----------------------------------------------------------
    // export { a,b,c }
    //----------------------------------------------------------

    const regexNamed=

        /export\s*\{([\s\S]*?)\}/g;

    while(

        (match=regexNamed.exec(codigo))!==null

    ){

        match[1]

            .split(',')

            .forEach(item=>{

                const nombre=

                    item.trim();

                if(

                    nombre

                ){

                    resultado.exports.push({

                        tipo:'esm',

                        nombre

                    });

                }

            });

    }

    //----------------------------------------------------------
    // ELIMINAR DUPLICADOS
    //----------------------------------------------------------

    resultado.exports=[

        ...new Map(

            resultado.exports.map(

                e=>[e.nombre,e]

            )

        ).values()

    ];

    //----------------------------------------------------------
    // GUARDAR
    //----------------------------------------------------------

    doctor.exports.push(

        resultado

    );

}

//==============================================================
// MOSTRAR EXPORTS
//==============================================================

function mostrarExports(){

    console.log('');

    console.log(

        '================ EXPORTS ================'

    );

    console.log('');

    for(const archivo of doctor.exports){

        console.log(

            archivo.archivo

        );

        if(

            archivo.exports.length===0

        ){

            console.log(

                '   (sin exports)'

            );

        }

        for(const exp of archivo.exports){

            console.log(

                `   ${exp.nombre} (${exp.tipo})`

            );

        }

        console.log('');

    }

}

//==============================================================
// IMPORT vs EXPORT CHECKER
//==============================================================

function verificarImportsExports(){

    logInfo(

        '\n🔍 Verificando Imports vs Exports...\n'

    );

    doctor.compatibilidad=[];

    for(const archivo of doctor.dependencias){

        verificarArchivoCompatibilidad(

            archivo

        );

    }

}

//==============================================================
// VERIFICAR ARCHIVO
//==============================================================

function verificarArchivoCompatibilidad(

    archivo

){

    const resultado={

        archivo:archivo.archivo,

        modulos:[]

    };

    for(const dep of archivo.dependencias){

        //------------------------------------------------------
        // SOLO ARCHIVOS LOCALES
        //------------------------------------------------------

        if(

            dep.tipoModulo!=='local'

        ){

            continue;

        }

        if(

            !dep.existe

        ){

            continue;

        }

        //------------------------------------------------------
        // EXPORTS DEL DESTINO
        //------------------------------------------------------

        const exportsDestino=

            doctor.exports.find(

                e=>normalizarRuta(e.archivo)===

                   normalizarRuta(dep.ruta)

            );

        if(

            !exportsDestino

        ){

            doctor.warnings.push({

                tipo:'EXPORT',

                archivo:dep.ruta,

                mensaje:'No posee exports'

            });

            continue;

        }

        resultado.modulos.push({

            modulo:dep.modulo,

            ruta:dep.ruta,

            exports:

                exportsDestino.exports

                    .map(

                        x=>x.nombre

                    )

        });

    }

    doctor.compatibilidad.push(

        resultado

    );

}

//==============================================================
// NORMALIZAR RUTA
//==============================================================

function normalizarRuta(

    ruta

){

    return ruta

        .replace(/\\/g,'/')

        .replace(/^\.\//,'')

        .toLowerCase();

}

//==============================================================
// MOSTRAR COMPATIBILIDAD
//==============================================================

function mostrarCompatibilidad(){

    console.log('');

    console.log(

        '============= DEPENDENCIAS ============='

    );

    console.log('');

    for(const archivo of doctor.compatibilidad){

        console.log(

            archivo.archivo

        );

        if(

            archivo.modulos.length===0

        ){

            console.log(

                '   (sin dependencias locales)'

            );

            console.log('');

            continue;

        }

        for(const modulo of archivo.modulos){

            console.log(

                `   ${modulo.modulo}`

            );

            console.log(

                `      -> ${modulo.ruta}`

            );

            console.log(

                `      exports: ${

                    modulo.exports.join(', ')

                }`

            );

        }

        console.log('');

    }

}

//==============================================================
// ESTADÍSTICAS
//==============================================================

function resumenCompatibilidad(){

    let total=0;

    for(const archivo of doctor.compatibilidad){

        total+=

            archivo.modulos.length;

    }

    console.log('');

    console.log(

        '------------------------------------------'

    );

    console.log(

        `Módulos locales : ${total}`

    );

    console.log(

        '------------------------------------------'

    );

    console.log('');

}

//==============================================================
// IMPORTS DESESTRUCTURADOS
//==============================================================

function verificarDesestructurados(){

    logInfo(

        '\n🧩 Verificando imports desestructurados...\n'

    );

    for(const archivo of doctor.archivos){

        verificarDesestructuradoArchivo(

            archivo

        );

    }

}

//==============================================================
// ARCHIVO
//==============================================================

function verificarDesestructuradoArchivo(

    archivo

){

    const codigo=

        leerArchivo(

            archivo

        );

    //----------------------------------------------------------
    // const { ... } = require(...)
    //----------------------------------------------------------

    const regex=

        /const\s*\{([\s\S]*?)\}\s*=\s*require\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/gm;

    let match;

    while(

        (match=regex.exec(codigo))!==null

    ){

        const funciones=

            match[1]

                .split(',')

                .map(

                    x=>x.trim()

                )

                .filter(Boolean);

        const modulo=

            resolverRutaModulo(

                archivo,

                match[2]

            );

        if(

            !modulo

        ){

            continue;

        }

        verificarFuncionesImportadas(

            archivo.relativa,

            modulo,

            funciones

        );

    }

}

//==============================================================
// RESOLVER RUTA
//==============================================================

function resolverRutaModulo(

    archivo,

    modulo

){

    if(

        !modulo.startsWith('.')

    ){

        return null;

    }

    const base=

        path.dirname(

            archivo.ruta

        );

    const destino=

        path.resolve(

            base,

            modulo

        );

    const candidatos=[

        destino,

        destino+'.js',

        path.join(

            destino,

            'index.js'

        )

    ];

    for(const c of candidatos){

        if(

            fs.existsSync(c)

        ){

            return path.relative(

                process.cwd(),

                c

            );

        }

    }

    return null;

}

//==============================================================
// VERIFICAR FUNCIONES
//==============================================================

function verificarFuncionesImportadas(

    origen,

    destino,

    funciones

){

    const archivoExport=

        doctor.exports.find(

            e=>

                normalizarRuta(

                    e.archivo

                )===

                normalizarRuta(

                    destino

                )

        );

    if(

        !archivoExport

    ){

        return;

    }

    const disponibles=

        archivoExport.exports.map(

            e=>e.nombre

        );

    for(const funcion of funciones){

        if(

            disponibles.includes(

                funcion

            )

        ){

            continue;

        }

        doctor.errores.push({

            tipo:'EXPORT',

            archivo:origen,

            modulo:destino,

            funcion,

            mensaje:

                'Importa una función que no está exportada.'

        });

        doctor.estadisticas.error++;

        logError(

            `❌ ${origen}`

        );

        console.log(

            `   ${funcion}`

        );

        console.log(

            `   NO existe en ${destino}`

        );

        console.log('');

    }

}

//==============================================================
// RESUMEN
//==============================================================

function resumenExports(){

    const errores=

        doctor.errores.filter(

            e=>e.tipo==='EXPORT'

        ).length;

    console.log('');

    console.log(

        '------------------------------------------'

    );

    console.log(

        `Errores Imports/Exports : ${errores}`

    );

    console.log(

        '------------------------------------------'

    );

    console.log('');

}

//==============================================================
// PROJECT INSPECTOR
//==============================================================

function inspeccionarProyecto(){

    logInfo(

        '\n🩺 Inspeccionando proyecto...\n'

    );

    detectarDuplicados();

    detectarPendientes();

    detectarDependenciasCirculares();

}

//==============================================================
// TODO / FIXME / HACK
//==============================================================

function detectarPendientes(){

    const regex=

        /(TODO|FIXME|HACK)/gi;

    for(const archivo of doctor.archivos){

        const codigo=

            leerArchivo(

                archivo

            );

        let match;

        while(

            (match=regex.exec(codigo))!==null

        ){

            doctor.warnings.push({

                tipo:'PENDIENTE',

                archivo:

                    archivo.relativa,

                linea:

                    obtenerLinea(

                        codigo,

                        match.index

                    ),

                texto:

                    match[1]

            });

        }

    }

}

//==============================================================
// ARCHIVOS DUPLICADOS
//==============================================================

function detectarDuplicados(){

    const mapa=

        new Map();

    for(const archivo of doctor.archivos){

        const nombre=

            archivo.nombre

            .toLowerCase()

            .replace('- copia','')

            .replace('.old','')

            .replace('.bak','')

            .replace('.backup','');

        if(

            !mapa.has(

                nombre

            )

        ){

            mapa.set(

                nombre,

                []

            );

        }

        mapa.get(

            nombre

        ).push(

            archivo.relativa

        );

    }

    for(const [

        nombre,

        lista

    ] of mapa){

        if(

            lista.length<2

        ){

            continue;

        }

        doctor.duplicados.push({

            nombre,

            archivos:lista

        });

    }

}

//==============================================================
// DEPENDENCIAS CIRCULARES
//==============================================================

function detectarDependenciasCirculares(){

    const grafo=

        new Map();

    for(const archivo of doctor.dependencias){

        grafo.set(

            archivo.archivo,

            archivo.dependencias

                .filter(

                    d=>

                        d.tipoModulo==='local'

                        &&

                        d.existe

                )

                .map(

                    d=>d.ruta

                )

        );

    }

    const visitados=

        new Set();

    const stack=

        new Set();

    for(const nodo of grafo.keys()){

        recorrerNodo(

            nodo,

            grafo,

            visitados,

            stack

        );

    }

}

function recorrerNodo(

    nodo,

    grafo,

    visitados,

    stack

){

    if(

        stack.has(

            nodo

        )

    ){

        doctor.warnings.push({

            tipo:'CIRCULAR',

            archivo:nodo

        });

        return;

    }

    if(

        visitados.has(

            nodo

        )

    ){

        return;

    }

    visitados.add(

        nodo

    );

    stack.add(

        nodo

    );

    const hijos=

        grafo.get(

            nodo

        ) || [];

    for(const hijo of hijos){

        recorrerNodo(

            hijo,

            grafo,

            visitados,

            stack

        );

    }

    stack.delete(

        nodo

    );

}

//==============================================================
// REPORTE
//==============================================================

function generarReporte(){

    if(

        !CONFIG.generarReporte

    ){

        return;

    }

    const lineas=[];

    lineas.push(

        '========================================='

    );

    lineas.push(

        'MdI MultiWA Doctor'

    );

    lineas.push(

        '========================================='

    );

    lineas.push('');

    lineas.push(

        'Fecha: '+

        new Date()

        .toLocaleString()

    );

    lineas.push('');

    lineas.push(

        'Archivos analizados: '+

        doctor.estadisticas.archivos

    );

    lineas.push(

        'OK: '+

        doctor.estadisticas.ok

    );

    lineas.push(

        'Errores: '+

        doctor.estadisticas.error

    );

    lineas.push(

        'Warnings: '+

        doctor.warnings.length

    );

    lineas.push('');

    lineas.push(

        '=============== ERRORES ==============='

    );

    lineas.push('');

    for(const e of doctor.errores){

        lineas.push(

            JSON.stringify(

                e,

                null,

                2

            )

        );

        lineas.push('');

    }

    lineas.push(

        '============== WARNINGS ==============='

    );

    lineas.push('');

    for(const w of doctor.warnings){

        lineas.push(

            JSON.stringify(

                w,

                null,

                2

            )

        );

        lineas.push('');

    }

    fs.writeFileSync(

        CONFIG.archivoReporte,

        lineas.join('\n'),

        'utf8'

    );

    logOK(

        `📄 Reporte generado: ${CONFIG.archivoReporte}`

    );

}

//==============================================================
// DASHBOARD
//==============================================================

function imprimirResumen(){

    const tiempo =

        ((Date.now() -

        doctor.inicio.getTime()) / 1000)

        .toFixed(2);

    console.log('');
    console.log('======================================================');
    console.log('               MdI MultiWA DOCTOR');
    console.log('======================================================');
    console.log('');

    console.log(

        `Archivos analizados : ${doctor.estadisticas.archivos}`

    );

    console.log(

        `Sintaxis OK         : ${doctor.estadisticas.ok}`

    );

    console.log(

        `Errores             : ${doctor.errores.length}`

    );

    console.log(

        `Warnings            : ${doctor.warnings.length}`

    );

    console.log(

        `Duplicados          : ${doctor.duplicados.length}`

    );

    console.log(

        `Dependencias        : ${doctor.dependencias.length}`

    );

    console.log(

        `Tiempo              : ${tiempo}s`

    );

    console.log('');

    //----------------------------------------------------------
    // RESUMEN ERRORES
    //----------------------------------------------------------

    if(

        doctor.errores.length

    ){

        console.log(

            '--------------- ERRORES ----------------'

        );

        console.log('');

        doctor.errores.forEach(

            err=>{

                console.log(

                    `❌ ${err.tipo}`

                );

                if(err.archivo)

                    console.log(

                        `   Archivo : ${err.archivo}`

                    );

                if(err.linea)

                    console.log(

                        `   Línea   : ${err.linea}`

                    );

                if(err.modulo)

                    console.log(

                        `   Módulo  : ${err.modulo}`

                    );

                if(err.funcion)

                    console.log(

                        `   Función : ${err.funcion}`

                    );

                if(err.mensaje)

                    console.log(

                        `   ${err.mensaje}`

                    );

                console.log('');

            }

        );

    }

    //----------------------------------------------------------
    // WARNINGS
    //----------------------------------------------------------

    if(

        doctor.warnings.length

    ){

        console.log(

            '-------------- WARNINGS ----------------'

        );

        console.log('');

        doctor.warnings.forEach(

            w=>{

                console.log(

                    `⚠ ${w.tipo}`

                );

                if(w.archivo)

                    console.log(

                        `   ${w.archivo}`

                    );

                if(w.linea)

                    console.log(

                        `   Línea ${w.linea}`

                    );

                if(w.texto)

                    console.log(

                        `   ${w.texto}`

                    );

                console.log('');

            }

        );

    }

    console.log('======================================================');
    console.log('');

}

//==============================================================
// MAIN
//==============================================================

function main(){

    imprimirHeader();

    recorrerProyecto();

    verificarSintaxis();

    resumenSintaxis();

    analizarImports();

    resolverImports();

    resumenDependencias();

    analizarExports();

    verificarImportsExports();

    verificarDesestructurados();

    resumenExports();

    inspeccionarProyecto();

    generarReporte();

    imprimirResumen();

}

//==============================================================
// START
//==============================================================

try{

    main();

}

catch(err){

    console.error('');

    console.error('======================================');

    console.error('ERROR FATAL DEL DOCTOR');

    console.error('======================================');

    console.error(err);

    console.error('');

    process.exit(1);

}