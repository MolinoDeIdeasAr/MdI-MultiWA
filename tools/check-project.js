'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = process.cwd();

const IGNORAR = new Set([
    'node_modules',
    '.git',
    '.wwebjs_auth',
    '.wwebjs_cache',
    'chrome-profiles',
    'sessions',
    'uploads',
    'tmp',
    'images',
    'public',
    'dist',
    'build',
    '.vscode'
]);

function recorrer(dir) {

    const lista = fs.readdirSync(dir, { withFileTypes: true });

    for (const item of lista) {

        if (IGNORAR.has(item.name))
            continue;

        const full = path.join(dir, item.name);

        if (item.isDirectory()) {

            recorrer(full);
            continue;

        }

        if (!item.name.endsWith('.js'))
            continue;

        if (item.name.includes(' - copia'))
            continue;

        if (item.name.includes('(1)'))
            continue;

        try {

            execSync(`node --check "${full}"`, {
                stdio: 'pipe'
            });

            console.log(`✅ ${path.relative(ROOT, full)}`);

        }

        catch (e) {

            console.log('\n❌ ' + path.relative(ROOT, full));
            console.log(e.stdout.toString());

        }

    }

}

console.log('\n==============================');
console.log(' MdI MultiWA CHECK');
console.log('==============================\n');

recorrer(ROOT);

console.log('\n==============================');
console.log(' FIN');
console.log('==============================');