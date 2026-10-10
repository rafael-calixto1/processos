import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { REGRAS_FECHAMENTO } from '../config/regrasFechamento.js';
import { ServiceError, assertAcessoOS, lockOS } from './estoqueService.js';

/**
 * Fotos de serviço (fachadas, casas, clientes): ficam em um diretório PRIVADO, fora de `uploads/` (que o servidor
 * entrega como estático para qualquer um) e com nome aleatório. Só saem por rota autenticada, com checagem da OS.
 */
const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const diretorioFotos = () => path.resolve(process.env.FOTOS_DIR || path.join(raiz, 'storage', 'os_fotos'));

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const uuidValido = (v) => typeof v === 'string' && UUID.test(v);

/** Reconhece o formato pelos primeiros bytes (o tipo informado pelo cliente não vale). */
export const detectarImagem = (buf) => {
  if (!Buffer.isBuffer(buf) || buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { mime: 'image/jpeg', ext: '.jpg' };
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { mime: 'image/png', ext: '.png' };
  if (buf.subarray(4, 8).toString('latin1') === 'ftyp' && /^(heic|heix|hevc|mif1|msf1)/.test(buf.subarray(8, 12).toString('latin1'))) return { mime: 'heic' };
  return null;
};

const num = (v, lim) => {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(String(v).replace(',', '.'));
  if (!Number.isFinite(n) || Math.abs(n) > lim) throw new ServiceError(400, 'Coordenada da foto inválida');
  return n;
};
export const quando = (v) => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) || d > new Date(Date.now() + 5 * 60 * 1000) ? null : d;
};

export const metadados = (f) => ({
  id: f.id, client_uuid: f.client_uuid, mime: f.mime, tamanho: f.tamanho, legenda: f.legenda,
  tirada_em: f.tirada_em, lat: f.lat === null ? null : Number(f.lat), lng: f.lng === null ? null : Number(f.lng), criado_em: f.criado_em,
});

/**
 * Grava a foto (arquivo + linha) numa transação já aberta. `criados` recebe os caminhos gravados em disco, para o chamador
 * apagá-los se a transação falhar depois. Reenviar o mesmo client_uuid devolve a foto existente.
 */
export const salvarFotoNaTx = async (conn, { os_id, buffer, client_uuid, legenda, tirada_em, lat, lng }, actor, criados = []) => {
  if (!uuidValido(client_uuid)) throw new ServiceError(400, 'Informe o client_uuid da foto (UUID)');
  if (!buffer?.length) throw new ServiceError(400, 'Envie a foto no campo "foto"');
  const tipo = detectarImagem(buffer);
  if (tipo?.mime === 'heic') throw new ServiceError(400, 'Formato HEIC não é aceito: o app deve enviar a foto em JPEG');
  if (!tipo) throw new ServiceError(400, 'Arquivo inválido: envie uma foto JPEG ou PNG');
  if (buffer.length > REGRAS_FECHAMENTO.foto_max_bytes) throw new ServiceError(413, 'A foto é grande demais (máximo de 8 MB)');

  const os = await lockOS(conn, os_id);
  assertAcessoOS(os, actor);
  if (!['aberta', 'em_andamento'].includes(os.status)) throw new ServiceError(409, 'OS encerrada: não aceita novas fotos');

  const [[ja]] = await conn.query('SELECT * FROM os_fotos WHERE client_uuid = ?', [client_uuid]);
  if (ja) {
    if (ja.os_id !== os.id || ja.criado_por !== actor.id) throw new ServiceError(409, 'Este identificador de foto já foi usado em outra OS');
    return { ...metadados(ja), repetida: true };
  }
  const [[{ n }]] = await conn.query('SELECT COUNT(*) AS n FROM os_fotos WHERE os_id = ?', [os.id]);
  if (n >= REGRAS_FECHAMENTO.fotos_max) throw new ServiceError(400, `Limite de ${REGRAS_FECHAMENTO.fotos_max} fotos por OS atingido`);

  const dir = diretorioFotos();
  await fs.mkdir(dir, { recursive: true, mode: 0o700 });
  const arquivo = `${randomUUID()}${tipo.ext}`;
  await fs.writeFile(path.join(dir, arquivo), buffer, { flag: 'wx', mode: 0o600 });
  criados.push(path.join(dir, arquivo));

  const [res] = await conn.query(
    `INSERT INTO os_fotos (os_id, arquivo, mime, tamanho, legenda, tirada_em, lat, lng, client_uuid, criado_por)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [os.id, arquivo, tipo.mime, buffer.length, legenda ? String(legenda).trim().slice(0, 255) || null : null,
      quando(tirada_em), num(lat, 90), num(lng, 180), client_uuid, actor.id]);
  const [[f]] = await conn.query('SELECT * FROM os_fotos WHERE id = ?', [res.insertId]);
  return metadados(f);
};

export const caminhoDaFoto = (foto) => path.join(diretorioFotos(), path.basename(foto.arquivo));

export const apagarArquivos = (caminhos) => Promise.all(caminhos.map((c) => fs.rm(c, { force: true }).catch(() => {})));
