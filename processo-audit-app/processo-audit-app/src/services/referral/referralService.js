import { hubsoft } from '../hubsoft/hubsoftClient.js';
import pool from '../../config/database.js';

async function getSetting(key, fallback) {
  const [[row]] = await pool.execute(
    'SELECT `value` FROM system_settings WHERE `key` = ? LIMIT 1',
    [key]
  );
  return row ? row.value : fallback;
}

export async function getConfig() {
  const [valor, regra, tipo] = await Promise.all([
    getSetting('referral_desconto_valor', '10'),
    getSetting('referral_regra_ativacao', 'ativacao'),
    getSetting('referral_tipo_recompensa', 'desconto_valor'),
  ]);
  return { desconto_valor: parseFloat(valor), regra_ativacao: regra, tipo_recompensa: tipo };
}

export async function saveConfig({ desconto_valor, regra_ativacao, tipo_recompensa }) {
  const updates = [];

  if (desconto_valor !== undefined) {
    updates.push(pool.execute(
      'INSERT INTO system_settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)',
      ['referral_desconto_valor', String(desconto_valor)]
    ));
  }

  if (regra_ativacao !== undefined) {
    const validos = ['ativacao', 'primeira_fatura_paga'];
    if (!validos.includes(regra_ativacao)) throw new Error('regra_ativacao inválida');
    updates.push(pool.execute(
      'INSERT INTO system_settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)',
      ['referral_regra_ativacao', regra_ativacao]
    ));
  }

  if (tipo_recompensa !== undefined) {
    const validos = ['desconto_valor', 'remover_fatura'];
    if (!validos.includes(tipo_recompensa)) throw new Error('tipo_recompensa inválido');
    updates.push(pool.execute(
      'INSERT INTO system_settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)',
      ['referral_tipo_recompensa', tipo_recompensa]
    ));
  }

  await Promise.all(updates);
}

function getIdTipoServico() {
  const id = parseInt(process.env.REFERRAL_ID_TIPO_SERVICO, 10);
  if (!id) throw new Error('REFERRAL_ID_TIPO_SERVICO não configurado no .env');
  return id;
}

// Builds the correct billing params depending on whether the service uses carnê (which
// doesn't support proximo_faturamento=true and requires an explicit month/year).
function buildFaturamentoParams(servico) {
  const usaCarne = String(servico.carne ?? '').toLowerCase() === 'sim'
    || String(servico.tipo_cobranca ?? '').toLowerCase().includes('postecipada');

  if (usaCarne) {
    const next = new Date();
    next.setMonth(next.getMonth() + 1);
    const mes = next.getMonth() + 1;
    const ano = next.getFullYear();
    return {
      params: {
        parcelado: false,
        proximo_faturamento: false,
        mes_processar: mes,
        ano_processar: ano,
      },
      referencia: `${String(mes).padStart(2, '0')}/${ano}`
    };
  }

  return {
    params: { parcelado: false, proximo_faturamento: true },
    referencia: 'Próxima Fatura'
  };
}

export async function criarEventoDesconto({ id_cliente_servico, servico, valor, descricao }) {
  const { params, referencia } = buildFaturamentoParams(servico ?? {});

  const body = {
    id_cliente_servico,
    id_tipo_servico: getIdTipoServico(),
    tipo: 'desconto',
    descricao,
    valor,
    ...params,
  };

  const res = await hubsoft.post('api/v1/integracao/financeiro/evento_faturamento', body);

  if (res?.status === 'error') {
    throw new Error(`Hubsoft: ${res.msg}`);
  }

  const evento = res?.eventos_faturamento?.[0];

  return {
    id_evento_faturamento: evento?.id_evento_faturamento ?? null,
    fatura_referencia: evento?.referencia || referencia,
    data_faturamento: evento?.data_faturamento || evento?.fatura?.data_faturamento || null,
    data_vencimento: evento?.data_vencimento || evento?.fatura?.data_vencimento || null
  };
}

// Sincroniza status e pagamento de todos os leads com cod_cliente_indicado contra o HubSoft.
// Usa GraphQL para detectar clientes cancelados (REST omite clientes sem serviços ativos).
// Também detecta automaticamente o pagamento do 1º boleto consultando faturas no HubSoft.
export async function sincronizarLeads(leads) {
  const comCliente = leads.filter(l => l.cod_cliente_indicado);
  if (comCliente.length === 0) return;

  await Promise.allSettled(comCliente.map(async (lead) => {
    try {
      const gql = await hubsoft.graphql(`
        query($cod: Int!) {
          clienteByCodigo(codigo_cliente: $cod) {
            codigo_cliente
            servicos { id_cliente_servico data_cancelamento servico_status { prefixo } }
          }
        }
      `, { cod: Number(lead.cod_cliente_indicado) });

      const cliente = gql?.data?.clienteByCodigo;
      const servicos = cliente?.servicos ?? [];

      // Cliente sem serviços ativos = cancelado
      const servicosAtivos = servicos.filter(
        s => s.servico_status?.prefixo === 'servico_habilitado' && !s.data_cancelamento
      );

      if (lead.status === 'ativo' && servicosAtivos.length === 0) {
        await pool.execute(
          "UPDATE indicacoes SET status = 'cancelado', updated_at = NOW() WHERE id = ?",
          [lead.id]
        );
        return;
      }

      // Detecta pagamento do 1º boleto: se o lead está ativo mas nunca foi marcado como pago,
      // consulta as faturas do cliente no HubSoft. Qualquer fatura paga indica que o 1º boleto foi quitado.
      if (lead.status === 'ativo' && !lead.pagou_primeiro_boleto) {
        const servico = servicosAtivos[0] ?? servicos[0];
        if (servico?.id_cliente_servico) {
          try {
            const faturasData = await hubsoft.get('api/v1/integracao/financeiro/fatura', {
              id_cliente_servico: servico.id_cliente_servico,
              pagina: 0,
              itens_por_pagina: 20,
            });
            const pagas = (faturasData.faturas ?? [])
              .filter(f => f.data_pagamento)
              .sort((a, b) => new Date(a.data_pagamento) - new Date(b.data_pagamento));

            if (pagas.length > 0) {
              const primeiroPagamento = pagas[0].data_pagamento;
              await pool.execute(
                `UPDATE indicacoes
                 SET pagou_primeiro_boleto = 1, data_pagamento_primeiro_boleto = ?, updated_at = NOW()
                 WHERE id = ?`,
                [primeiroPagamento, lead.id]
              );
            }
          } catch (_) { /* ignora se a consulta de faturas falhar */ }
        }
      }
    } catch (_) { /* ignora erros individuais */ }
  }));
}

export async function buscarClientePorCodigo(codCliente) {
  const data = await hubsoft.get('api/v1/integracao/cliente', {
    busca: 'codigo_cliente',
    termo_busca: codCliente,
    pagina: 0,
    itens_por_pagina: 1,
  });

  const cliente = data.cliente ?? data.clientes?.[0];
  if (!cliente) throw new Error(`Cliente ${codCliente} não encontrado no Hubsoft`);
  return cliente;
}

export async function buscarProspectoPorId(idProspecto) {
  const data = await hubsoft.get('api/v1/integracao/prospecto', {
    busca: 'id_prospecto',
    termo_busca: idProspecto,
    pagina: 0,
    itens_por_pagina: 1,
  });

  if (data.status === 'error') throw new Error(`Prospecto ${idProspecto} não encontrado no Hubsoft`);
  const prospecto = data.prospectos;
  if (!prospecto) throw new Error(`Prospecto ${idProspecto} não encontrado no Hubsoft`);
  return prospecto;
}

export async function buscarClientePorCPF(cpf) {
  const data = await hubsoft.get('api/v1/integracao/cliente', {
    busca: 'cpf_cnpj',
    termo_busca: cpf,
    pagina: 0,
    itens_por_pagina: 1,
  });

  return data.cliente ?? data.clientes?.[0] ?? null;
}

export async function buscarProspectoPorCPF(cpf) {
  const data = await hubsoft.get('api/v1/integracao/prospecto', {
    busca: 'cpf_cnpj',
    termo_busca: cpf,
    pagina: 0,
    itens_por_pagina: 1,
  });

  return data.prospecto ?? data.prospectos?.[0] ?? data.prospectos ?? null;
}

export async function criarProspecto(dados) {
  const id_origem_prospecto = process.env.HUBSOFT_REFERRAL_ORIGIN_ID || null;

  const body = {
    nome: dados.nome,
    cpf_cnpj: dados.cpf,
    telefone_1: dados.telefone,
    email: dados.email || '',
    endereco: dados.endereco,
    numero: dados.numero || 'S/N',
    bairro: dados.bairro || '',
    cidade: dados.cidade || '',
    estado: dados.estado || '',
    id_origem_prospecto,
    observacao: dados.observacao || 'Indicação via Painel Externo',
    tipo_pessoa: (dados.cpf || '').length > 14 ? 'J' : 'F'
  };

  const res = await hubsoft.post('api/v1/integracao/prospecto', body);

  if (res?.status === 'error') {
    throw new Error(`Hubsoft: ${res.msg}`);
  }

  return res;
}

async function getServicoAtivo(codCliente) {
  const cliente = await buscarClientePorCodigo(codCliente);
  const servicos = cliente.servicos ?? [];
  const servico = servicos.find(s => s.status_prefixo === 'servico_habilitado') ?? servicos[0];
  if (!servico) throw new Error(`Cliente ${codCliente} não possui serviços no Hubsoft`);
  return servico;
}

export async function listarCRMs() {
  const data = await hubsoft.get('api/v1/integracao/crm/all');
  if (data?.crms && Array.isArray(data.crms)) return data.crms;
  if (Array.isArray(data)) return data;
  if (data?.data && Array.isArray(data.data)) return data.data;
  return [];
}

export async function enviarParaCRM({ id_prospecto, id_crm, observacao }) {
  const body = {
    id_prospecto,
    id_crm,
    observacao: observacao || 'Lead enviado via Painel de Indicações'
  };

  const res = await hubsoft.post('api/v1/integracao/crm/cartao', body);

  if (res?.status === 'error') {
    throw new Error(`Hubsoft CRM: ${res.msg}`);
  }

  return res;
}

// Finds a pending indicacao for a given client code, trying multiple fallback strategies.
// Updates cod_cliente_indicado in DB if found via fallback. Returns the row or null.
async function encontrarIndicacao(codClienteIndicado, statusBusca) {
  let rows;

  const statuses = Array.isArray(statusBusca) ? statusBusca : [statusBusca];
  const placeholders = statuses.map(() => '?').join(', ');

  [rows] = await pool.execute(
    `SELECT * FROM indicacoes WHERE cod_cliente_indicado = ? AND status IN (${placeholders}) LIMIT 1`,
    [codClienteIndicado, ...statuses]
  );

  // Fallback: buscar via prospecto vinculado ao codigo_cliente
  if (rows.length === 0) {
    try {
      const cliente = await buscarClientePorCodigo(codClienteIndicado);
      const idCliente = cliente.id_cliente;
      if (idCliente) {
        const prospData = await hubsoft.get('api/v1/integracao/prospecto', {
          busca: 'id_cliente',
          termo_busca: idCliente,
          pagina: 0,
          itens_por_pagina: 1,
        });
        const prosp = prospData.prospectos;
        if (prosp?.id_prospecto) {
          [rows] = await pool.execute(
            `SELECT * FROM indicacoes WHERE id_prospecto_indicado = ? AND status IN (${placeholders}) LIMIT 1`,
            [prosp.id_prospecto, ...statuses]
          );
          if (rows.length > 0) {
            await pool.execute(
              `UPDATE indicacoes SET cod_cliente_indicado = ? WHERE id = ?`,
              [codClienteIndicado, rows[0].id]
            );
          }
        }
      }
    } catch (_) { /* ignora se não achar */ }
  }

  // Fallback: buscar via CPF do cliente ativado (leads cadastrados sem id_prospecto)
  if (rows.length === 0) {
    try {
      const cliente = await buscarClientePorCodigo(codClienteIndicado);
      const cpf = cliente.cpf_cnpj;
      if (cpf) {
        [rows] = await pool.execute(
          `SELECT * FROM indicacoes WHERE cpf_indicado = ? AND status IN (${placeholders}) LIMIT 1`,
          [cpf, ...statuses]
        );
        if (rows.length > 0) {
          await pool.execute(
            `UPDATE indicacoes SET cod_cliente_indicado = ? WHERE id = ?`,
            [codClienteIndicado, rows[0].id]
          );
        }
      }
    } catch (_) { /* ignora se não achar */ }
  }

  return rows.length > 0 ? rows[0] : null;
}

// Finds the referrer's next unpaid invoice for a given service.
async function buscarProximaFaturaPendente(idClienteServico) {
  const data = await hubsoft.get('api/v1/integracao/financeiro/fatura', {
    id_cliente_servico: idClienteServico,
    pagina: 0,
    itens_por_pagina: 20,
  });
  const faturas = data.faturas ?? [];
  const pendentes = faturas
    .filter(f => f.fatura_ativa && !f.data_pagamento)
    .sort((a, b) => new Date(a.data_vencimento) - new Date(b.data_vencimento));
  return pendentes[0] ?? null;
}

// Applies the reward to the referrer (discount event or full invoice removal) and marks the indicacao as 'ativo'.
async function aplicarDesconto(indicacao, codClienteIndicado) {
  let servico;
  if (indicacao.id_cliente_servico) {
    const cliente = await buscarClientePorCodigo(indicacao.cod_cliente_indicador);
    servico = (cliente.servicos ?? []).find(s => s.id_cliente_servico === indicacao.id_cliente_servico)
      ?? await getServicoAtivo(indicacao.cod_cliente_indicador);
  } else {
    servico = await getServicoAtivo(indicacao.cod_cliente_indicador);
  }

  const { desconto_valor: descontoPadrao, tipo_recompensa: tipoRecompensaGlobal } = await getConfig();
  const tipo_recompensa = indicacao.tipo_recompensa ?? tipoRecompensaGlobal;

  let nomeExibicao = indicacao.nome_indicado || 'novo cliente';
  try {
    const cliHub = await buscarClientePorCodigo(codClienteIndicado);
    nomeExibicao = cliHub.nome_razaosocial || cliHub.nome || nomeExibicao;
  } catch (_) { /* usa nome do banco */ }

  let DESCONTO_VALOR;
  let descricaoEvento;

  if (tipo_recompensa === 'remover_fatura') {
    const fatura = await buscarProximaFaturaPendente(servico.id_cliente_servico);
    if (!fatura) throw new Error(`Nenhuma fatura pendente encontrada para o cliente indicador (serviço ${servico.id_cliente_servico})`);
    DESCONTO_VALOR = parseFloat(fatura.valor);
    descricaoEvento = `Indique e Ganhe — fatura removida pela indicação de ${nomeExibicao} (fatura #${fatura.id_fatura})`;
  } else {
    DESCONTO_VALOR = indicacao.valor_desconto ? parseFloat(indicacao.valor_desconto) : descontoPadrao;
    descricaoEvento = `Desconto Indique e Ganhe — indicação de ${nomeExibicao} ativado`;
  }

  const { id_evento_faturamento, fatura_referencia, data_faturamento, data_vencimento } = await criarEventoDesconto({
    id_cliente_servico: servico.id_cliente_servico,
    servico,
    valor: DESCONTO_VALOR,
    descricao: descricaoEvento,
  });

  await pool.execute(
    `UPDATE indicacoes SET
      status = 'ativo',
      nome_indicado = ?,
      valor_desconto = ?,
      id_evento_faturamento = ?,
      fatura_referencia = ?,
      data_faturamento = ?,
      data_vencimento = ?,
      updated_at = NOW()
     WHERE id = ?`,
    [nomeExibicao, DESCONTO_VALOR, id_evento_faturamento, fatura_referencia, data_faturamento, data_vencimento, indicacao.id]
  );

  return { indicacao, idEvento: id_evento_faturamento, valorDesconto: DESCONTO_VALOR, fatura_referencia, data_faturamento, data_vencimento };
}

// Called when a referred client is activated. Depending on the rule:
// - 'ativacao': applies the discount immediately.
// - 'primeira_fatura_paga': marks the indicacao as 'aguardando_pagamento' — discount is only applied after first payment.
export async function processarAtivacao(codClienteIndicado) {
  const indicacao = await encontrarIndicacao(codClienteIndicado, ['pendente', 'encaminhado']);
  if (!indicacao) return null;

  const { regra_ativacao: regraAtivacaoGlobal } = await getConfig();
  const regra_ativacao = indicacao.regra_ativacao ?? regraAtivacaoGlobal;

  if (regra_ativacao === 'primeira_fatura_paga') {
    await pool.execute(
      `UPDATE indicacoes SET status = 'aguardando_pagamento', cod_cliente_indicado = ?, updated_at = NOW() WHERE id = ?`,
      [codClienteIndicado, indicacao.id]
    );
    console.log(`[Indique e Ganhe] Indicação #${indicacao.id} marcada como aguardando_pagamento (regra: primeira_fatura_paga)`);
    return { indicacao, aguardandoPagamento: true };
  }

  return await aplicarDesconto(indicacao, codClienteIndicado);
}

// Called when a referred client pays their first invoice (only relevant when rule is 'primeira_fatura_paga').
export async function processarPrimeiroPagamento(codClienteIndicado) {
  const indicacao = await encontrarIndicacao(codClienteIndicado, 'aguardando_pagamento');
  if (!indicacao) return null;
  return await aplicarDesconto(indicacao, codClienteIndicado);
}
