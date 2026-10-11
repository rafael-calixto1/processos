// Roda os testes de integração do app contra o backend REAL, sempre no banco de teste:
//   1. recria o schema e os dados básicos de `processo_audit_test`;
//   2. sobe `node server.js` (porta 5998, pasta de fotos temporária);
//   3. roda `jest tests/integracao`;
//   4. encerra o servidor pelo PID e apaga a pasta temporária.
// Nunca toca em `processo_audit`: DB_NAME é escrito explicitamente em todo processo filho.
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const mobile = path.resolve(aqui, '..');
const raiz = path.resolve(mobile, '..');
const PORTA = process.env.PORTA_TESTE || '5998';
const DB_TESTE = 'processo_audit_test';

if (process.env.DB_NAME && process.env.DB_NAME !== DB_TESTE) {
  console.error(`Recusado: DB_NAME=${process.env.DB_NAME}. Estes testes só usam ${DB_TESTE}.`);
  process.exit(2);
}
const ambiente = { ...process.env, DB_NAME: DB_TESTE, PORT: PORTA };

const preparar = spawnSync(process.execPath, ['scripts/teste_mobile.js', 'preparar'], { cwd: raiz, env: ambiente, encoding: 'utf8' });
if (preparar.status !== 0) { console.error(preparar.stdout, preparar.stderr); process.exit(preparar.status ?? 1); }
const semeadura = JSON.parse(preparar.stdout.trim().split('\n').filter((l) => l.startsWith('{')).pop());

const fotosDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fotos-integracao-'));
const logPath = path.join(fotosDir, 'servidor.log');
const log = fs.openSync(logPath, 'a');
const servidor = spawn(process.execPath, ['server.js'], { cwd: raiz, env: { ...ambiente, FOTOS_DIR: path.join(fotosDir, 'fotos') }, stdio: ['ignore', log, log] });
let encerrado = false;
const encerrar = () => { if (!encerrado) { encerrado = true; servidor.kill('SIGTERM'); } };
process.on('exit', encerrar);
process.on('SIGINT', () => { encerrar(); process.exit(130); });

const esperarServidor = async () => {
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch(`http://localhost:${PORTA}/api/health`); if (r.ok) return; } catch { /* ainda subindo */ }
    if (servidor.exitCode !== null) throw new Error(`O servidor encerrou ao subir. Veja ${logPath}`);
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`O servidor não respondeu a tempo. Veja ${logPath}`);
};

let codigo = 1;
try {
  await esperarServidor();
  const jest = spawnSync('npx', ['jest', 'tests/integracao', '--forceExit', ...process.argv.slice(2)], {
    cwd: mobile, stdio: 'inherit',
    env: {
      ...ambiente, API_URL: `http://localhost:${PORTA}/api`, RAIZ_BACKEND: raiz, FOTOS_DIR: path.join(fotosDir, 'fotos'),
      API_SENHA: semeadura.senha, API_EMAIL: semeadura.usuarios.joao, API_ADMIN_EMAIL: semeadura.usuarios.admin,
      SEMENTE: JSON.stringify(semeadura),
    },
  });
  codigo = jest.status ?? 1;
} catch (e) {
  console.error(String(e));
} finally {
  encerrar();
  await new Promise((r) => setTimeout(r, 300));
  if (codigo !== 0) console.error(`(log do servidor de teste preservado em ${logPath})`);
  else fs.rmSync(fotosDir, { recursive: true, force: true });
}
process.exit(codigo);
