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

// Usado só para liquidar automaticamente o centavo restante depois de renegociar uma fatura
// pra R$0,01 (ver renegociarFaturaExistente). Não adivinhamos qual caixa financeiro usar —
// isso é uma decisão de contabilidade do provedor, não algo pra inferir do lado do código.
function getIdCaixaFinanceiro() {
  const id = parseInt(process.env.REFERRAL_ID_CAIXA_FINANCEIRO, 10);
  if (!id) throw new Error('REFERRAL_ID_CAIXA_FINANCEIRO não configurado no .env — necessário para liquidar o centavo restante de faturas removidas via renegociação');
  return id;
}

// Builds the correct billing params depending on whether the service uses carnê (which
// doesn't support proximo_faturamento=true and requires an explicit month/year).
export function buildFaturamentoParams(servico) {
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

// mes_processar/ano_processar: quando informados, miram explicitamente essa competência em
// vez de deixar buildFaturamentoParams calcular "mês seguinte a partir de agora" — foi essa
// conta automática que mirou agosto/2026 em vez de julho/2026 no caso do Rafael (indicação
// #36). Usado pela ferramenta de teste, que deixa o operador escolher a fatura na tela.
export async function criarEventoDesconto({ id_cliente_servico, servico, valor, descricao, mes_processar, ano_processar }) {
  const alvoManual = mes_processar != null && ano_processar != null;
  const { params, referencia } = alvoManual
    ? {
        params: { parcelado: false, proximo_faturamento: false, mes_processar: Number(mes_processar), ano_processar: Number(ano_processar) },
        referencia: `${String(mes_processar).padStart(2, '0')}/${ano_processar}`,
      }
    : buildFaturamentoParams(servico ?? {});

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
// Também detecta o pagamento do 1º boleto e atualiza o status da fatura vigente (fatura_atual_*)
// consultando as faturas do cliente no HubSoft.
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

      // Busca as faturas do cliente indicado para detectar o 1º boleto pago e a fatura vigente.
      // IMPORTANTE: o filtro precisa ir em busca/termo_busca — a API do Hubsoft ignora
      // id_cliente_servico quando enviado como parâmetro solto e devolve a lista global de
      // faturas (de qualquer cliente), o que gerava datas de pagamento de outras pessoas aqui.
      if (lead.status === 'ativo') {
        const servico = servicosAtivos[0] ?? servicos[0];
        if (servico?.id_cliente_servico) {
          try {
            const faturasData = await hubsoft.get('api/v1/integracao/financeiro/fatura', {
              busca: 'id_cliente_servico',
              termo_busca: servico.id_cliente_servico,
              pagina: 0,
              itens_por_pagina: 20,
              tipo_data: 'data_vencimento',
              data_inicio: dateStr(-365),
              data_fim: dateStr(365),
            });
            const faturas = faturasData.faturas ?? [];

            if (!lead.pagou_primeiro_boleto) {
              const pagas = faturas
                .filter(f => f.data_pagamento)
                .sort((a, b) => new Date(a.data_pagamento) - new Date(b.data_pagamento));

              if (pagas.length > 0) {
                await pool.execute(
                  `UPDATE indicacoes
                   SET pagou_primeiro_boleto = 1, data_pagamento_primeiro_boleto = ?, updated_at = NOW()
                   WHERE id = ?`,
                  [pagas[0].data_pagamento, lead.id]
                );
              }
            }

            // Fatura vigente = a de vencimento mais recente. Só é considerada "paga" se tiver
            // baixa (data_pagamento preenchida) — caso contrário fica vencida ou aguardando.
            const maisRecente = [...faturas]
              .sort((a, b) => new Date(b.data_vencimento) - new Date(a.data_vencimento))[0];

            if (maisRecente) {
              const status = maisRecente.data_pagamento
                ? 'pago'
                : (new Date(maisRecente.data_vencimento) < new Date() ? 'vencido' : 'aguardando');

              await pool.execute(
                `UPDATE indicacoes
                 SET fatura_atual_vencimento = ?, fatura_atual_baixa = ?, fatura_atual_status = ?, updated_at = NOW()
                 WHERE id = ?`,
                [maisRecente.data_vencimento, maisRecente.data_pagamento ?? null, status, lead.id]
              );
            } else {
              await pool.execute(
                `UPDATE indicacoes
                 SET fatura_atual_vencimento = NULL, fatura_atual_baixa = NULL, fatura_atual_status = NULL, updated_at = NOW()
                 WHERE id = ?`,
                [lead.id]
              );
            }
          } catch (_) { /* ignora se a consulta de faturas falhar */ }
        }
      }

      // Indicações aguardando o 1º pagamento (regra primeira_fatura_paga): o fluxo normal depende
      // do webhook /webhook/pagamento disparado pelo Hubsoft, mas se ele falhar ou nunca chegar
      // (ex: baixa manual no Hubsoft) o lead fica preso em "aguardando_pagamento" para sempre.
      // Aqui checamos direto no Hubsoft se alguma fatura já foi baixada e, se sim, aplicamos o
      // desconto e ativamos a indicação, do mesmo jeito que o webhook faria.
      if (lead.status === 'aguardando_pagamento') {
        const servico = servicosAtivos[0] ?? servicos[0];
        if (servico?.id_cliente_servico) {
          try {
            const faturasData = await hubsoft.get('api/v1/integracao/financeiro/fatura', {
              busca: 'id_cliente_servico',
              termo_busca: servico.id_cliente_servico,
              pagina: 0,
              itens_por_pagina: 20,
              tipo_data: 'data_vencimento',
              data_inicio: dateStr(-365),
              data_fim: dateStr(365),
            });
            const pagas = (faturasData.faturas ?? [])
              .filter(f => f.data_pagamento)
              .sort((a, b) => new Date(a.data_pagamento) - new Date(b.data_pagamento));

            if (pagas.length > 0) {
              const resultado = await aplicarDesconto(lead, lead.cod_cliente_indicado);
              await pool.execute(
                `UPDATE indicacoes
                 SET pagou_primeiro_boleto = 1, data_pagamento_primeiro_boleto = ?, updated_at = NOW()
                 WHERE id = ?`,
                [pagas[0].data_pagamento, lead.id]
              );
              console.log(`[Indique e Ganhe] Desconto aplicado via sync (webhook não chegou): indicação #${lead.id} | evento Hubsoft #${resultado.idEvento}${resultado.descontoAdiado ? ' | ADIADO para a próxima fatura (a atual já existia)' : ''}`);
            }
          } catch (e) {
            console.error(`[Indique e Ganhe] Falha ao aplicar desconto via sync para indicação #${lead.id}:`, e.message);
          }
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
// IMPORTANTE: sem data_inicio/data_fim, a API do Hubsoft aplica o range padrão dela
// ("10 dias anteriores até a data atual" para data_vencimento) — ou seja, SEM esses
// parâmetros essa busca só enxerga faturas vencidas nos últimos 10 dias, e é cega para
// qualquer fatura já gerada com vencimento no futuro (o caso normal de uma fatura em
// aberto, que costuma vencer dias/semanas à frente, não atrás). Por isso passamos um range
// bem largo aqui — sem isso, aplicarDesconto()/simularDesconto() concluíam erroneamente que
// não havia fatura em aberto e deixavam o desconto ser adiado sem avisar ninguém.
function dateStr(offsetDays) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

async function listarFaturasCliente(idClienteServico) {
  const data = await hubsoft.get('api/v1/integracao/financeiro/fatura', {
    busca: 'id_cliente_servico',
    termo_busca: idClienteServico,
    pagina: 0,
    itens_por_pagina: 50,
    tipo_data: 'data_vencimento',
    data_inicio: dateStr(-90),
    data_fim: dateStr(365),
    exibir_fatura_inativa: 'nao',
  });
  return (data.faturas ?? [])
    .map(f => {
      const [ano, mes] = String(f.data_vencimento).split('-');
      return {
        id_fatura: f.id_fatura,
        data_vencimento: f.data_vencimento,
        valor: parseFloat(f.valor),
        paga: !!f.data_pagamento,
        fatura_ativa: !!f.fatura_ativa,
        mes_processar: Number(mes),
        ano_processar: Number(ano),
      };
    })
    .sort((a, b) => new Date(a.data_vencimento) - new Date(b.data_vencimento));
}

// Finds the referrer's next unpaid invoice for a given service.
export async function buscarProximaFaturaPendente(idClienteServico) {
  const faturas = await listarFaturasCliente(idClienteServico);
  return faturas.find(f => f.fatura_ativa && !f.paga) ?? null;
}

// Read-only preview of what aplicarDesconto()/criarEventoDesconto() would do for a given
// cliente/serviço — no writes to Hubsoft, no writes to the local DB. Lets staff check whether
// a reward would land on the currently open invoice or get deferred to the next one (and by
// how much) BEFORE actually firing a real evento_faturamento, and optionally pick an explicit
// target competência (mes_processar/ano_processar) instead of the automatic "next month" guess.
// Built after the Rafael/Ludimila case (indicação #36), where a reward silently landed on the
// wrong invoice with no way to see that in advance.
export async function simularDesconto({ cod_cliente, id_cliente_servico, tipo_recompensa, valor, mes_processar, ano_processar }) {
  const cliente = await buscarClientePorCodigo(cod_cliente);
  const servico = (cliente.servicos ?? []).find(s => s.id_cliente_servico === Number(id_cliente_servico));
  if (!servico) throw new Error(`Serviço ${id_cliente_servico} não encontrado para o cliente ${cod_cliente}`);

  const { desconto_valor: descontoPadrao } = await getConfig();
  const tipoFinal = tipo_recompensa === 'remover_fatura' ? 'remover_fatura' : 'desconto_valor';

  const faturas = await listarFaturasCliente(servico.id_cliente_servico);
  const faturasAbertas = faturas.filter(f => f.fatura_ativa && !f.paga);
  const faturaEmAberto = faturasAbertas[0] ?? null;

  const alvoManual = mes_processar != null && ano_processar != null;
  let params, referencia;
  if (alvoManual) {
    params = { parcelado: false, proximo_faturamento: false, mes_processar: Number(mes_processar), ano_processar: Number(ano_processar) };
    referencia = `${String(mes_processar).padStart(2, '0')}/${ano_processar}`;
  } else {
    ({ params, referencia } = buildFaturamentoParams(servico));
  }

  // A fatura (existente ou não) que corresponde exatamente ao mês/ano mirado — usada tanto
  // para precificar "remover_fatura" com o valor real (em vez do valor do plano) quanto para
  // avisar se essa competência já foi paga (nesse caso o desconto não teria efeito nenhum).
  const faturaNoAlvo = params.mes_processar
    ? faturas.find(f => f.mes_processar === params.mes_processar && f.ano_processar === params.ano_processar) ?? null
    : null;

  let valorAplicado;
  if (tipoFinal === 'remover_fatura') {
    valorAplicado = faturaNoAlvo ? faturaNoAlvo.valor : parseFloat(servico.valor);
    if (isNaN(valorAplicado)) throw new Error(`Não foi possível determinar o valor do plano do serviço ${servico.id_cliente_servico}`);
  } else {
    valorAplicado = valor != null ? parseFloat(valor) : descontoPadrao;
    if (isNaN(valorAplicado) || valorAplicado <= 0) throw new Error('valor inválido');
  }

  // No modo automático, "adiado" significa que o alvo calculado (mês seguinte) não é o mesmo
  // mês da fatura que está aberta agora. No modo manual não existe "adiado" — o operador está
  // mirando exatamente o que escolheu; o que importa ali é avisar se esse alvo já foi pago.
  const descontoAdiado = !alvoManual && !!faturaEmAberto &&
    !(faturaEmAberto.mes_processar === params.mes_processar && faturaEmAberto.ano_processar === params.ano_processar);

  // Mecanismo usado para efetivar de verdade:
  // - a fatura do mês mirado ainda não existe (nem gerada) → evento_faturamento funciona nativamente.
  // - já existe e está paga → nada pode ser feito, bloqueado.
  // - já existe e está em aberto → só renegociação consegue mudar o valor dela (ver
  //   renegociarFaturaExistente). Para "remover_fatura" o Hubsoft recusa deixar o valor final
  //   em R$0 exato, então o plano é descontar até sobrar R$0,01 e liquidar esse centavo
  //   automaticamente, sem custo pro cliente.
  let mecanismo = 'evento_faturamento';
  let renegociacaoPreview = null;
  if (faturaNoAlvo?.paga) {
    mecanismo = 'bloqueado_ja_paga';
  } else if (faturaNoAlvo) {
    mecanismo = 'renegociacao';
    if (tipoFinal === 'remover_fatura') {
      const descontoRenegociacao = Math.round((faturaNoAlvo.valor - 0.01) * 100) / 100;
      renegociacaoPreview = {
        desconto: descontoRenegociacao,
        valor_final: 0.01,
        sera_liquidado_automaticamente: true,
      };
      if (descontoRenegociacao <= 0) {
        mecanismo = 'bloqueado_valor_muito_baixo';
      }
    } else {
      if (valorAplicado >= faturaNoAlvo.valor) {
        mecanismo = 'bloqueado_desconto_maior_que_fatura';
      }
      renegociacaoPreview = {
        desconto: valorAplicado,
        valor_final: Math.round((faturaNoAlvo.valor - valorAplicado) * 100) / 100,
        sera_liquidado_automaticamente: false,
      };
    }
  }

  return {
    cliente: { codigo_cliente: cliente.codigo_cliente, nome: cliente.nome_razaosocial ?? cliente.nome_fantasia ?? '' },
    servico: {
      id_cliente_servico: servico.id_cliente_servico,
      nome: servico.nome,
      valor: parseFloat(servico.valor),
      carne: servico.carne,
      tipo_cobranca: servico.tipo_cobranca,
    },
    tipo_recompensa: tipoFinal,
    valor_a_aplicar: valorAplicado,
    fatura_em_aberto: faturaEmAberto ? {
      id_fatura: faturaEmAberto.id_fatura,
      valor: faturaEmAberto.valor,
      data_vencimento: faturaEmAberto.data_vencimento,
    } : null,
    faturas_disponiveis: faturasAbertas.slice(0, 12).map(f => ({
      id_fatura: f.id_fatura, data_vencimento: f.data_vencimento, valor: f.valor,
      mes_processar: f.mes_processar, ano_processar: f.ano_processar,
    })),
    alvo: {
      referencia,
      mes_processar: params.mes_processar ?? null,
      ano_processar: params.ano_processar ?? null,
      proximo_faturamento: params.proximo_faturamento ?? false,
      escolhido_manualmente: alvoManual,
    },
    alvo_fatura_existente: faturaNoAlvo ? {
      id_fatura: faturaNoAlvo.id_fatura, valor: faturaNoAlvo.valor,
      data_vencimento: faturaNoAlvo.data_vencimento, paga: faturaNoAlvo.paga,
    } : null,
    mecanismo,
    renegociacao_preview: renegociacaoPreview,
    desconto_adiado: descontoAdiado,
  };
}

async function buscarFaturaDetalhada(idFatura) {
  // Mesma pegadinha de sempre: sem data_inicio/data_fim o Hubsoft filtra por um range padrão
  // de +-10 dias a partir de hoje (ver listarFaturasCliente/buscarProximaFaturaPendente) — uma
  // fatura de carnê com vencimento daqui a mais de 10 dias "some" da busca sem esse range.
  const data = await hubsoft.get('api/v1/integracao/financeiro/fatura', {
    busca: 'id_fatura',
    termo_busca: idFatura,
    pagina: 0,
    itens_por_pagina: 1,
    tipo_resultado: 'completo',
    tipo_data: 'data_vencimento',
    data_inicio: dateStr(-365),
    data_fim: dateStr(365),
  });
  const fatura = (data.faturas ?? [])[0];
  if (!fatura) throw new Error(`Fatura ${idFatura} não encontrada`);
  return fatura;
}

// Renegocia uma fatura JÁ EXISTENTE (evento_faturamento não consegue mudar o valor dela — ver
// simularDesconto). A renegociação cancela a fatura original e emite uma nova já com o valor
// ajustado. Hubsoft recusa efetivar uma renegociação cujo valor final feche em R$0 exato, então
// para "remover_fatura" deixamos R$0,01 e liquidamos esse centavo automaticamente logo depois
// (sem custo pro cliente) — decisão tomada explicitamente com o usuário, ciente de que é uma
// gambiarra: fica um registro de "pago R$0,01" na fatura nova do cliente.
export async function renegociarFaturaExistente({ id_fatura, id_cliente_servico, tipo_recompensa, valor, descricao }) {
  const fatura = await buscarFaturaDetalhada(id_fatura);
  if (fatura.data_pagamento) throw new Error(`Fatura ${id_fatura} já está paga — nada a fazer`);

  const idEmpresa = fatura?.cobrancas?.[0]?.composicao?.dados_cadastrais?.empresa?.id_empresa;
  const idFormaCobranca = fatura?.forma_cobranca?.id_forma_cobranca;
  const idCliente = fatura?.cliente?.id_cliente;
  if (!idEmpresa || !idFormaCobranca || !idCliente) {
    throw new Error(`Não foi possível determinar empresa/forma_cobranca/cliente da fatura ${id_fatura} para renegociar`);
  }

  const valorFatura = parseFloat(fatura.valor);
  const zerar = tipo_recompensa === 'remover_fatura';
  const desconto = zerar ? Math.round((valorFatura - 0.01) * 100) / 100 : parseFloat(valor);

  if (isNaN(desconto) || desconto <= 0) throw new Error(`Desconto inválido para a fatura ${id_fatura} (valor R$ ${valorFatura})`);
  if (desconto >= valorFatura) throw new Error(`O desconto (R$ ${desconto}) precisa ser menor que o valor da fatura (R$ ${valorFatura})`);

  const body = {
    vencimento: fatura.data_vencimento,
    faturas: 'definir_faturas',
    quantidade_parcelas: 1,
    ids_faturas: [Number(id_fatura)],
    tipo_dados_cliente: 'id_cliente',
    dados_cliente: idCliente,
    cliente_servico: Number(id_cliente_servico),
    forma_cobranca: idFormaCobranca,
    empresa: idEmpresa,
    descontos: desconto,
    encargos: 0,
    observacao: descricao,
  };

  const res = await hubsoft.post('api/v1/integracao/financeiro/renegociacao/efetivar', body);
  if (res?.status === 'error') throw new Error(`Hubsoft (renegociação): ${res.msg}`);

  const valorEsperadoNova = Math.round((valorFatura - desconto) * 100) / 100;

  // A resposta do efetivar não traz o id_fatura da fatura nova — localizamos ela pelo par
  // (id_cliente_servico + valor esperado), pegando a mais recente cadastrada hoje.
  const buscaNova = await hubsoft.get('api/v1/integracao/financeiro/fatura', {
    busca: 'id_cliente_servico',
    termo_busca: id_cliente_servico,
    pagina: 0,
    itens_por_pagina: 20,
    tipo_data: 'data_cadastro',
    data_inicio: dateStr(0),
    data_fim: dateStr(0),
  });
  const novaFatura = (buscaNova.faturas ?? [])
    .filter(f => !f.data_pagamento && Math.abs(parseFloat(f.valor) - valorEsperadoNova) < 0.02)
    .sort((a, b) => b.id_fatura - a.id_fatura)[0];

  if (!novaFatura) {
    return {
      renegociado: true,
      liquidado: false,
      aviso: 'Renegociação efetuada, mas não foi possível localizar automaticamente a fatura nova para liquidar o centavo restante — verifique manualmente no Hubsoft.',
      faturas_geradas: res.faturas_que_foram_geradas ?? [],
    };
  }

  if (!zerar) {
    return {
      renegociado: true,
      liquidado: false,
      fatura_original: { id_fatura: fatura.id_fatura, valor: valorFatura },
      nova_fatura: { id_fatura: novaFatura.id_fatura, valor: parseFloat(novaFatura.valor), data_vencimento: novaFatura.data_vencimento },
    };
  }

  const liq = await hubsoft.post('api/v1/integracao/financeiro/fatura/liquidar', {
    id_fatura: novaFatura.id_fatura,
    id_caixa_financeiro: getIdCaixaFinanceiro(),
    data_pagamento: dateStr(0),
    valor_pago: parseFloat(novaFatura.valor),
    meio_pagamento: 'dinheiro',
  });

  if (liq?.status === 'error') {
    return {
      renegociado: true,
      liquidado: false,
      aviso: `Renegociação ok, mas falha ao liquidar o centavo restante: ${liq.msg}`,
      fatura_original: { id_fatura: fatura.id_fatura, valor: valorFatura },
      nova_fatura: { id_fatura: novaFatura.id_fatura, valor: parseFloat(novaFatura.valor) },
    };
  }

  return {
    renegociado: true,
    liquidado: true,
    fatura_original: { id_fatura: fatura.id_fatura, valor: valorFatura },
    nova_fatura: { id_fatura: novaFatura.id_fatura, valor: parseFloat(novaFatura.valor), data_vencimento: novaFatura.data_vencimento },
    recibo: liq.recibo,
  };
}

// Applies the reward to the referrer (discount event or full invoice removal) and marks the indicacao as 'ativo'.
//
// IMPORTANT (per Hubsoft support): financeiro/evento_faturamento with proximo_faturamento=true
// only ever lands on the next invoice the billing run *generates* — it can never modify an
// invoice that already exists. So if the referrer already has an open (already-generated,
// unpaid) invoice at the moment the reward is granted, the event skips it and lands on the
// cycle after that. There is no REST endpoint in the Hubsoft API to discount an
// already-issued invoice (only a manual "Adicionar Desconto > Abater na Fatura" action in the
// Hubsoft UI does that). So we detect this case, always price the reward off the recurring
// plan value (never off an already-generated invoice's value — that invoice cannot be
// touched), and flag it so the panel tells the truth about which cycle the reward lands on.
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

  // A fatura pendente (já gerada e em aberto agora) nunca pode ser alterada pelo evento de
  // faturamento — ela só existe para sabermos se o desconto vai ficar adiado, e para exibir
  // qual fatura NÃO vai ser afetada.
  const faturaEmAberto = await buscarProximaFaturaPendente(servico.id_cliente_servico);
  const descontoAdiado = !!faturaEmAberto;
  const avisoAdiamento = descontoAdiado
    ? ` (a fatura em aberto no momento, vencimento ${faturaEmAberto.data_vencimento}, já havia sido gerada e não é afetada — vale a partir da próxima)`
    : '';

  let DESCONTO_VALOR;
  let descricaoEvento;

  if (tipo_recompensa === 'remover_fatura') {
    // Sempre usa o valor do plano: o evento só pode mirar uma fatura que ainda não foi gerada,
    // então o valor da fatura já existente (se houver) é irrelevante para o cálculo.
    DESCONTO_VALOR = parseFloat(servico.valor);
    if (isNaN(DESCONTO_VALOR)) throw new Error(`Não foi possível determinar o valor do plano do serviço ${servico.id_cliente_servico} para aplicar o desconto`);
    descricaoEvento = `Indique e Ganhe — próxima fatura removida pela indicação de ${nomeExibicao}${avisoAdiamento}`;
  } else {
    DESCONTO_VALOR = indicacao.valor_desconto ? parseFloat(indicacao.valor_desconto) : descontoPadrao;
    descricaoEvento = `Desconto Indique e Ganhe — indicação de ${nomeExibicao} ativado${avisoAdiamento}`;
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
      desconto_adiado = ?,
      data_faturamento = ?,
      data_vencimento = ?,
      updated_at = NOW()
     WHERE id = ?`,
    [nomeExibicao, DESCONTO_VALOR, id_evento_faturamento, fatura_referencia, descontoAdiado ? 1 : 0, data_faturamento, data_vencimento, indicacao.id]
  );

  return {
    indicacao,
    idEvento: id_evento_faturamento,
    valorDesconto: DESCONTO_VALOR,
    fatura_referencia,
    data_faturamento,
    data_vencimento,
    descontoAdiado,
  };
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
