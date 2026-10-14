import express from 'express';
import pool from '../config/database.js';
import {
  processarAtivacao,
  processarPrimeiroPagamento,
  getConfig,
  saveConfig,
  criarEventoDesconto,
  buscarProximaFaturaPendente,
  simularDesconto,
  renegociarFaturaExistente,
  buscarClientePorCodigo,
  buscarProspectoPorId,
  buscarClientePorCPF,
  buscarProspectoPorCPF,
  listarCRMs,
  enviarParaCRM,
  criarProspecto,
  sincronizarLeads
} from '../services/referral/referralService.js';
import { verifyToken, checkRole } from '../middlewares/auth.js';
import { buscarPlano } from '../config/planos.js';
import { registrarAuditoria, diferencas, listarAuditoria, dadosRequisicao } from '../services/referral/auditoria.js';

const soDigitos = (v) => String(v || '').replace(/\D/g, '');
const cpfValido = (v) => {
  const d = soDigitos(v);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const dv = (n) => { let s = 0; for (let i = 0; i < n; i++) s += Number(d[i]) * (n + 1 - i); const r = 11 - (s % 11); return r >= 10 ? 0 : r; };
  return dv(9) === Number(d[9]) && dv(10) === Number(d[10]);
};

const router = express.Router();

// Histórico do lead: falha ao registrar não deve impedir a ação principal
async function registrarEvento(req, idIndicacao, tipo, descricao) {
  try {
    // req.ip respeita o `trust proxy`; o X-Forwarded-For cru podia ser forjado pelo próprio cliente
    const { ip, user_agent: userAgent } = dadosRequisicao(req);
    let nome = null;
    if (req.userId) {
      const [[u]] = await pool.execute('SELECT name FROM users WHERE id = ?', [req.userId]);
      nome = u?.name ?? null;
    }
    await pool.execute(
      'INSERT INTO indicacao_eventos (id_indicacao, tipo, descricao, usuario, usuario_nome, ip, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [idIndicacao, tipo, descricao, req.userEmail ?? null, nome, ip, userAgent]
    );
  } catch (err) {
    console.error('[Leads] Erro ao registrar evento:', err.message);
  }
}

// Toda chamada de webhook fica na auditoria (inclusive as recusadas e as sem efeito), com o IP de quem chamou
const auditarWebhook = (req, tipo, acao, resumo, { idIndicacao = null, resultado = null } = {}) =>
  registrarAuditoria({
    req, acao, origem: 'webhook_hubsoft', idIndicacao,
    resumo: `Webhook de ${tipo}: ${resumo}`,
    depois: { payload: req.body ?? null, query: Object.keys(req.query ?? {}).length ? { ...req.query, secret: req.query.secret ? '[oculto]' : undefined } : undefined, resultado },
  });

const resumoDesconto = (r) =>
  `desconto de R$ ${r.valorDesconto} aplicado na indicação #${r.indicacao.id} (${r.indicacao.nome_indicado ?? 'sem nome'}) — evento Hubsoft #${r.idEvento}${r.descontoAdiado ? ', adiado para a próxima fatura' : ''}`;

// --- ROTAS PÚBLICAS ---

// Verifica se o CPF é de um cliente e retorna seu código de indicação + serviços
router.post('/public/referrer-info', async (req, res) => {
  try {
    const { cpf } = req.body;
    if (!cpf) return res.status(400).json({ error: 'CPF é obrigatório' });

    const cliente = await buscarClientePorCPF(cpf);
    if (!cliente) {
      return res.status(404).json({ error: 'Cliente não encontrado com este CPF' });
    }

    const servicos = (cliente.servicos ?? []).map((s, i) => ({
      id_cliente_servico: s.id_cliente_servico,
      numero_plano: s.numero_plano ?? i + 1,
      nome: s.nome,
      valor: s.valor,
      status: s.status,
      status_prefixo: s.status_prefixo,
    }));

    return res.json({
      codigo_cliente: cliente.codigo_cliente,
      nome: cliente.nome_razaosocial || cliente.nome_fantasia || cliente.nome,
      servicos,
    });
  } catch (err) {
    console.error('[Referral Public] Erro ao buscar info do indicador:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// Busca as indicações feitas por um CPF (público)
router.get('/public/my-indications/:cpf', async (req, res) => {
  try {
    const { cpf } = req.params;
    if (!cpf) return res.status(400).json({ error: 'CPF é obrigatório' });

    // Primeiro busca o código do cliente para este CPF
    const cliente = await buscarClientePorCPF(cpf);
    if (!cliente) return res.status(404).json({ error: 'Cliente não encontrado' });

    const [rows] = await pool.execute(
      `SELECT nome_indicado, status, created_at, valor_desconto, fatura_referencia 
       FROM indicacoes 
       WHERE cod_cliente_indicador = ? 
       ORDER BY created_at DESC`,
      [cliente.codigo_cliente]
    );

    return res.json({
      indicador: cliente.nome_razaosocial || cliente.nome,
      indicacoes: rows
    });
  } catch (err) {
    console.error('[Referral Public] Erro ao buscar indicações:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// Registra uma nova indicação via portal público
router.post('/public/register-indication', async (req, res) => {
  try {
    const {
      referrer_code,
      id_cliente_servico,
      nome,
      cpf,
      telefone,
      endereco,
      numero,
      complemento,
      bairro,
      cidade,
      estado,
      email,
      plano_codigo
    } = req.body;

    if (!referrer_code || !nome || !cpf) {
      return res.status(400).json({ error: 'Código do indicador, nome e CPF são obrigatórios' });
    }

    // CNPJ não entra no fluxo de planos: atendimento comercial envia proposta
    if (soDigitos(cpf).length === 14) {
      return res.status(400).json({ error: 'Para empresas (CNPJ), entre em contato para receber uma proposta.' });
    }
    if (!cpfValido(cpf)) return res.status(400).json({ error: 'CPF inválido.' });

    const plano = plano_codigo ? buscarPlano(plano_codigo) : null;
    if (plano_codigo && !plano) return res.status(400).json({ error: 'Plano selecionado inválido.' });

    // 1. Validar se o indicador existe
    const indicador = await buscarClientePorCodigo(referrer_code);
    if (!indicador) return res.status(404).json({ error: 'Indicador não encontrado' });

    // 2. Validar o id_cliente_servico se informado (deve pertencer ao indicador)
    if (id_cliente_servico) {
      const servicos = indicador.servicos ?? [];
      const servicoValido = servicos.some(s => s.id_cliente_servico === Number(id_cliente_servico));
      if (!servicoValido) return res.status(400).json({ error: 'Plano selecionado não pertence a este cliente.' });
    }

    // 3. Validar se o CPF já é cliente ou prospecto no Hubsoft
    const [clienteExistente, prospectoExistente] = await Promise.all([
      buscarClientePorCPF(cpf),
      buscarProspectoPorCPF(cpf)
    ]);

    if (clienteExistente) return res.status(400).json({ error: 'Este CPF já é cliente da empresa.' });
    if (prospectoExistente) return res.status(400).json({ error: 'Este CPF já possui um cadastro de prospecto.' });

    // 4. Validar se já existe indicação no banco local
    const [indicacaoLocal] = await pool.execute(
      `SELECT id FROM indicacoes WHERE cpf_indicado = ? AND status != 'cancelado' LIMIT 1`,
      [cpf]
    );
    if (indicacaoLocal.length > 0) return res.status(400).json({ error: 'Este CPF já foi indicado em nosso sistema.' });

    // 5. Salvar no banco local (sem criar prospecto no Hubsoft — o plano é definido pelo vendedor)
    const [result] = await pool.execute(
      `INSERT INTO indicacoes (
        cod_cliente_indicador,
        nome_indicador,
        id_cliente_servico,
        id_prospecto_indicado,
        nome_indicado,
        cpf_indicado,
        telefone_indicado,
        endereco_indicado,
        plano_codigo,
        plano_nome,
        plano_velocidade,
        plano_valor,
        status
      ) VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, 'pendente')`,
      [
        indicador.codigo_cliente,
        indicador.nome_razaosocial,
        id_cliente_servico ? Number(id_cliente_servico) : null,
        nome,
        cpf,
        telefone,
        [endereco, numero, complemento].filter(Boolean).join(', ') + ` - ${bairro || ''}, ${cidade || ''}/${estado || ''}`,
        plano?.codigo ?? null,
        plano?.nome ?? null,
        plano ? `Contrate ${plano.contrate}, leve ${plano.leve} Mega` : null,
        plano?.valor ?? null
      ]
    );

    await registrarEvento(req, result.insertId, 'recebido', `Indicação recebida pelo portal público (indicador: ${indicador.nome_razaosocial})`);
    const [[nova]] = await pool.execute('SELECT * FROM indicacoes WHERE id = ?', [result.insertId]);
    await registrarAuditoria({
      req, acao: 'recebida', origem: 'portal_publico', idIndicacao: result.insertId,
      resumo: `${nome} indicado(a) por ${indicador.nome_razaosocial} (cód. ${indicador.codigo_cliente}) pelo portal público`,
      depois: { ...nova, email_informado: email ?? null },
    });

    return res.status(201).json({ ok: true, id: result.insertId });
  } catch (err) {
    console.error('[Referral Public] Erro ao registrar indicação:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// --- ROTAS PRIVADAS (EXISTENTES) ---

// Alterna pagou_primeiro_boleto de uma indicação
router.patch('/leads/:id/primeiro-boleto', verifyToken, async (req, res) => {
  try {
    const { pago } = req.body;
    const [[antes]] = await pool.execute('SELECT * FROM indicacoes WHERE id = ?', [req.params.id]);
    await pool.execute(
      'UPDATE indicacoes SET pagou_primeiro_boleto = ?, updated_at = NOW() WHERE id = ?',
      [pago ? 1 : 0, req.params.id]
    );
    if (antes) {
      const dif = diferencas(antes, { pagou_primeiro_boleto: pago ? 1 : 0 });
      if (dif.campos.length) {
        await registrarAuditoria({
          req, acao: 'editada', origem: 'painel', idIndicacao: antes.id,
          resumo: `1º boleto marcado como ${pago ? 'pago' : 'não pago'} — ${antes.nome_indicado ?? `indicação #${antes.id}`}`,
          antes: dif.antes, depois: dif.depois, campos: dif.campos,
        });
      }
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Lista todos os leads (indicações) e sincroniza pagamentos com HubSoft em background
router.get('/leads', verifyToken, async (req, res) => {
  try {
    const [rows] = await pool.execute(`SELECT * FROM indicacoes ORDER BY created_at DESC`);
    // Dispara sincronização sem bloquear a resposta
    sincronizarLeads(rows).catch(e => console.error('[sync leads]', e.message));
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Linha do tempo de um lead
router.get('/leads/:id/historico', verifyToken, async (req, res) => {
  try {
    const [[lead]] = await pool.execute('SELECT id, created_at, updated_at, status, id_crm_destino FROM indicacoes WHERE id = ?', [req.params.id]);
    if (!lead) return res.status(404).json({ error: 'Lead não encontrado' });

    const [eventos] = await pool.execute(
      'SELECT id, tipo, descricao, usuario, usuario_nome, ip, user_agent, created_at FROM indicacao_eventos WHERE id_indicacao = ? ORDER BY created_at ASC, id ASC',
      [req.params.id]
    );
    // Leads anteriores ao histórico não têm o evento de recebimento gravado
    if (!eventos.some(e => e.tipo === 'recebido')) {
      eventos.unshift({ id: 0, tipo: 'recebido', descricao: 'Indicação recebida', usuario: null, created_at: lead.created_at });
    }
    if (lead.status === 'encaminhado' && !eventos.some(e => e.tipo === 'enviado_crm')) {
      eventos.push({ id: 0, tipo: 'enviado_crm', descricao: `Atendente informou envio ao CRM — funil #${lead.id_crm_destino}`, usuario: null, created_at: lead.updated_at });
    }
    res.json(eventos);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Busca os CRMs do Hubsoft
router.get('/hubsoft/crms', verifyToken, async (req, res) => {
  try {
    const crms = await listarCRMs();
    res.json(crms);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Lista etapas de um CRM (armazenadas localmente)
router.get('/crm/:id_crm/etapas', verifyToken, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT * FROM crm_etapas WHERE id_crm = ? ORDER BY id_etapa ASC',
      [req.params.id_crm]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Adiciona uma etapa a um CRM
router.post('/crm/:id_crm/etapas', verifyToken, async (req, res) => {
  try {
    const { id_etapa, nome } = req.body;
    if (!id_etapa || !nome) return res.status(400).json({ error: 'id_etapa e nome são obrigatórios' });
    const [[antes]] = await pool.execute('SELECT * FROM crm_etapas WHERE id_crm = ? AND id_etapa = ?', [req.params.id_crm, id_etapa]);
    await pool.execute(
      'INSERT INTO crm_etapas (id_crm, id_etapa, nome) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE nome = VALUES(nome)',
      [req.params.id_crm, id_etapa, nome]
    );
    await registrarAuditoria({
      req, acao: 'etapa_crm_adicionada', origem: 'painel', entidade: 'crm_etapa',
      resumo: antes
        ? `Etapa ${id_etapa} do CRM #${req.params.id_crm} renomeada de "${antes.nome}" para "${nome}"`
        : `Etapa ${id_etapa} ("${nome}") adicionada ao CRM #${req.params.id_crm}`,
      antes: antes ?? null, depois: { id_crm: Number(req.params.id_crm), id_etapa, nome },
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Remove uma etapa de um CRM
router.delete('/crm/:id_crm/etapas/:id', verifyToken, async (req, res) => {
  try {
    const [[antes]] = await pool.execute('SELECT * FROM crm_etapas WHERE id = ? AND id_crm = ?', [req.params.id, req.params.id_crm]);
    await pool.execute('DELETE FROM crm_etapas WHERE id = ? AND id_crm = ?', [req.params.id, req.params.id_crm]);
    if (antes) {
      await registrarAuditoria({
        req, acao: 'etapa_crm_removida', origem: 'painel', entidade: 'crm_etapa',
        resumo: `Etapa ${antes.id_etapa} ("${antes.nome}") apagada do CRM #${antes.id_crm}`,
        antes,
      });
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Registra que o atendente enviou o lead ao CRM (a API do Hubsoft não permite criar cartões)
router.post('/leads/send-to-crm', verifyToken, async (req, res) => {
  try {
    const { id_indicacao, id_crm, nome_crm } = req.body;

    if (!id_indicacao || !id_crm) {
      return res.status(400).json({ error: 'id_indicacao e id_crm são obrigatórios' });
    }

    const [upd] = await pool.execute(
      "UPDATE indicacoes SET status = 'encaminhado', id_crm_destino = ?, updated_at = NOW() WHERE id = ? AND status = 'pendente'",
      [id_crm, id_indicacao]
    );

    if (upd.affectedRows > 0) {
      await registrarEvento(req, id_indicacao, 'enviado_crm', `Atendente informou envio ao CRM — funil ${nome_crm || `#${id_crm}`}`);
      await registrarAuditoria({
        req, acao: 'encaminhada_crm', origem: 'painel', idIndicacao: id_indicacao,
        resumo: `Indicação #${id_indicacao} enviada ao CRM — funil ${nome_crm || `#${id_crm}`}`,
        antes: { status: 'pendente' }, depois: { status: 'encaminhado', id_crm_destino: id_crm }, campos: ['status', 'id_crm_destino'],
      });
    }

    res.json({ ok: true, message: 'Envio ao CRM registrado' });
  } catch (err) {
    console.error('[Leads CRM] Erro:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.post('/webhook/ativacao', async (req, res) => {
  try {
    const secret = process.env.REFERRAL_WEBHOOK_SECRET;
    if (secret) {
      const provided = req.headers['x-webhook-secret'] ?? req.query.secret;
      if (provided !== secret) {
        await auditarWebhook(req, 'ativação', 'webhook_rejeitado', 'segredo inválido ou ausente');
        return res.status(401).json({ error: 'Webhook secret inválido' });
      }
    }

    const payload = req.body;
    const statusNovo = (
      payload.status_novo ?? payload.novo_status ?? payload.status ?? payload.dados?.status_novo ?? ''
    ).toLowerCase();

    const statusesValidos = ['ativo', 'habilitado', 'servico_habilitado'];
    if (!statusesValidos.includes(statusNovo)) {
      await auditarWebhook(req, 'ativação', 'webhook_ignorado', `status "${statusNovo}" ignorado`);
      return res.json({ ok: true, msg: `Status "${statusNovo}" ignorado — apenas ${statusesValidos.join(', ')} são processados` });
    }

    const codCliente = payload.codigo_cliente ?? payload.dados?.codigo_cliente ?? payload.cliente?.codigo_cliente;
    if (!codCliente) {
      await auditarWebhook(req, 'ativação', 'webhook_ignorado', 'payload sem codigo_cliente');
      return res.status(400).json({ error: 'codigo_cliente não encontrado no payload do webhook' });
    }

    const resultado = await processarAtivacao(Number(codCliente));
    if (!resultado) {
      await auditarWebhook(req, 'ativação', 'webhook_ignorado', `cliente ${codCliente} ativado, sem indicação pendente`);
      return res.json({ ok: true, msg: 'Nenhuma indicação pendente para este cliente' });
    }

    if (resultado.aguardandoPagamento) {
      await auditarWebhook(req, 'ativação', 'aguardando_pagamento',
        `cliente ${codCliente} ativado — indicação #${resultado.indicacao.id} (${resultado.indicacao.nome_indicado ?? 'sem nome'}) aguarda o 1º pagamento`,
        { idIndicacao: resultado.indicacao.id, resultado: { status: 'aguardando_pagamento' } });
      return res.json({
        ok: true,
        msg: 'Indicação marcada como aguardando primeiro pagamento',
        id_indicacao: resultado.indicacao.id,
      });
    }

    console.log(`[Indique e Ganhe] Desconto aplicado: indicação #${resultado.indicacao.id} | evento Hubsoft #${resultado.idEvento} | R$ ${resultado.valorDesconto}${resultado.descontoAdiado ? ' | ADIADO para a próxima fatura (a atual já existia)' : ''}`);
    await auditarWebhook(req, 'ativação', 'desconto_aplicado', `cliente ${codCliente} ativado — ${resumoDesconto(resultado)}`, {
      idIndicacao: resultado.indicacao.id,
      resultado: { status: 'ativo', id_evento_faturamento: resultado.idEvento, valor_desconto: resultado.valorDesconto, fatura_referencia: resultado.fatura_referencia, desconto_adiado: resultado.descontoAdiado },
    });
    return res.json({
      ok: true,
      msg: 'Desconto de indicação aplicado com sucesso',
      id_indicacao: resultado.indicacao.id,
      id_evento_faturamento: resultado.idEvento,
      valor_desconto: resultado.valorDesconto,
      desconto_adiado: resultado.descontoAdiado,
    });
  } catch (err) {
    console.error('[Indique e Ganhe] Erro no webhook:', err.message);
    await auditarWebhook(req, 'ativação', 'webhook_erro', err.message);
    return res.status(500).json({ error: err.message });
  }
});

router.post('/indicacao', verifyToken, async (req, res) => {
  try {
    const { cod_cliente_indicador, nome_indicador, id_cliente_servico, id_prospecto_indicado, nome_indicado, valor_desconto, regra_ativacao, tipo_recompensa } = req.body;

    if (!cod_cliente_indicador || !id_prospecto_indicado) {
      return res.status(400).json({ error: 'cod_cliente_indicador e id_prospecto_indicado são obrigatórios' });
    }

    const valorDesconto = valor_desconto != null ? parseFloat(valor_desconto) : null;
    if (valorDesconto !== null && (isNaN(valorDesconto) || valorDesconto <= 0)) {
      return res.status(400).json({ error: 'valor_desconto deve ser maior que zero' });
    }

    if (regra_ativacao != null && !['ativacao', 'primeira_fatura_paga'].includes(regra_ativacao)) {
      return res.status(400).json({ error: 'regra_ativacao inválida' });
    }

    if (tipo_recompensa != null && !['desconto_valor', 'remover_fatura'].includes(tipo_recompensa)) {
      return res.status(400).json({ error: 'tipo_recompensa inválido' });
    }

    // Busca o prospecto para obter nome e cod_cliente_indicado (se já virou cliente)
    const prospecto = await buscarProspectoPorId(id_prospecto_indicado);
    const nomeIndicado = nome_indicado ?? prospecto.nome_razaosocial ?? null;
    const codClienteIndicado = prospecto.cliente_encontrado?.codigo_cliente ?? null;

    const [result] = await pool.execute(
      `INSERT INTO indicacoes (cod_cliente_indicador, id_cliente_servico, nome_indicador, id_prospecto_indicado, cod_cliente_indicado, nome_indicado, valor_desconto, regra_ativacao, tipo_recompensa)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [cod_cliente_indicador, id_cliente_servico ?? null, nome_indicador ?? null, id_prospecto_indicado, codClienteIndicado, nomeIndicado, valorDesconto, regra_ativacao ?? null, tipo_recompensa ?? null]
    );

    const [[nova]] = await pool.execute('SELECT * FROM indicacoes WHERE id = ?', [result.insertId]);
    await registrarAuditoria({
      req, acao: 'criada', origem: 'painel', idIndicacao: result.insertId,
      resumo: `${nomeIndicado ?? `Prospecto #${id_prospecto_indicado}`} cadastrado(a) no painel como indicação de ${nome_indicador ?? `cliente ${cod_cliente_indicador}`}`,
      depois: nova,
    });

    // Se já é cliente, tenta processar a ativação imediatamente
    if (codClienteIndicado) {
      try {
        const r = await processarAtivacao(codClienteIndicado);
        if (r) {
          await registrarAuditoria({
            req, acao: r.aguardandoPagamento ? 'aguardando_pagamento' : 'desconto_aplicado', origem: 'painel', idIndicacao: r.indicacao.id,
            resumo: r.aguardandoPagamento
              ? `Indicado já era cliente ${codClienteIndicado}: indicação #${r.indicacao.id} aguarda o 1º pagamento`
              : `Indicado já era cliente ${codClienteIndicado}: ${resumoDesconto(r)}`,
            depois: r.aguardandoPagamento ? { status: 'aguardando_pagamento' } : { status: 'ativo', id_evento_faturamento: r.idEvento, valor_desconto: r.valorDesconto, fatura_referencia: r.fatura_referencia, desconto_adiado: r.descontoAdiado },
          });
        }
      } catch (err) {
        console.error('[Indique e Ganhe] Erro ao processar ativação imediata:', err.message);
        // Não falha a requisição, pois a indicação já foi salva como pendente
      }
    }

    return res.status(201).json({ ok: true, id: result.insertId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Este prospecto já foi indicado por outro cliente.' });
    }
    console.error('[Indique e Ganhe] Erro ao registrar indicação:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

router.get('/indicacoes', verifyToken, async (req, res) => {
  try {
    const { status } = req.query;
    let query = 'SELECT * FROM indicacoes';
    const params = [];
    if (status) { query += ' WHERE status = ?'; params.push(status); }
    query += ' ORDER BY created_at DESC';
    const [rows] = await pool.execute(query, params);
    return res.json({ indicacoes: rows, total: rows.length });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Busca atualizações no HubSoft para uma indicação específica (fallback manual para quando
// o webhook de pagamento do HubSoft não chega — ver sincronizarLeads em referralService.js).
router.post('/indicacao/:id/sincronizar', verifyToken, async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM indicacoes WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Indicação não encontrada' });

    await registrarAuditoria({
      req, acao: 'sincronizacao_manual', origem: 'painel', idIndicacao: rows[0].id,
      resumo: `Busca de atualizações no Hubsoft pedida para a indicação #${rows[0].id} (${rows[0].nome_indicado ?? 'sem nome'})`,
    });
    await sincronizarLeads(rows, { req });

    const [atualizado] = await pool.execute('SELECT * FROM indicacoes WHERE id = ?', [req.params.id]);
    return res.json({ ok: true, indicacao: atualizado[0] });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.delete('/indicacao/:id', verifyToken, async (req, res) => {
  try {
    const [[antes]] = await pool.execute('SELECT * FROM indicacoes WHERE id = ?', [req.params.id]);
    const [result] = await pool.execute(
      `UPDATE indicacoes SET status = 'cancelado', updated_at = NOW() WHERE id = ? AND status = 'pendente'`,
      [req.params.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Indicação não encontrada ou já processada' });
    await registrarAuditoria({
      req, acao: 'cancelada', origem: 'painel', idIndicacao: antes.id,
      resumo: `Indicação #${antes.id} (${antes.nome_indicado ?? 'sem nome'}, indicada por ${antes.nome_indicador ?? antes.cod_cliente_indicador}) cancelada`,
      antes: { status: antes.status }, depois: { status: 'cancelado' }, campos: ['status'],
    });
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Atualiza os dados de uma indicação
router.put('/indicacao/:id', verifyToken, async (req, res) => {
  try {
    const editaveis = [
      'cod_cliente_indicador', 'nome_indicador', 'id_prospecto_indicado', 'cod_cliente_indicado',
      'nome_indicado', 'valor_desconto', 'status', 'regra_ativacao', 'tipo_recompensa',
    ];
    const campos = [];
    const valores = [];

    for (const campo of editaveis) {
      if (req.body[campo] === undefined) continue;
      const valor = req.body[campo];

      if (campo === 'status' && !['pendente', 'aguardando_pagamento', 'ativo', 'cancelado', 'manual'].includes(valor)) {
        return res.status(400).json({ error: 'status inválido' });
      }
      if (campo === 'regra_ativacao' && valor != null && !['ativacao', 'primeira_fatura_paga'].includes(valor)) {
        return res.status(400).json({ error: 'regra_ativacao inválida' });
      }
      if (campo === 'tipo_recompensa' && valor != null && !['desconto_valor', 'remover_fatura'].includes(valor)) {
        return res.status(400).json({ error: 'tipo_recompensa inválido' });
      }
      if (campo === 'valor_desconto' && valor != null && (isNaN(parseFloat(valor)) || parseFloat(valor) <= 0)) {
        return res.status(400).json({ error: 'valor_desconto deve ser maior que zero' });
      }

      campos.push(`${campo} = ?`);
      valores.push(valor === '' ? null : valor);
    }

    if (campos.length === 0) return res.status(400).json({ error: 'Nenhum campo para atualizar' });

    const [[antes]] = await pool.execute('SELECT * FROM indicacoes WHERE id = ?', [req.params.id]);
    valores.push(req.params.id);
    const [result] = await pool.execute(
      `UPDATE indicacoes SET ${campos.join(', ')}, updated_at = NOW() WHERE id = ?`,
      valores
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Indicação não encontrada' });

    const [rows] = await pool.execute('SELECT * FROM indicacoes WHERE id = ?', [req.params.id]);
    const dif = diferencas(antes, rows[0], editaveis.filter(c => req.body[c] !== undefined));
    if (dif.campos.length) {
      await registrarAuditoria({
        req, acao: 'editada', origem: 'painel', idIndicacao: rows[0].id,
        resumo: `Indicação #${rows[0].id} (${rows[0].nome_indicado ?? 'sem nome'}) editada: ${dif.campos.join(', ')}`,
        antes: dif.antes, depois: dif.depois, campos: dif.campos,
      });
    }
    return res.json({ ok: true, indicacao: rows[0] });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Este prospecto já foi indicado por outro cliente.' });
    }
    return res.status(500).json({ error: err.message });
  }
});

// Remove permanentemente uma indicação
router.delete('/indicacoes/:id', verifyToken, async (req, res) => {
  try {
    const [[antes]] = await pool.execute('SELECT * FROM indicacoes WHERE id = ?', [req.params.id]);
    // o histórico do lead é apagado junto (FK em cascata): guarda uma cópia na auditoria
    const [historico] = antes
      ? await pool.execute('SELECT tipo, descricao, usuario, usuario_nome, ip, created_at FROM indicacao_eventos WHERE id_indicacao = ? ORDER BY id', [antes.id])
      : [[]];
    const [result] = await pool.execute('DELETE FROM indicacoes WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Indicação não encontrada' });
    await registrarAuditoria({
      req, acao: 'excluida', origem: 'painel', idIndicacao: antes.id,
      resumo: `Indicação #${antes.id} (${antes.nome_indicado ?? 'sem nome'}, indicada por ${antes.nome_indicador ?? antes.cod_cliente_indicador}, status ${antes.status}) apagada definitivamente`,
      antes: { ...antes, historico },
    });
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Busca prospecto por id_prospecto e retorna nome + dados básicos
router.get('/prospecto/:id', verifyToken, async (req, res) => {
  try {
    const prospecto = await buscarProspectoPorId(req.params.id);
    return res.json({
      id_prospecto: prospecto.id_prospecto,
      nome: prospecto.nome_razaosocial ?? '',
      cpf_cnpj: prospecto.cpf_cnpj ?? null,
      email: prospecto.email ?? null,
      telefone: prospecto.telefone ?? null,
      cod_cliente_indicado: prospecto.cliente_encontrado?.codigo_cliente ?? null,
      ja_e_cliente: !!prospecto.id_cliente,
    });
  } catch (err) {
    const status = err.message.includes('não encontrado') ? 404 : 502;
    return res.status(status).json({ error: err.message });
  }
});

// Busca cliente por codigo_cliente e retorna nome + serviços
router.get('/cliente/:cod', verifyToken, async (req, res) => {
  try {
    const cliente = await buscarClientePorCodigo(req.params.cod);

    const servicos = (cliente.servicos ?? []).map(s => ({
      id_cliente_servico: s.id_cliente_servico,
      nome: s.nome,
      valor: s.valor,
      status: s.status,
      status_prefixo: s.status_prefixo,
      carne: s.carne,
      tipo_cobranca: s.tipo_cobranca,
    }));

    return res.json({
      id_cliente: cliente.id_cliente,
      codigo_cliente: cliente.codigo_cliente,
      nome: cliente.nome_razaosocial ?? cliente.nome_fantasia ?? '',
      servicos,
    });
  } catch (err) {
    const status = err.message.includes('não encontrado') ? 404 : 502;
    return res.status(status).json({ error: err.message });
  }
});

// Prévia do que aplicarDesconto()/desconto-manual faria — não escreve nada no Hubsoft nem no
// banco local. Usado pelo botão "Simular" no painel antes de confirmar um lançamento real.
router.post('/simular-desconto', verifyToken, async (req, res) => {
  try {
    const { cod_cliente, id_cliente_servico, tipo_recompensa, valor, mes_processar, ano_processar } = req.body;

    if (!cod_cliente) return res.status(400).json({ error: 'cod_cliente é obrigatório' });
    if (!id_cliente_servico) return res.status(400).json({ error: 'id_cliente_servico é obrigatório' });

    const preview = await simularDesconto({
      cod_cliente,
      id_cliente_servico,
      tipo_recompensa,
      valor: valor != null ? parseFloat(valor) : undefined,
      mes_processar: mes_processar != null ? Number(mes_processar) : undefined,
      ano_processar: ano_processar != null ? Number(ano_processar) : undefined,
    });

    return res.json(preview);
  } catch (err) {
    console.error('[Simular Desconto]', err.message);
    const status = err.message.includes('não encontrado') ? 404 : 400;
    return res.status(status).json({ error: err.message });
  }
});

router.post('/desconto-manual', verifyToken, async (req, res) => {
  try {
    const { cod_cliente, id_cliente_servico, valor, descricao, mes_processar, ano_processar, tipo_recompensa, id_fatura_alvo } = req.body;

    if (!cod_cliente) return res.status(400).json({ error: 'cod_cliente é obrigatório' });
    if (!id_cliente_servico) return res.status(400).json({ error: 'id_cliente_servico é obrigatório' });

    const config = await getConfig();
    const valorFinal = valor != null ? parseFloat(valor) : config.desconto_valor;
    if (isNaN(valorFinal) || valorFinal <= 0) return res.status(400).json({ error: 'valor inválido' });

    const cliente = await buscarClientePorCodigo(cod_cliente);
    const servico = (cliente.servicos ?? []).find(s => s.id_cliente_servico === Number(id_cliente_servico));

    // Alvo é uma fatura já emitida — evento_faturamento não consegue mudar o valor dela, só
    // renegociação consegue (ver simularDesconto()/renegociarFaturaExistente()).
    if (id_fatura_alvo) {
      const tipoFinal = tipo_recompensa === 'remover_fatura' ? 'remover_fatura' : 'desconto_valor';

      const resultado = await renegociarFaturaExistente({
        id_fatura: Number(id_fatura_alvo),
        id_cliente_servico: Number(id_cliente_servico),
        tipo_recompensa: tipoFinal,
        valor: valorFinal,
        descricao: descricao || 'Indique e Ganhe — desconto manual (renegociação)',
      });

      const [insRenegociacao] = await pool.execute(
        `INSERT INTO indicacoes (cod_cliente_indicador, nome_indicador, cod_cliente_indicado, status, valor_desconto, fatura_referencia, desconto_adiado, data_vencimento)
         VALUES (?, ?, NULL, 'manual', ?, ?, 0, ?)`,
        [
          cliente.codigo_cliente, cliente.nome_razaosocial, valorFinal,
          `Renegociação — fatura #${resultado.nova_fatura?.id_fatura ?? id_fatura_alvo}`,
          resultado.nova_fatura?.data_vencimento ?? null,
        ]
      );
      await registrarAuditoria({
        req, acao: 'desconto_manual', origem: 'painel', idIndicacao: insRenegociacao.insertId,
        resumo: `${tipoFinal === 'remover_fatura' ? 'Fatura removida' : `Desconto de R$ ${valorFinal}`} por renegociação da fatura #${id_fatura_alvo} — ${cliente.nome_razaosocial} (cód. ${cliente.codigo_cliente})`,
        depois: { cod_cliente, id_cliente_servico, tipo_recompensa: tipoFinal, valor: valorFinal, descricao: descricao ?? null, id_fatura_alvo, nova_fatura: resultado.nova_fatura ?? null },
      });

      return res.json({
        ok: true,
        mecanismo: 'renegociacao',
        cliente: { codigo_cliente: cliente.codigo_cliente, nome: cliente.nome_razaosocial },
        valor: valorFinal,
        desconto_adiado: false,
        fatura_referencia: `Renegociação — fatura #${resultado.nova_fatura?.id_fatura ?? id_fatura_alvo}`,
        ...resultado,
      });
    }

    const alvoManual = mes_processar != null && ano_processar != null;
    // Só faz sentido checar "adiado" no modo automático — no modo manual o operador já viu a
    // simulação e escolheu o alvo de propósito (ver simularDesconto()).
    let descontoAdiado = false;
    let faturaEmAberto = null;
    if (!alvoManual) {
      faturaEmAberto = await buscarProximaFaturaPendente(Number(id_cliente_servico));
      descontoAdiado = !!faturaEmAberto;
    }

    const { id_evento_faturamento, fatura_referencia, data_faturamento, data_vencimento } = await criarEventoDesconto({
      id_cliente_servico: Number(id_cliente_servico),
      servico: servico ?? {},
      valor: valorFinal,
      descricao: (descricao || 'Desconto manual — Indique e Ganhe')
        + (descontoAdiado ? ` (fatura em aberto vence ${faturaEmAberto.data_vencimento} e não é afetada — vale a partir da próxima)` : ''),
      mes_processar,
      ano_processar,
    });

    const [insManual] = await pool.execute(
      `INSERT INTO indicacoes (cod_cliente_indicador, nome_indicador, cod_cliente_indicado, status, valor_desconto, id_evento_faturamento, fatura_referencia, desconto_adiado, data_faturamento, data_vencimento)
       VALUES (?, ?, NULL, 'manual', ?, ?, ?, ?, ?, ?)`,
      [cliente.codigo_cliente, cliente.nome_razaosocial, valorFinal, id_evento_faturamento, fatura_referencia, descontoAdiado ? 1 : 0, data_faturamento, data_vencimento]
    );
    await registrarAuditoria({
      req, acao: 'desconto_manual', origem: 'painel', idIndicacao: insManual.insertId,
      resumo: `Desconto manual de R$ ${valorFinal} para ${cliente.nome_razaosocial} (cód. ${cliente.codigo_cliente}) — fatura ${fatura_referencia ?? '?'}${descontoAdiado ? ', adiado para a próxima' : ''} (evento Hubsoft #${id_evento_faturamento})`,
      depois: { cod_cliente, id_cliente_servico, valor: valorFinal, descricao: descricao ?? null, mes_processar: mes_processar ?? null, ano_processar: ano_processar ?? null, id_evento_faturamento, fatura_referencia, desconto_adiado: descontoAdiado, data_faturamento, data_vencimento },
    });

    return res.json({
      ok: true,
      cliente: { codigo_cliente: cliente.codigo_cliente, nome: cliente.nome_razaosocial },
      id_evento_faturamento,
      fatura_referencia,
      desconto_adiado: descontoAdiado,
      data_faturamento,
      data_vencimento,
      valor: valorFinal,
    });
  } catch (err) {
    console.error('[Desconto Manual]', err.message);
    const status = err.message.includes('não encontrado') ? 404 : 500;
    return res.status(status).json({ error: err.message });
  }
});

router.get('/config', verifyToken, async (req, res) => {
  try { res.json(await getConfig()); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/config', verifyToken, async (req, res) => {
  try {
    const updates = {};

    if (req.body.desconto_valor !== undefined) {
      const valor = parseFloat(req.body.desconto_valor);
      if (isNaN(valor) || valor <= 0) return res.status(400).json({ error: 'desconto_valor deve ser maior que zero' });
      updates.desconto_valor = valor;
    }

    if (req.body.regra_ativacao !== undefined) {
      const validos = ['ativacao', 'primeira_fatura_paga'];
      if (!validos.includes(req.body.regra_ativacao)) {
        return res.status(400).json({ error: 'regra_ativacao inválida' });
      }
      updates.regra_ativacao = req.body.regra_ativacao;
    }

    if (req.body.tipo_recompensa !== undefined) {
      const validos = ['desconto_valor', 'remover_fatura'];
      if (!validos.includes(req.body.tipo_recompensa)) {
        return res.status(400).json({ error: 'tipo_recompensa inválido' });
      }
      updates.tipo_recompensa = req.body.tipo_recompensa;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'Nenhum campo para atualizar' });
    }

    const antes = await getConfig();
    await saveConfig(updates);
    const dif = diferencas(antes, updates);
    if (dif.campos.length) {
      await registrarAuditoria({
        req, acao: 'config_alterada', origem: 'painel', entidade: 'config',
        resumo: `Configuração do Indique e Ganhe alterada: ${dif.campos.map(c => `${c} ${dif.antes[c] ?? '—'} → ${dif.depois[c] ?? '—'}`).join('; ')}`,
        antes: dif.antes, depois: dif.depois, campos: dif.campos,
      });
    }
    res.json({ ok: true, ...updates });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Auditoria do módulo (quem fez o quê, de onde veio, IP). Só admin e gerente: mostra IPs e dados apagados.
router.get('/auditoria', verifyToken, checkRole(['admin', 'manager']), async (req, res) => {
  try {
    res.json(await listarAuditoria(req.query));
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE') {
      return res.status(503).json({ error: 'Auditoria ainda não instalada: rode scripts/migrate_indicacoes_auditoria.js' });
    }
    res.status(500).json({ error: err.message });
  }
});

// Webhook triggered when a referred client pays their first invoice.
// Only applies the referral discount when the rule is 'primeira_fatura_paga'.
router.post('/webhook/pagamento', async (req, res) => {
  try {
    const secret = process.env.REFERRAL_WEBHOOK_SECRET;
    if (secret) {
      const provided = req.headers['x-webhook-secret'] ?? req.query.secret;
      if (provided !== secret) {
        await auditarWebhook(req, 'pagamento', 'webhook_rejeitado', 'segredo inválido ou ausente');
        return res.status(401).json({ error: 'Webhook secret inválido' });
      }
    }

    const payload = req.body;
    const codCliente = payload.codigo_cliente ?? payload.dados?.codigo_cliente ?? payload.cliente?.codigo_cliente;
    if (!codCliente) {
      await auditarWebhook(req, 'pagamento', 'webhook_ignorado', 'payload sem codigo_cliente');
      return res.status(400).json({ error: 'codigo_cliente não encontrado no payload do webhook' });
    }

    const dataPagamento = payload.data_pagamento ?? payload.dados?.data_pagamento ?? new Date().toISOString().slice(0, 10);

    const resultado = await processarPrimeiroPagamento(Number(codCliente));
    if (!resultado) {
      // Marca pagamento mesmo sem indicação em aguardando_pagamento (ex: fluxo ativacao direta)
      const [afetadas] = await pool.execute(
        'SELECT id, nome_indicado FROM indicacoes WHERE cod_cliente_indicado = ? AND pagou_primeiro_boleto = 0',
        [codCliente]
      );
      await pool.execute(
        `UPDATE indicacoes SET pagou_primeiro_boleto = 1, data_pagamento_primeiro_boleto = ?, updated_at = NOW()
         WHERE cod_cliente_indicado = ? AND pagou_primeiro_boleto = 0`,
        [dataPagamento, codCliente]
      );
      if (afetadas.length === 0) {
        await auditarWebhook(req, 'pagamento', 'webhook_ignorado', `pagamento do cliente ${codCliente} sem indicação a atualizar`);
      }
      for (const a of afetadas) {
        await auditarWebhook(req, 'pagamento', 'pagamento_registrado',
          `1º pagamento do cliente ${codCliente} em ${dataPagamento} — indicação #${a.id} (${a.nome_indicado ?? 'sem nome'})`,
          { idIndicacao: a.id, resultado: { pagou_primeiro_boleto: 1, data_pagamento_primeiro_boleto: dataPagamento } });
      }
      return res.json({ ok: true, msg: 'Pagamento registrado' });
    }

    await pool.execute(
      `UPDATE indicacoes SET pagou_primeiro_boleto = 1, data_pagamento_primeiro_boleto = ?, updated_at = NOW() WHERE id = ?`,
      [dataPagamento, resultado.indicacao.id]
    );

    console.log(`[Indique e Ganhe] Desconto aplicado (1ª fatura paga): indicação #${resultado.indicacao.id} | evento Hubsoft #${resultado.idEvento} | R$ ${resultado.valorDesconto}${resultado.descontoAdiado ? ' | ADIADO para a próxima fatura (a atual já existia)' : ''}`);
    await auditarWebhook(req, 'pagamento', 'desconto_aplicado', `1º pagamento do cliente ${codCliente} em ${dataPagamento} — ${resumoDesconto(resultado)}`, {
      idIndicacao: resultado.indicacao.id,
      resultado: { status: 'ativo', pagou_primeiro_boleto: 1, data_pagamento_primeiro_boleto: dataPagamento, id_evento_faturamento: resultado.idEvento, valor_desconto: resultado.valorDesconto, fatura_referencia: resultado.fatura_referencia, desconto_adiado: resultado.descontoAdiado },
    });
    return res.json({
      ok: true,
      msg: 'Desconto de indicação aplicado após primeiro pagamento',
      id_indicacao: resultado.indicacao.id,
      id_evento_faturamento: resultado.idEvento,
      valor_desconto: resultado.valorDesconto,
      desconto_adiado: resultado.descontoAdiado,
    });
  } catch (err) {
    console.error('[Indique e Ganhe] Erro no webhook de pagamento:', err.message);
    await auditarWebhook(req, 'pagamento', 'webhook_erro', err.message);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
