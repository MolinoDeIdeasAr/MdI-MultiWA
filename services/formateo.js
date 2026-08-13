'use strict';

//==============================================================
// MdI MultiWA
// services/formateo.js
//
// Utilidades de formateo de números, Spintax y escritura humana
//==============================================================


//==============================================================
// FORMATEAR NÚMERO WHATSAPP
//==============================================================
//
// ARGENTINA
//
// 0351 15 2512609
//       ↓
// 351 15 2512609
//       ↓
// 351 2512609
//       ↓
// 5493512512609
//
// IMPORTANTE:
// El "15" es un prefijo de marcación móvil LOCAL argentino.
// NO debe enviarse a WhatsApp como parte del número internacional.
//
// También acepta:
//
// 351152512609  → 5493512512609
// 3512512609    → 5493512512609
// 5493512512609 → 5493512512609
//
//==============================================================

function formatearNumeroWhatsApp(numero) {

    //----------------------------------------------------------
    // LIMPIAR TODO LO QUE NO SEA NÚMERO
    //----------------------------------------------------------

    let num = String(numero || '')
        .replace(/\D/g, '');

    if (!num || num.length < 8) {

        return null;

    }


    //----------------------------------------------------------
    // NÚMEROS INTERNACIONALES NO ARGENTINOS
    //----------------------------------------------------------

    const prefijosInternacionales = [

        '52',   // México
        '51',   // Perú
        '56',   // Chile
        '57',   // Colombia
        '58',   // Venezuela
        '1',    // USA / Canadá
        '34',   // España
        '55',   // Brasil
        '44',   // Reino Unido
        '33',   // Francia
        '39',   // Italia
        '49'    // Alemania

    ];

    if (

        prefijosInternacionales.some(

            prefijo =>

                num.startsWith(prefijo) &&

                num.length >= 10

        )

    ) {

        return num;

    }


    //----------------------------------------------------------
    // YA ESTÁ EN FORMATO ARGENTINO INTERNACIONAL
    //
    // 5493512512609
    //
    // No tocar.
    //----------------------------------------------------------

    if (num.startsWith('549')) {

        return num.length >= 13

            ? num

            : null;

    }


    //----------------------------------------------------------
    // QUITAR 0 DE LARGA DISTANCIA
    //
    // 0351...
    //   ↓
    // 351...
    //----------------------------------------------------------

    if (num.startsWith('0')) {

        num = num.substring(1);

    }


    //----------------------------------------------------------
    // CÓDIGOS DE ÁREA ARGENTINOS
    //----------------------------------------------------------
    //
    // Se utilizan para detectar correctamente el "15".
    //
    // Ejemplo Córdoba:
    //
    // 351152512609
    //    ││
    //    │└── 15 local
    //    └─── código de área
    //
    //----------------------------------------------------------

    const codigosAreaArgentina = [

        // Buenos Aires
        '11',

        // Códigos de 3 dígitos
        '220',
        '221',
        '223',
        '224',
        '225',
        '226',
        '227',
        '228',
        '229',

        '230',
        '231',
        '232',
        '233',
        '234',
        '235',
        '236',
        '237',
        '238',
        '239',

        '260',
        '261',
        '262',
        '263',
        '264',
        '265',
        '266',
        '267',

        '280',

        '290',
        '291',
        '292',
        '293',
        '294',
        '295',
        '296',
        '297',
        '298',
        '299',

        '336',

        '341',
        '342',
        '343',
        '344',
        '345',
        '346',
        '347',
        '348',
        '349',

        // Córdoba
        '351',
        '352',
        '353',
        '354',
        '355',
        '356',
        '357',
        '358',

        '362',
        '364',

        '370',
        '371',
        '372',
        '373',
        '374',
        '375',
        '376',
        '377',
        '378',

        '380',
        '381',
        '382',
        '383',
        '384',
        '385',
        '386',
        '387',
        '388'

    ];


    //----------------------------------------------------------
    // BUSCAR CÓDIGO DE ÁREA + 15
    //----------------------------------------------------------

    let codigoAreaEncontrado = null;

    for (

        const area of codigosAreaArgentina

    ) {

        const patron =

            area + '15';


        //------------------------------------------------------
        // Ejemplo:
        //
        // 351152512609
        // ^^^^^
        // 35115
        //------------------------------------------------------

        if (

            num.startsWith(patron) &&

            num.length >

                patron.length + 5

        ) {

            codigoAreaEncontrado = area;

            break;

        }

    }


    //----------------------------------------------------------
    // QUITAR EL 15
    //----------------------------------------------------------

    if (codigoAreaEncontrado) {

        num =

            codigoAreaEncontrado +

            num.substring(

                codigoAreaEncontrado.length + 2

            );

    }


    //----------------------------------------------------------
    // AGREGAR CÓDIGO DE PAÍS ARGENTINA
    //
    // 3512512609
    //      ↓
    // 543512512609
    //----------------------------------------------------------

    if (!num.startsWith('54')) {

        num = '54' + num;

    }


    //----------------------------------------------------------
    // CONVERTIR A FORMATO MÓVIL ARGENTINO
    //
    // 54 + 3512512609
    //       ↓
    // 5493512512609
    //----------------------------------------------------------

    if (

        num.startsWith('54') &&

        !num.startsWith('549') &&

        num.length > 4

    ) {

        num =

            '549' +

            num.substring(2);

    }


    //----------------------------------------------------------
    // VALIDACIÓN FINAL
    //----------------------------------------------------------

    if (num.length < 13) {

        return null;

    }

    return num;

}


//==============================================================
// PROCESAR SPINTAX
//==============================================================
//
// Ejemplo:
//
// Hola {amigo|cliente|comerciante}
//
// Se transforma aleatoriamente en:
//
// Hola amigo
// Hola cliente
// Hola comerciante
//
//==============================================================

function procesarSpintax(texto) {

    if (!texto) {

        return texto;

    }

    let resultado = texto;

    let iteraciones = 0;


    while (

        resultado.includes('{') &&

        resultado.includes('}') &&

        iteraciones < 10

    ) {

        resultado =

            resultado.replace(

                /{([^{}]+)}/g,

                (_, opcionesTexto) => {

                    const opciones =

                        opcionesTexto.split('|');

                    return opciones[

                        Math.floor(

                            Math.random() *

                            opciones.length

                        )

                    ];

                }

            );

        iteraciones++;

    }


    return resultado;

}


//==============================================================
// EXTRAER ID DE GOOGLE SHEETS
//==============================================================

function extraerIdGoogleSheets(url) {

    if (!url) {

        return null;

    }


    //----------------------------------------------------------
    // Formatos soportados:
    //
    // https://docs.google.com/spreadsheets/d/ID/edit
    //
    // https://docs.google.com/spreadsheets/d/ID/edit?usp=sharing
    //
    // https://docs.google.com/spreadsheets/d/ID
    //----------------------------------------------------------

    const match =

        String(url).match(

            /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/

        );


    return match

        ? match[1]

        : null;

}


//==============================================================
// TIEMPO DE ESCRITURA
//==============================================================

function getTiempoEscritura(mensaje) {

    const texto =

        String(mensaje || '');

    const base =

        texto.length *

        (40 + Math.random() * 30);


    return Math.min(

        Math.max(

            base,

            3000

        ),

        10000

    );

}


//==============================================================
// SIMULAR ESCRITURA HUMANA
//==============================================================
//
// No bloquea el envío si WhatsApp no permite obtener el chat
// o si sendStateTyping falla.
//
//==============================================================

async function simularEscrituraHumana(

    client,

    chatId,

    mensaje

) {

    const tiempoEspera =

        getTiempoEscritura(mensaje);


    try {

        //------------------------------------------------------
        // OBTENER CHAT CON TIMEOUT
        //------------------------------------------------------

        const chat =

            await Promise.race([

                client.getChatById(chatId),

                new Promise(

                    (_, reject) =>

                        setTimeout(

                            () =>

                                reject(

                                    new Error(

                                        'timeout'

                                    )

                                ),

                            3000

                        )

                )

            ]);


        //------------------------------------------------------
        // INDICADOR "ESCRIBIENDO..."
        //------------------------------------------------------

        if (

            chat &&

            typeof chat.sendStateTyping ===

                'function'

        ) {

            await chat.sendStateTyping();

            console.log(

                `⌨ Escritura simulada OK -> ${chatId}`

            );


            //--------------------------------------------------
            // ESPERAR COMO SI ESTUVIERA ESCRIBIENDO
            //--------------------------------------------------

            await new Promise(

                resolve =>

                    setTimeout(

                        resolve,

                        tiempoEspera

                    )

            );


            //--------------------------------------------------
            // LIMPIAR ESTADO
            //--------------------------------------------------

            try {

                if (

                    typeof chat.clearState ===

                        'function'

                ) {

                    await chat.clearState();

                }

            }

            catch (_) {}

        }

        else {

            console.warn(

                `⚠ Sin sendStateTyping disponible para ${chatId} — solo delay`

            );


            await new Promise(

                resolve =>

                    setTimeout(

                        resolve,

                        tiempoEspera

                    )

            );

        }

    }

    catch (err) {

        //------------------------------------------------------
        // IMPORTANTE:
        //
        // Un error en la simulación de escritura NO debe
        // impedir el envío del mensaje.
        //------------------------------------------------------

        console.warn(

            `⚠ simularEscrituraHumana falló para ${chatId}: ${err.message} — se continúa con el envío`

        );


        await new Promise(

            resolve =>

                setTimeout(

                    resolve,

                    Math.min(

                        tiempoEspera,

                        5000

                    )

                )

        );

    }

}


//==============================================================
// EXPORTS
//==============================================================

module.exports = {

    formatearNumeroWhatsApp,

    procesarSpintax,

    extraerIdGoogleSheets,

    simularEscrituraHumana

};