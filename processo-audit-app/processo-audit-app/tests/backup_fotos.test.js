// Backup das fotos de OS (scripts/backup_os_fotos.sh): cópia legível, rotação e nenhuma alteração na origem.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const script = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../scripts/backup_os_fotos.sh');
const novaPasta = () => fs.mkdtempSync(path.join(os.tmpdir(), 'backup-fotos-'));
const rodar = (origem, destino, ...extra) => spawnSync('bash', [script, destino, ...extra], { env: { ...process.env, FOTOS_DIR: origem }, encoding: 'utf8' });
const comFotos = () => {
  const origem = novaPasta();
  fs.mkdirSync(path.join(origem, 'sub'), { recursive: true });
  fs.writeFileSync(path.join(origem, 'a.jpg'), 'foto A');
  fs.writeFileSync(path.join(origem, 'sub', 'b.jpg'), 'foto B dentro de pasta');
  return origem;
};
const copias = (destino) => fs.readdirSync(destino).filter((f) => f.endsWith('.tar.gz')).sort();
const lista = (arquivo) => spawnSync('tar', ['-tzf', arquivo], { encoding: 'utf8' }).stdout.split('\n').filter(Boolean).map((l) => l.replace(/^\.\//, '')).filter((l) => l && !l.endsWith('/')).sort();

test('gera um .tar.gz legível com todas as fotos (inclusive em subpastas) e não mexe na origem', () => {
  const origem = comFotos(); const destino = path.join(novaPasta(), 'bk');
  const r = rodar(origem, destino);
  assert.equal(r.status, 0, r.stderr);
  const [arquivo] = copias(destino);
  assert.match(arquivo, /^os_fotos_\d{4}-\d{2}-\d{2}_\d{6}\.tar\.gz$/);
  assert.deepEqual(lista(path.join(destino, arquivo)), ['a.jpg', 'sub/b.jpg']);
  assert.equal(fs.readFileSync(path.join(origem, 'a.jpg'), 'utf8'), 'foto A'); // origem intacta
  assert.match(r.stdout, /Backup criado/);
  // restaurar de verdade: extrai noutro lugar e compara o conteúdo
  const volta = novaPasta();
  assert.equal(spawnSync('tar', ['-xzf', path.join(destino, arquivo), '-C', volta]).status, 0);
  assert.equal(fs.readFileSync(path.join(volta, 'sub', 'b.jpg'), 'utf8'), 'foto B dentro de pasta');
});

test('rotação: guarda só as N cópias mais recentes', async () => {
  const origem = comFotos(); const destino = path.join(novaPasta(), 'bk');
  fs.mkdirSync(destino, { recursive: true });
  for (const n of ['2026-01-01_000001', '2026-01-02_000001', '2026-01-03_000001']) fs.writeFileSync(path.join(destino, `os_fotos_${n}.tar.gz`), 'velho');
  const r = rodar(origem, destino, '2');
  assert.equal(r.status, 0, r.stderr);
  const restantes = copias(destino);
  assert.equal(restantes.length, 2);
  assert.ok(!restantes.includes('os_fotos_2026-01-01_000001.tar.gz'));
  assert.ok(!restantes.includes('os_fotos_2026-01-02_000001.tar.gz'));
  assert.ok(restantes.includes('os_fotos_2026-01-03_000001.tar.gz'));
  assert.ok(restantes.some((f) => !f.includes('2026-01')), 'a cópia nova ficou');
  assert.equal(copias(destino).filter((f) => f.endsWith('.parcial')).length, 0);
});

test('sem pasta de fotos ou com a pasta vazia: avisa, termina bem e não cria cópia', () => {
  const destino = path.join(novaPasta(), 'bk');
  const semPasta = rodar(path.join(novaPasta(), 'nao-existe'), destino);
  assert.equal(semPasta.status, 0);
  assert.match(semPasta.stdout, /nada a copiar/);
  const vazia = rodar(novaPasta(), destino);
  assert.equal(vazia.status, 0);
  assert.match(vazia.stdout, /vazia/);
  assert.ok(!fs.existsSync(destino) || copias(destino).length === 0);
});

test('quantidade de cópias inválida é recusada sem criar nada', () => {
  const origem = comFotos(); const destino = path.join(novaPasta(), 'bk');
  for (const ruim of ['0', 'abc', '-1', '1.5']) {
    const r = rodar(origem, destino, ruim);
    assert.notEqual(r.status, 0, `valor ${ruim}`);
  }
  assert.ok(!fs.existsSync(destino));
});

test('um backup interrompido não deixa arquivo parecendo completo (só ".parcial" que some sozinho)', () => {
  const origem = comFotos(); const destino = path.join(novaPasta(), 'bk');
  assert.equal(rodar(origem, destino).status, 0);
  assert.equal(fs.readdirSync(destino).filter((f) => f.endsWith('.parcial')).length, 0);
});
