/**
 * MdI MultiWA — scripts/migrar-sesiones.js v1.38.0
 * Ejecutar UNA SOLA VEZ: node scripts/migrar-sesiones.js
 * Separa archivos de Chrome de las credenciales de LocalAuth.
 */
'use strict';

const fs   = require('fs');
const path = require('path');

const SESSIONS_DIR    = path.join(__dirname, '..', 'sessions');
const CHROME_PROFILES = path.join(__dirname, '..', 'chrome-profiles');

if (!fs.existsSync(CHROME_PROFILES)) fs.mkdirSync(CHROME_PROFILES, { recursive: true });

const CHROME_ITEMS = [
    'Default','Local State','CrashPad','Crashpad','GPUPersistentCache',
    'GrShaderCache','ShaderCache','BrowserMetrics','Last Browser','Last Version',
    'DevToolsActivePort','ActorSafetyLists','FileTypePolicies',
    'FirstPartySetsPreloaded','HistorySearch','MEIPreload',
    'OnDeviceHeadSuggestModel','OriginTrials','PKIMetadata','Crowd Deny',
    'AmountExtractionHeuristicRegexes','CaptchaProviders',
    'CertificateRevocation','CronetDynamo','first_party_sets'
];

let migradas = 0;

const folders = fs.readdirSync(SESSIONS_DIR).filter(f =>
    f.startsWith('session-') &&
    fs.statSync(path.join(SESSIONS_DIR, f)).isDirectory()
);

console.log(`\n🔍 ${folders.length} sesión(es) encontradas\n`);

for (const folder of folders) {
    const instanceId  = folder.replace('session-', '');
    const sessionPath = path.join(SESSIONS_DIR, folder);
    const chromePath  = path.join(CHROME_PROFILES, instanceId);
    const contenido   = fs.readdirSync(sessionPath);

    const tieneChromeFiles = contenido.some(f =>
        CHROME_ITEMS.some(ci => f.startsWith(ci))
    );

    if (!tieneChromeFiles) {
        console.log(`✅ ${instanceId.slice(-8)} — limpia`);
        continue;
    }

    if (!fs.existsSync(chromePath)) fs.mkdirSync(chromePath, { recursive: true });
    console.log(`📦 Migrando ${instanceId.slice(-8)}...`);

    let movidos = 0;
    for (const item of contenido) {
        if (!CHROME_ITEMS.some(ci => item.startsWith(ci))) continue;
        try {
            const src = path.join(sessionPath, item);
            const dst = path.join(chromePath,  item);
            if (fs.existsSync(dst)) fs.rmSync(dst, { recursive: true, force: true });
            fs.renameSync(src, dst);
            movidos++;
        } catch (e) {
            console.warn(`   ⚠️ ${item}: ${e.message}`);
        }
    }
    console.log(`   ✅ ${movidos} elemento(s) → chrome-profiles/${instanceId.slice(-8)}`);
    migradas++;
}

console.log(`\n✅ Listo — ${migradas} sesión(es) migradas. Arrancá el servidor.\n`);
