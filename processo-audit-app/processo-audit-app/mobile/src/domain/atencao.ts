import { fmtQtd } from './quantidade';
import { DIAS_MAX_OPERACAO, DIAS_MAX_REENVIO_FORCADO, SEM_OS, idadeEmDias, type Operacao } from './operacoes';

/**
 * Texto e ações da tela "Requer atenção" para cada operação que o servidor recusou. A mensagem do servidor sempre
 * aparece por inteiro; aqui só se acrescenta o que o técnico pode fazer a respeito.
 */
export type AcaoAtencao = 'tentar_de_novo' | 'enviar_mesmo_assim' | 'corrigir' | 'descartar' | 'voltar_a_editar';

export interface DescricaoAtencao {
  titulo: string; // o que era
  oQueFazer: string; // uma frase com o caminho
  acoes: AcaoAtencao[];
}

const TITULOS: Record<Operacao['tipo'], string> = {
  iniciar: 'Início da execução',
  lancamento: 'Lançamento de material',
  foto: 'Foto do serviço',
  remover_foto: 'Remoção de foto',
  finalizar: 'Finalização da OS',
  rascunho: 'Rascunho',
  devolucao: 'Devolução de material',
};

export const descreverAtencao = (op: Operacao, agora: number): DescricaoAtencao => {
  const titulo = TITULOS[op.tipo];
  const status = op.erro?.status ?? null;
  const dias = idadeEmDias(op.criado_em, agora);

  // parada por ser antiga (o app não envia às cegas): o servidor nem chegou a ser consultado
  if (status === null && dias > DIAS_MAX_OPERACAO && !op.forcada) {
    return dias > DIAS_MAX_REENVIO_FORCADO
      ? { titulo, oQueFazer: 'Fale com o escritório para conferir o que já foi registrado e descarte este item.', acoes: ['descartar'] }
      : { titulo, oQueFazer: 'Confira com o escritório se isto já foi registrado. Se não foi, envie mesmo assim.', acoes: ['enviar_mesmo_assim', 'descartar'] };
  }
  if (op.tipo === 'foto' && status === null) {
    return { titulo, oQueFazer: 'A foto não está mais no aparelho. Descarte este item e tire outra foto.', acoes: ['descartar'] };
  }
  if (op.tipo === 'finalizar') {
    if (status === 400) return { titulo, oQueFazer: 'Volte, corrija o que o servidor apontou e finalize de novo.', acoes: ['voltar_a_editar', 'tentar_de_novo'] };
    return { titulo, oQueFazer: 'A OS não aceita mais esta finalização. Fale com o escritório e descarte este item.', acoes: ['descartar'] };
  }
  if (op.tipo === 'devolucao') {
    if (status === 400) return { titulo, oQueFazer: 'O material que você tem mudou desde o último download. Descarte este pedido e faça outro com a quantidade certa, ou tente de novo se o estoque já ajustou.', acoes: ['tentar_de_novo', 'descartar'] };
    if (status === 403 || status === 404) return { titulo, oQueFazer: 'Este lote não está mais com você. Fale com o estoque e descarte este pedido.', acoes: ['descartar'] };
    return { titulo, oQueFazer: 'Tente de novo. Se continuar, fale com o estoque.', acoes: ['tentar_de_novo', 'descartar'] };
  }
  if (status === 403) return { titulo, oQueFazer: 'Esta OS não está mais com você. Fale com o escritório antes de continuar e descarte este item.', acoes: ['descartar'] };
  if (status === 404) return { titulo, oQueFazer: 'O servidor não encontrou esta OS. Fale com o escritório e descarte este item.', acoes: ['descartar'] };
  if (status === 409) return { titulo, oQueFazer: 'A OS já foi encerrada. Fale com o escritório e descarte este item.', acoes: ['descartar'] };
  if (op.tipo === 'lancamento') {
    return { titulo, oQueFazer: 'O estoque ou a OS mudou desde o último download. Corrija as quantidades ou descarte o lançamento.', acoes: ['corrigir', 'tentar_de_novo', 'descartar'] };
  }
  return { titulo, oQueFazer: 'Tente de novo. Se continuar, fale com o escritório.', acoes: ['tentar_de_novo', 'descartar'] };
};

/** Linha curta para a lista de atenção: a OS da operação ou, numa devolução, o material ("Cabo óptico · LOTE-BOB-0001 · 20 m"). */
export const rotuloDaOperacao = (op: Operacao): string =>
  op.tipo === 'devolucao' ? `${op.payload.exibicao.item_nome} · ${op.payload.exibicao.lote_codigo} · ${fmtQtd(op.payload.corpo.quantidade, op.payload.exibicao.unidade)}` : rotuloDaOS(op);

/** Linha curta para a lista: "OS #12 · Rota PL-900 → CEO-01". */
export const rotuloDaOS = (op: Pick<Operacao, 'os_id' | 'os_numero' | 'os_cliente'>): string =>
  op.os_id === SEM_OS ? 'Sem OS' : op.os_numero ? `OS #${op.os_numero}${op.os_cliente ? ` · ${op.os_cliente}` : ''}` : `OS ${op.os_id}`;
