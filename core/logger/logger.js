'use strict';

//==============================================================
// LOGGER CENTRAL
//==============================================================

const util = require('util');

//==============================================================
// CONFIGURACIÓN
//==============================================================

const DEBUG = true;

//==============================================================
// COLORES ANSI
//==============================================================

const COLORS = {

    reset  : '\x1b[0m',

    gray   : '\x1b[90m',

    red    : '\x1b[31m',

    green  : '\x1b[32m',

    yellow : '\x1b[33m',

    blue   : '\x1b[34m',

    cyan   : '\x1b[36m',

    magenta: '\x1b[35m',

    white  : '\x1b[37m'

};

//==============================================================
// LOGGER
//==============================================================

class Logger {

    //----------------------------------------------------------
    // HORA
    //----------------------------------------------------------

    hora() {

        return new Date()

            .toLocaleTimeString(

                'es-AR',

                {

                    hour12: false

                }

            );

    }

    //----------------------------------------------------------
    // LOG INTERNO
    //----------------------------------------------------------

    log(

        color,
        categoria,
        mensaje,
        ...extra

    ) {

        const hora = this.hora();

        const cabecera =

            `${COLORS.gray}[${hora}]${COLORS.reset} ` +

            `${color}[${categoria}]${COLORS.reset}`;

        if (extra.length > 0) {

            console.log(

                cabecera,

                mensaje,

                ...extra.map(x =>

                    typeof x === 'string'

                        ? x

                        : util.inspect(

                            x,

                            {

                                colors: true,

                                depth: null,

                                compact: false

                            }

                        )

                )

            );

        }

        else {

            console.log(

                cabecera,

                mensaje

            );

        }

    }

    //----------------------------------------------------------
    // DEBUG INTERNO
    //----------------------------------------------------------

    debugLog(

        color,
        categoria,
        mensaje,
        ...extra

    ) {

        if (!DEBUG)
            return;

        this.log(

            color,

            categoria,

            mensaje,

            ...extra

        );

    }

    //----------------------------------------------------------
    // INFO
    //----------------------------------------------------------

    info(

        mensaje,

        ...extra

    ) {

        this.log(

            COLORS.green,

            'INFO',

            mensaje,

            ...extra

        );

    }

    //----------------------------------------------------------
    // WARN
    //----------------------------------------------------------

    warn(

        mensaje,

        ...extra

    ) {

        this.log(

            COLORS.yellow,

            'WARN',

            mensaje,

            ...extra

        );

    }

    //----------------------------------------------------------
    // ERROR
    //----------------------------------------------------------

    error(

        mensaje,

        ...extra

    ) {

        this.log(

            COLORS.red,

            'ERROR',

            mensaje,

            ...extra

        );

    }

    //----------------------------------------------------------
    // DEBUG
    //----------------------------------------------------------

    debug(

        mensaje,

        ...extra

    ) {

        this.debugLog(

            COLORS.gray,

            'DEBUG',

            mensaje,

            ...extra

        );

    }

    //----------------------------------------------------------
    // AI
    //----------------------------------------------------------

    ai(

        mensaje,

        ...extra

    ) {

        this.log(

            COLORS.cyan,

            'AI',

            mensaje,

            ...extra

        );

    }

    //----------------------------------------------------------
    // CRM
    //----------------------------------------------------------

    crm(

        mensaje,

        ...extra

    ) {

        this.log(

            COLORS.magenta,

            'CRM',

            mensaje,

            ...extra

        );

    }

    //----------------------------------------------------------
    // WHATSAPP
    //----------------------------------------------------------

    whatsapp(

        mensaje,

        ...extra

    ) {

        this.log(

            COLORS.blue,

            'WA',

            mensaje,

            ...extra

        );

    }

    //----------------------------------------------------------
    // STATE
    //----------------------------------------------------------

    state(

        mensaje,

        ...extra

    ) {

        this.log(

            COLORS.white,

            'STATE',

            mensaje,

            ...extra

        );

    }

}

//==============================================================
// EXPORTS
//==============================================================

module.exports = new Logger();