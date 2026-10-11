import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Cartao } from '@/components/Cartao';
import { EstadoVazio } from '@/components/EstadoVazio';
import { Segmento } from '@/components/Segmento';
import { TelaEtapa } from '@/components/TelaEtapa';
import { erroChecklist } from '@/domain/resumoEtapas';
import { useFinalizacao } from '@/estado/FinalizacaoProvider';
import { ALVO_MINIMO, cores, espaco, fonte, raio } from '@/theme';

export default function Checklist() {
  const f = useFinalizacao();
  const itens = f.dados?.checklist ?? [];
  const definir = (codigo: string, valor: boolean | string) => f.alterar((r) => ({ ...r, checklist: { ...r.checklist, [codigo]: valor } }));
  return (
    <TelaEtapa titulo="Checklists" concluida={f.concluidas.checklist}>
      {itens.length === 0 ? (
        <EstadoVazio icone="checkbox-outline" titulo="Nenhum item de checklist" texto="Esta etapa não tem perguntas. Pode seguir." />
      ) : (
        <Cartao>
          {itens.map((item) => {
            const v = f.rascunho.checklist[item.codigo];
            const erro = erroChecklist(item, v);
            return (
              <View key={item.codigo} style={s.item}>
                <Text style={s.rotulo}>{item.rotulo}{item.obrigatorio ? <Text style={s.obrig}>  * obrigatório</Text> : <Text style={s.opc}>  (opcional)</Text>}</Text>
                {item.tipo === 'boolean' ? (
                  <Segmento rotulo={item.rotulo} valor={typeof v === 'boolean' ? (v ? 'sim' : 'nao') : null} desabilitado={!f.editavel} testID={`check-${item.codigo}`}
                    opcoes={[{ valor: 'sim', rotulo: 'Sim' }, { valor: 'nao', rotulo: 'Não' }]} onChange={(x) => definir(item.codigo, x === 'sim')} />
                ) : item.tipo === 'number' ? (
                  <View style={s.numero}>
                    <TextInput testID={`check-${item.codigo}`} accessibilityLabel={item.rotulo} keyboardType="decimal-pad" editable={f.editavel} value={v === undefined ? '' : String(v)} placeholder="0" placeholderTextColor={cores.desabilitado}
                      onChangeText={(t) => definir(item.codigo, t)} style={[s.campo, erro ? s.campoErro : null]} />
                    {item.unidade ? <Text style={s.unidade}>{item.unidade}</Text> : null}
                  </View>
                ) : (
                  <TextInput testID={`check-${item.codigo}`} accessibilityLabel={item.rotulo} multiline editable={f.editavel} value={typeof v === 'string' ? v : ''} onChangeText={(t) => definir(item.codigo, t)} textAlignVertical="top"
                    style={[s.campo, s.texto]} placeholderTextColor={cores.desabilitado} />
                )}
                {erro ? <Text style={s.erro} accessibilityRole="alert">{erro}</Text> : null}
              </View>
            );
          })}
        </Cartao>
      )}
    </TelaEtapa>
  );
}
const s = StyleSheet.create({
  item: { gap: espaco.sm, paddingVertical: espaco.sm },
  rotulo: { fontSize: fonte.destaque, fontWeight: '700', color: cores.texto },
  obrig: { fontSize: fonte.pequena, color: cores.erro, fontWeight: '800' },
  opc: { fontSize: fonte.pequena, color: cores.textoSuave, fontWeight: '600' },
  numero: { flexDirection: 'row', alignItems: 'center', gap: espaco.sm },
  campo: { flex: 1, minHeight: Math.max(ALVO_MINIMO, 56), borderWidth: 2, borderColor: cores.borda, borderRadius: raio.md, paddingHorizontal: espaco.md, fontSize: fonte.destaque + 2, color: cores.texto, backgroundColor: cores.superficie },
  campoErro: { borderColor: cores.erro },
  texto: { minHeight: 110, paddingTop: espaco.sm },
  unidade: { fontSize: fonte.destaque, fontWeight: '700', color: cores.textoSuave, minWidth: 32 },
  erro: { fontSize: fonte.pequena + 1, color: cores.erro, fontWeight: '600' },
});
