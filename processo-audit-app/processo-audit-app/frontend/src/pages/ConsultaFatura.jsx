import React, { useState } from 'react';
import { hubsoftAPI } from '../api';
import { Search, FileSearch } from 'lucide-react';
import styles from './ConsultaFatura.module.css';

const fmt = (d) => {
  if (!d) return '—';
  return new Date(String(d).slice(0, 10) + 'T12:00:00').toLocaleDateString('pt-BR');
};

const toTitleCase = (str) => {
  if (!str) return '';
  if (str === str.toUpperCase()) return str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  return str;
};

// Classifica uma fatura em pago / vencido / aguardando, a partir de data_pagamento e data_vencimento.
const classificarFatura = (fatura) => {
  if (!fatura) return null;
  const status = fatura.data_pagamento
    ? 'pago'
    : (new Date(fatura.data_vencimento) < new Date() ? 'vencido' : 'aguardando');
  return { vencimento: fatura.data_vencimento, pagamento: fatura.data_pagamento ?? null, status };
};

const FATURA_BY_ID_QUERY = `
  query($id: ID!) {
    faturaById(id_fatura: $id) {
      id_fatura
      id_cliente_servico
      data_vencimento
      data_pagamento
    }
  }
`;

// A busca REST por id_cliente_servico só devolve a fatura "vigente" (uma só), não o histórico
// do carnê. Pra achar a 1ª fatura de verdade, anda pra trás a partir do ID conhecido via
// GraphQL faturaById (que aceita busca por ID individual) até cair num ID inexistente ou
// que pertença a outro cliente — sinal de que saiu do carnê atual. Limitado a 60 tentativas
// (~5 anos de faturas mensais) pra não rodar indefinidamente.
const buscarFaturasDoCarne = async (faturaAncora) => {
  const vistas = [faturaAncora];
  let id = Number(faturaAncora.id_fatura) - 1;

  for (let i = 0; i < 60; i++) {
    const gql = await hubsoftAPI.graphql(FATURA_BY_ID_QUERY, { id: String(id) });
    const f = gql?.data?.faturaById;
    if (!f || Number(f.id_cliente_servico) !== Number(faturaAncora.id_cliente_servico)) break;
    vistas.push(f);
    id--;
  }

  return vistas;
};

const FaturaBadge = ({ info }) => {
  if (!info) return <span className={styles.boletoNone}>—</span>;
  if (info.status === 'pago') return <span className={styles.boletoPago}>Pago em {fmt(info.pagamento)}</span>;
  if (info.status === 'vencido') return <span className={styles.boletoVencido}>Venceu {fmt(info.vencimento)}</span>;
  return <span className={styles.boletoPendente}>Vence {fmt(info.vencimento)}</span>;
};

const ConsultaFatura = () => {
  const [codigo, setCodigo] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const handleSearch = async (e) => {
    e.preventDefault();
    const cod = codigo.trim();
    if (!cod) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const gql = await hubsoftAPI.graphql(`
        query($cod: Int!) {
          clienteByCodigo(codigo_cliente: $cod) {
            codigo_cliente
            nome_razaosocial
            cpf_cnpj
            servicos { id_cliente_servico data_cancelamento servico_status { prefixo } }
          }
        }
      `, { cod: Number(cod) });

      const cliente = gql?.data?.clienteByCodigo;
      if (!cliente || !cliente.nome_razaosocial) {
        setError(`Nenhum cliente encontrado com o ID ${cod}.`);
        setLoading(false);
        return;
      }

      const servicos = cliente.servicos ?? [];
      const servicoAtivo = servicos.find(
        s => s.servico_status?.prefixo === 'servico_habilitado' && !s.data_cancelamento
      );
      const status = servicoAtivo ? 'ativo' : 'cancelado';

      let primeiroBoleto = null;
      let faturaAtual = null;

      if (servicoAtivo) {
        try {
          const faturasData = await hubsoftAPI.get('api/v1/integracao/financeiro/fatura', {
            busca: 'id_cliente_servico',
            termo_busca: servicoAtivo.id_cliente_servico,
            pagina: 0,
            itens_por_pagina: 100,
          });
          const ancora = faturasData.faturas?.[0];

          if (ancora) {
            const faturasDoCarne = await buscarFaturasDoCarne(ancora);
            const ordenadas = [...faturasDoCarne].sort((a, b) => new Date(a.data_vencimento) - new Date(b.data_vencimento));

            primeiroBoleto = classificarFatura(ordenadas[0]);
            faturaAtual = classificarFatura(ordenadas[ordenadas.length - 1]);
          }
        } catch (_) { /* segue sem dados de fatura */ }
      }

      setResult({
        codigo: cliente.codigo_cliente,
        nome: cliente.nome_razaosocial,
        cpf: cliente.cpf_cnpj,
        status,
        primeiroBoleto,
        faturaAtual,
      });
    } catch (err) {
      setError('Erro ao consultar: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div>
        <h1 className={styles.title}>Consulta de Fatura por ID</h1>
        <p className={styles.subtitle}>Consulte status, 1º boleto e fatura atual de qualquer cliente pelo ID (código de cliente no HubSoft)</p>
      </div>

      <form onSubmit={handleSearch} className={styles.searchBar}>
        <Search size={18} color="var(--text-light)" />
        <input
          type="text"
          inputMode="numeric"
          placeholder="Digite o ID do cliente (ex: 6989)"
          value={codigo}
          onChange={(e) => setCodigo(e.target.value)}
          className={styles.searchInput}
          autoFocus
        />
        <button type="submit" className={styles.searchButton} disabled={loading || !codigo.trim()}>
          {loading ? 'Consultando…' : 'Consultar'}
        </button>
      </form>

      {error && <div className={styles.errorBox}>{error}</div>}

      {result && (
        <div className={styles.resultCard}>
          <div className={styles.resultHeader}>
            <div>
              <h2 className={styles.resultName}>{toTitleCase(result.nome)}</h2>
              <div className={styles.resultMeta}>
                ID {result.codigo} · CPF/CNPJ {result.cpf || '—'}
              </div>
            </div>
            <span className={`${styles.badge} ${styles['status_' + result.status]}`}>
              {result.status === 'ativo' ? 'Ativo' : 'Cancelado'}
            </span>
          </div>

          <div className={styles.resultBody}>
            <div className={styles.resultItem}>
              <span className={styles.resultLabel}>1º Boleto</span>
              <FaturaBadge info={result.primeiroBoleto} />
            </div>
            <div className={styles.resultItem}>
              <span className={styles.resultLabel}>Fatura Atual</span>
              <FaturaBadge info={result.faturaAtual} />
            </div>
          </div>
        </div>
      )}

      {!result && !error && !loading && (
        <div className={styles.errorBox} style={{ background: 'var(--background-color)', color: 'var(--text-light)', display: 'flex', gap: 8, alignItems: 'center' }}>
          <FileSearch size={16} />
          Digite um ID de cliente para consultar.
        </div>
      )}
    </div>
  );
};

export default ConsultaFatura;
