import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Botao } from '@/components/Botao';
import { Cartao } from '@/components/Cartao';
import { Segmento } from '@/components/Segmento';
import { TelaEtapa } from '@/components/TelaEtapa';
import { filtrarItens } from '@/domain/busca';
import type { Retirado } from '@/domain/etapas';
import { parseQuantidade } from '@/domain/quantidade';
import type { Unidade } from '@/domain/tipos';
import { useFinalizacao } from '@/estado/FinalizacaoProvider';
import { ALVO_MINIMO, espaco, fonte, raio, type Paleta } from '@/theme';
import { useCores, useEstilos } from '@/estado/tema';

const novaChave = () => `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
const ROTULO_UNIDADE: Record<Unidade, string> = { metros: 'm', pecas: 'un' };

/** Material retirado da rede: só informativo (o saldo do estoque não muda), mas a quantidade, a unidade e a condição são obrigatórias. */
export default function Retirados() {
  const cores = useCores();
  const s = useEstilos(criarEstilos);
  const f = useFinalizacao();
  const r = f.rascunho;
  const [adicionando, setAdicionando] = useState(false);
  const [busca, setBusca] = useState('');
  const [livre, setLivre] = useState<{ descricao: string; unidade: Unidade }>({ descricao: '', unidade: 'pecas' });
  const itens = filtrarItens(f.dados?.itens ?? [], busca).slice(0, 8);

  const definirPergunta = (v: 'sim' | 'nao') => f.alterar((x) => ({ ...x, materiais_retirados: v === 'sim', retirados: v === 'sim' ? x.retirados : [] }));
  const mudarLinha = (chave: string, parcial: Partial<Retirado>) => f.alterar((x) => ({ ...x, retirados: x.retirados.map((l) => (l.chave === chave ? { ...l, ...parcial } : l)) }));
  const removerLinha = (chave: string) => f.alterar((x) => ({ ...x, retirados: x.retirados.filter((l) => l.chave !== chave) }));
  const adicionar = (linha: Omit<Retirado, 'chave' | 'quantidade' | 'condicao'>) => {
    f.alterar((x) => ({ ...x, retirados: [...x.retirados, { ...linha, chave: novaChave(), quantidade: '', condicao: null }] }));
    setAdicionando(false); setBusca(''); setLivre({ descricao: '', unidade: 'pecas' });
  };
  const max = f.dados?.regras.retirados_max ?? 50;

  return (
    <TelaEtapa titulo="Materiais Retirados" concluida={f.concluidas.retirados}>
      <Cartao>
        <Text style={s.pergunta}>Algum material foi retirado da rede?</Text>
        <Segmento rotulo="Material retirado da rede" valor={r.materiais_retirados === null ? null : r.materiais_retirados ? 'sim' : 'nao'} desabilitado={!f.editavel} testID="retirados-pergunta"
          opcoes={[{ valor: 'sim', rotulo: 'Sim' }, { valor: 'nao', rotulo: 'Não' }]} onChange={definirPergunta} />
        <Text style={s.nota}>É só um registro do que saiu da rede: não muda o seu saldo de estoque.</Text>
      </Cartao>

      {r.materiais_retirados ? (
        <>
          {r.retirados.length === 0 ? <Text style={s.vazio}>Adicione ao menos um material retirado.</Text> : null}
          {r.retirados.map((l) => {
            const q = parseQuantidade(l.quantidade, l.unidade);
            return (
              <Cartao key={l.chave}>
                <View style={s.topo}>
                  <Text style={s.nome}>{l.descricao}</Text>
                  <Pressable onPress={() => removerLinha(l.chave)} accessibilityRole="button" accessibilityLabel={`Remover ${l.descricao}`} style={s.remover} disabled={!f.editavel} testID={`remover-${l.chave}`}>
                    <Ionicons name="trash-outline" size={26} color={cores.erro} />
                  </Pressable>
                </View>
                <View style={s.qtd}>
                  <TextInput testID={`qtd-${l.chave}`} accessibilityLabel={`Quantidade de ${l.descricao}`} keyboardType={l.unidade === 'pecas' ? 'number-pad' : 'decimal-pad'} editable={f.editavel} value={l.quantidade}
                    onChangeText={(t) => mudarLinha(l.chave, { quantidade: t })} placeholder="0" placeholderTextColor={cores.desabilitado} style={[s.campo, l.quantidade && !q.ok ? s.campoErro : null]} />
                  <Text style={s.unidade}>{ROTULO_UNIDADE[l.unidade]}</Text>
                </View>
                {l.quantidade && !q.ok ? <Text style={s.erro} accessibilityRole="alert">{q.erro}</Text> : null}
                <Segmento rotulo={`Condição de ${l.descricao}`} valor={l.condicao} desabilitado={!f.editavel} testID={`condicao-${l.chave}`}
                  opcoes={[{ valor: 'novo', rotulo: 'Novo' }, { valor: 'usado', rotulo: 'Usado' }]} onChange={(c) => mudarLinha(l.chave, { condicao: c })} />
                {!l.condicao ? <Text style={s.dica}>Informe se está novo ou usado.</Text> : null}
              </Cartao>
            );
          })}

          {r.retirados.length >= max ? <Text style={s.vazio}>Limite de {max} itens atingido.</Text> : adicionando ? (
            <Cartao titulo="Adicionar material retirado">
              <Text style={s.rotulo}>Do catálogo</Text>
              <TextInput testID="busca-catalogo" accessibilityLabel="Buscar no catálogo" value={busca} onChangeText={setBusca} placeholder="Buscar cabo, splitter, conector…" placeholderTextColor={cores.desabilitado} style={s.campoBusca} autoCorrect={false} />
              {itens.length === 0 ? <Text style={s.dica}>Nada encontrado. Use “Outro material” abaixo.</Text> : null}
              {itens.map((i) => (
                <Pressable key={i.id} testID={`catalogo-${i.id}`} onPress={() => adicionar({ item_id: i.id, descricao: i.nome, unidade: i.unidade })} accessibilityRole="button" accessibilityLabel={`${i.nome}, ${i.unidade === 'metros' ? 'metros' : 'unidades'}`}
                  disabled={r.retirados.some((l) => l.item_id === i.id)} style={({ pressed }) => [s.itemCatalogo, pressed && { opacity: 0.8 }, r.retirados.some((l) => l.item_id === i.id) && { opacity: 0.4 }]}>
                  <Text style={s.itemNome}>{i.nome}</Text>
                  <Text style={s.itemUn}>{i.unidade === 'metros' ? 'metros' : 'unidades'}</Text>
                </Pressable>
              ))}
              <Text style={[s.rotulo, { marginTop: espaco.md }]}>Outro material (descrever)</Text>
              <TextInput testID="descricao-livre" accessibilityLabel="Descrição do outro material" value={livre.descricao} onChangeText={(t) => setLivre((x) => ({ ...x, descricao: t }))} placeholder="Ex.: Splitter 1:8 antigo" placeholderTextColor={cores.desabilitado} style={s.campoBusca} />
              <Segmento rotulo="Unidade do outro material" valor={livre.unidade} testID="unidade-livre" opcoes={[{ valor: 'pecas', rotulo: 'Peças' }, { valor: 'metros', rotulo: 'Metros' }]} onChange={(u) => setLivre((x) => ({ ...x, unidade: u }))} />
              <Botao titulo="Adicionar este material" variante="secundario" desabilitado={livre.descricao.trim().length < 2} testID="adicionar-livre"
                onPress={() => adicionar({ item_id: null, descricao: livre.descricao.trim(), unidade: livre.unidade })} />
              <Botao titulo="Cancelar" variante="fantasma" onPress={() => setAdicionando(false)} />
            </Cartao>
          ) : (
            <Botao titulo="Adicionar material" variante="secundario" onPress={() => setAdicionando(true)} desabilitado={!f.editavel} testID="adicionar-material" />
          )}
        </>
      ) : null}
    </TelaEtapa>
  );
}

const criarEstilos = (cores: Paleta) => StyleSheet.create({
  pergunta: { fontSize: fonte.destaque, fontWeight: '700', color: cores.texto },
  nota: { fontSize: fonte.pequena + 1, color: cores.textoSuave, lineHeight: 20 },
  vazio: { fontSize: fonte.corpo, color: cores.textoSuave, textAlign: 'center' },
  topo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espaco.sm },
  nome: { flex: 1, fontSize: fonte.destaque, fontWeight: '700', color: cores.texto },
  remover: { width: ALVO_MINIMO, height: ALVO_MINIMO, alignItems: 'center', justifyContent: 'center' },
  qtd: { flexDirection: 'row', alignItems: 'center', gap: espaco.sm },
  campo: { flex: 1, minHeight: Math.max(ALVO_MINIMO, 56), borderWidth: 2, borderColor: cores.borda, borderRadius: raio.md, paddingHorizontal: espaco.md, fontSize: fonte.destaque + 2, color: cores.texto, backgroundColor: cores.superficie },
  campoErro: { borderColor: cores.erro },
  unidade: { fontSize: fonte.destaque, fontWeight: '700', color: cores.textoSuave, minWidth: 32 },
  erro: { fontSize: fonte.pequena + 1, color: cores.erro, fontWeight: '600' },
  dica: { fontSize: fonte.pequena + 1, color: cores.aviso, fontWeight: '600' },
  rotulo: { fontSize: fonte.corpo, fontWeight: '800', color: cores.primariaEscura },
  campoBusca: { minHeight: Math.max(ALVO_MINIMO, 56), borderWidth: 2, borderColor: cores.borda, borderRadius: raio.md, paddingHorizontal: espaco.md, fontSize: fonte.corpo + 1, color: cores.texto, backgroundColor: cores.superficie },
  itemCatalogo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 56, paddingHorizontal: espaco.md, borderRadius: raio.md, borderWidth: 1, borderColor: cores.borda, backgroundColor: cores.superficie, gap: espaco.sm },
  itemNome: { flex: 1, fontSize: fonte.corpo + 1, fontWeight: '600', color: cores.texto },
  itemUn: { fontSize: fonte.pequena + 1, color: cores.textoSuave },
});
