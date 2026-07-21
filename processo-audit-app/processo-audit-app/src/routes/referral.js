import express from 'express';
import pool from '../config/database.js';
import {
  processarAtivacao,
  processarPrimeiroPagamento,
  getConfig,
  saveConfig,
  criarEventoDesconto,
  buscarClientePorCodigo,
  buscarProspectoPorId,
  buscarClientePorCPF,
  buscarProspectoPorCPF,
  listarCRMs,
  enviarParaCRM,
  criarProspecto,
  sincronizarLeads
} from '../services/referral/referralService.js';
import { verifyToken } from '../middlewares/auth.js';

const router = express.Router();

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
      email
    } = req.body;

    if (!referrer_code || !nome || !cpf) {
      return res.status(400).json({ error: 'Código do indicador, nome e CPF são obrigatórios' });
    }

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
        status
      ) VALUES (?, ?, ?, NULL, ?, ?, ?, ?, 'pendente')`,
      [
        indicador.codigo_cliente,
        indicador.nome_razaosocial,
        id_cliente_servico ? Number(id_cliente_servico) : null,
        nome,
        cpf,
        telefone,
        [endereco, numero, complemento].filter(Boolean).join(', ') + ` - ${bairro || ''}, ${cidade || ''}/${estado || ''}`
      ]
    );

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
    await pool.execute(
      'UPDATE indicacoes SET pagou_primeiro_boleto = ?, updated_at = NOW() WHERE id = ?',
      [pago ? 1 : 0, req.params.id]
    );
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
    await pool.execute(
      'INSERT INTO crm_etapas (id_crm, id_etapa, nome) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE nome = VALUES(nome)',
      [req.params.id_crm, id_etapa, nome]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Remove uma etapa de um CRM
router.delete('/crm/:id_crm/etapas/:id', verifyToken, async (req, res) => {
  try {
    await pool.execute('DELETE FROM crm_etapas WHERE id = ? AND id_crm = ?', [req.params.id, req.params.id_crm]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Envia um lead para o CRM do Hubsoft
router.post('/leads/send-to-crm', verifyToken, async (req, res) => {
  try {
    const { id_indicacao, id_crm } = req.body;

    if (!id_indicacao || !id_crm) {
      return res.status(400).json({ error: 'id_indicacao e id_crm são obrigatórios' });
    }

    await pool.execute(
      "UPDATE indicacoes SET status = 'encaminhado', id_crm_destino = ?, updated_at = NOW() WHERE id = ? AND status = 'pendente'",
      [id_crm, id_indicacao]
    );

    res.json({ ok: true, message: 'Lead marcado como enviado para o CRM' });
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
      if (provided !== secret) return res.status(401).json({ error: 'Webhook secret inválido' });
    }

    const payload = req.body;
    const statusNovo = (
      payload.status_novo ?? payload.novo_status ?? payload.status ?? payload.dados?.status_novo ?? ''
    ).toLowerCase();

    const statusesValidos = ['ativo', 'habilitado', 'servico_habilitado'];
    if (!statusesValidos.includes(statusNovo)) {
      return res.json({ ok: true, msg: `Status "${statusNovo}" ignorado — apenas ${statusesValidos.join(', ')} são processados` });
    }

    const codCliente = payload.codigo_cliente ?? payload.dados?.codigo_cliente ?? payload.cliente?.codigo_cliente;
    if (!codCliente) return res.status(400).json({ error: 'codigo_cliente não encontrado no payload do webhook' });

    const resultado = await processarAtivacao(Number(codCliente));
    if (!resultado) return res.json({ ok: true, msg: 'Nenhuma indicação pendente para este cliente' });

    if (resultado.aguardandoPagamento) {
      return res.json({
        ok: true,
        msg: 'Indicação marcada como aguardando primeiro pagamento',
        id_indicacao: resultado.indicacao.id,
      });
    }

    console.log(`[Indique e Ganhe] Desconto aplicado: indicação #${resultado.indicacao.id} | evento Hubsoft #${resultado.idEvento} | R$ ${resultado.valorDesconto}`);
    return res.json({
      ok: true,
      msg: 'Desconto de indicação aplicado com sucesso',
      id_indicacao: resultado.indicacao.id,
      id_evento_faturamento: resultado.idEvento,
      valor_desconto: resultado.valorDesconto,
    });
  } catch (err) {
    console.error('[Indique e Ganhe] Erro no webhook:', err.message);
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

    // Se já é cliente, tenta processar a ativação imediatamente
    if (codClienteIndicado) {
      try {
        await processarAtivacao(codClienteIndicado);
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

    await sincronizarLeads(rows);

    const [atualizado] = await pool.execute('SELECT * FROM indicacoes WHERE id = ?', [req.params.id]);
    return res.json({ ok: true, indicacao: atualizado[0] });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.delete('/indicacao/:id', verifyToken, async (req, res) => {
  try {
    const [result] = await pool.execute(
      `UPDATE indicacoes SET status = 'cancelado', updated_at = NOW() WHERE id = ? AND status = 'pendente'`,
      [req.params.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Indicação não encontrada ou já processada' });
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

    valores.push(req.params.id);
    const [result] = await pool.execute(
      `UPDATE indicacoes SET ${campos.join(', ')}, updated_at = NOW() WHERE id = ?`,
      valores
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Indicação não encontrada' });

    const [rows] = await pool.execute('SELECT * FROM indicacoes WHERE id = ?', [req.params.id]);
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
    const [result] = await pool.execute('DELETE FROM indicacoes WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Indicação não encontrada' });
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

router.post('/desconto-manual', verifyToken, async (req, res) => {
  try {
    const { cod_cliente, id_cliente_servico, valor, descricao } = req.body;

    if (!cod_cliente) return res.status(400).json({ error: 'cod_cliente é obrigatório' });
    if (!id_cliente_servico) return res.status(400).json({ error: 'id_cliente_servico é obrigatório' });

    const config = await getConfig();
    const valorFinal = valor != null ? parseFloat(valor) : config.desconto_valor;
    if (isNaN(valorFinal) || valorFinal <= 0) return res.status(400).json({ error: 'valor inválido' });

    const cliente = await buscarClientePorCodigo(cod_cliente);
    const servico = (cliente.servicos ?? []).find(s => s.id_cliente_servico === Number(id_cliente_servico));

    const { id_evento_faturamento, fatura_referencia, data_faturamento, data_vencimento } = await criarEventoDesconto({
      id_cliente_servico: Number(id_cliente_servico),
      servico: servico ?? {},
      valor: valorFinal,
      descricao: descricao || 'Desconto manual — Indique e Ganhe',
    });

    await pool.execute(
      `INSERT INTO indicacoes (cod_cliente_indicador, nome_indicador, cod_cliente_indicado, status, valor_desconto, id_evento_faturamento, fatura_referencia, data_faturamento, data_vencimento)
       VALUES (?, ?, NULL, 'manual', ?, ?, ?, ?, ?)`,
      [cliente.codigo_cliente, cliente.nome_razaosocial, valorFinal, id_evento_faturamento, fatura_referencia, data_faturamento, data_vencimento]
    );

    return res.json({
      ok: true,
      cliente: { codigo_cliente: cliente.codigo_cliente, nome: cliente.nome_razaosocial },
      id_evento_faturamento,
      fatura_referencia,
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

    await saveConfig(updates);
    res.json({ ok: true, ...updates });
  } catch (err) {
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
      if (provided !== secret) return res.status(401).json({ error: 'Webhook secret inválido' });
    }

    const payload = req.body;
    const codCliente = payload.codigo_cliente ?? payload.dados?.codigo_cliente ?? payload.cliente?.codigo_cliente;
    if (!codCliente) return res.status(400).json({ error: 'codigo_cliente não encontrado no payload do webhook' });

    const dataPagamento = payload.data_pagamento ?? payload.dados?.data_pagamento ?? new Date().toISOString().slice(0, 10);

    const resultado = await processarPrimeiroPagamento(Number(codCliente));
    if (!resultado) {
      // Marca pagamento mesmo sem indicação em aguardando_pagamento (ex: fluxo ativacao direta)
      await pool.execute(
        `UPDATE indicacoes SET pagou_primeiro_boleto = 1, data_pagamento_primeiro_boleto = ?, updated_at = NOW()
         WHERE cod_cliente_indicado = ? AND pagou_primeiro_boleto = 0`,
        [dataPagamento, codCliente]
      );
      return res.json({ ok: true, msg: 'Pagamento registrado' });
    }

    await pool.execute(
      `UPDATE indicacoes SET pagou_primeiro_boleto = 1, data_pagamento_primeiro_boleto = ?, updated_at = NOW() WHERE id = ?`,
      [dataPagamento, resultado.indicacao.id]
    );

    console.log(`[Indique e Ganhe] Desconto aplicado (1ª fatura paga): indicação #${resultado.indicacao.id} | evento Hubsoft #${resultado.idEvento} | R$ ${resultado.valorDesconto}`);
    return res.json({
      ok: true,
      msg: 'Desconto de indicação aplicado após primeiro pagamento',
      id_indicacao: resultado.indicacao.id,
      id_evento_faturamento: resultado.idEvento,
      valor_desconto: resultado.valorDesconto,
    });
  } catch (err) {
    console.error('[Indique e Ganhe] Erro no webhook de pagamento:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
