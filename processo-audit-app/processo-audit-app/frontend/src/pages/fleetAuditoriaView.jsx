// Como a auditoria da Frota mostra um registro: nomes dos campos, valores formatados e a tabela antes/depois.
// Usado pela aba Auditoria e pelo botão "Histórico" de cada lançamento.
import React from 'react';
import a from './AuditoriaIndicacoes.module.css';

export const TOM = { criado: 'novo', editado: 'edicao', inativado: 'alerta', reativado: 'dinheiro', excluido: 'perigo', cupom_lido: 'neutro' };

export const CAMPOS = {
  make: 'Marca', model: 'Modelo', license_plate: 'Placa', current_kilometers: 'Km atual',
  next_tire_change: 'Próxima troca de pneu (km)', next_oil_change: 'Próxima troca de óleo (km)',
  driver_id: 'Motorista', status: 'Situação', name: 'Nome', license_number: 'Nº CNH',
  car_id: 'Veículo', fuel_date: 'Data', fueling_kilometers: 'Km no abastecimento', fuel_amount: 'Valor abastecido',
  liters_quantity: 'Litros', price_per_liter: 'Preço por litro', total_cost: 'Custo total', fuel_type: 'Combustível',
  observation: 'Observação', oil_change_date: 'Data', oil_change_kilometers: 'Km', tire_change_date: 'Data',
  tire_change_kilometers: 'Km', maintenance_type_id: 'Tipo de manutenção', maintenance_date: 'Data',
  maintenance_kilometers: 'Km', recurrence_mode: 'Recorrência por', recurrency: 'A cada (km)', recurrency_date: 'A cada (dias)',
  apagados_junto: 'Apagado junto', veiculos_ficaram_sem_motorista: 'Veículos que ficaram sem motorista',
  manutencoes_ficaram_sem_tipo: 'Manutenções que ficaram sem tipo',
};

const APAGADOS = { abastecimentos: 'abastecimento(s)', manutencoes: 'manutenção(ões)', trocas_oleo: 'troca(s) de óleo', trocas_pneu: 'troca(s) de pneu' };

const DINHEIRO = new Set(['fuel_amount', 'price_per_liter', 'total_cost']);
const KM = new Set(['current_kilometers', 'next_tire_change', 'next_oil_change', 'fueling_kilometers',
  'oil_change_kilometers', 'tire_change_kilometers', 'maintenance_kilometers', 'recurrency']);
const LITROS = new Set(['liters_quantity']);
const SITUACAO = { active: 'Ativo', inactive: 'Inativo' };
const MODO = { km: 'Quilometragem', date: 'Tempo', both: 'Km e tempo' };


export const fmtDataHora = (v) => (v ? new Date(v).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'medium' }) : '—');

export function fmtCampo(campo, v, dados) {
  if (v === null || v === undefined || v === '') return '—';
  if (campo === 'apagados_junto' && typeof v === 'object') {
    const partes = Object.entries(v).filter(([, n]) => Number(n) > 0).map(([k, n]) => `${n} ${APAGADOS[k] ?? k}`);
    return partes.length ? partes.join(', ') : 'nada';
  }
  if (Array.isArray(v)) return v.join(', ');
  if (typeof v === 'object') return JSON.stringify(v);
  const id = String(v);
  if (campo === 'car_id') return dados?.veiculos?.find(x => String(x.id) === id)?.nome ?? `Veículo #${id}`;
  if (campo === 'driver_id') return dados?.nomes?.motoristas?.[id] ?? `Motorista #${id}`;
  if (campo === 'maintenance_type_id') return dados?.nomes?.tipos?.[id] ?? `Tipo #${id}`;
  if (campo === 'status') return SITUACAO[v] ?? id;
  if (campo === 'recurrence_mode') return MODO[v] ?? id;
  // DECIMAL chega como texto ("30.000" = 30 litros): formata para não parecer trinta mil
  if (KM.has(campo) && Number.isFinite(Number(v))) return `${Number(v).toLocaleString('pt-BR')} km`;
  if (LITROS.has(campo) && Number.isFinite(Number(v))) return `${Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 3 })} L`;
  if (DINHEIRO.has(campo) && Number.isFinite(Number(v))) return `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 3 })}`;
  const d = id.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (d) return `${d[3]}/${d[2]}/${d[1]}`;
  if (/^\d{4}-\d{2}-\d{2}T/.test(id)) return fmtDataHora(id);
  return id;
}

// Tabela "campo / valor" para cadastros e exclusões (mais legível que JSON cru)
export function TabelaDados({ titulo, valores, dados }) {
  const linhas = Object.entries(valores ?? {}).filter(([k]) => k !== 'id');
  if (!linhas.length) return null;
  return (
    <div className={a.bloco}>
      <span className={a.blocoTitulo}>{titulo}</span>
      <table className={a.diff}>
        <tbody>
          {linhas.map(([k, v]) => (
            <tr key={k}>
              <td>{k === 'created_at' ? 'Cadastrado em' : CAMPOS[k] ?? k.replace(/_/g, ' ')}</td>
              <td>{fmtCampo(k, v, dados)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Campos que mudaram numa edição/inativação: antes riscado, depois em destaque. */
export function TabelaAlteracoes({ item, dados }) {
  const campos = item.campos_alterados ? item.campos_alterados.split(',') : [];
  if (!campos.length) return null;
  return (
    <table className={a.diff}>
      <thead><tr><th>Campo</th><th>Antes</th><th>Depois</th></tr></thead>
      <tbody>
        {campos.map(c => (
          <tr key={c}>
            <td>{CAMPOS[c] ?? c}</td>
            <td className={a.antes}>{fmtCampo(c, item.dados_antes?.[c], dados)}</td>
            <td className={a.depois}>{fmtCampo(c, item.dados_depois?.[c], dados)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
