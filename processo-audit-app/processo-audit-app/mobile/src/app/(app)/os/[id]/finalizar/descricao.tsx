import { StyleSheet, Text, TextInput } from 'react-native';
import { Cartao } from '@/components/Cartao';
import { TelaEtapa } from '@/components/TelaEtapa';
import { useFinalizacao } from '@/estado/FinalizacaoProvider';
import { cores, espaco, fonte, raio } from '@/theme';

export default function Descricao() {
  const f = useFinalizacao();
  const min = f.dados?.regras.descricao_min_caracteres ?? 11;
  const max = f.dados?.regras.descricao_max_caracteres ?? 5000;
  const n = f.rascunho.descricao.trim().length;
  const ok = n >= min;
  return (
    <TelaEtapa titulo="Descrição" concluida={f.concluidas.descricao}>
      <Cartao>
        <Text style={s.rotulo}>O que foi executado em campo?</Text>
        <TextInput
          testID="campo-descricao" accessibilityLabel="Descrição do que foi executado" multiline value={f.rascunho.descricao} maxLength={max} editable={f.editavel}
          onChangeText={(t) => f.alterar((r) => ({ ...r, descricao: t }))} placeholder="Ex.: Lançados 350 m de ASU 12F entre PL-0932 e CEO-03; fusões 1 a 8 e CEO vedada."
          placeholderTextColor={cores.desabilitado} textAlignVertical="top" style={s.campo}
        />
        <Text style={[s.contador, { color: ok ? cores.sucesso : cores.erro }]} accessibilityRole="alert" testID="contador-descricao">
          {ok ? `${n} caracteres` : n === 0 ? `Escreva ao menos ${min} caracteres` : `${n} caracteres: faltam ${min - n} para chegar ao mínimo de ${min}`}
        </Text>
      </Cartao>
    </TelaEtapa>
  );
}
const s = StyleSheet.create({
  rotulo: { fontSize: fonte.destaque, fontWeight: '700', color: cores.texto },
  campo: { minHeight: 200, borderWidth: 2, borderColor: cores.borda, borderRadius: raio.md, padding: espaco.md, fontSize: fonte.destaque, color: cores.texto, backgroundColor: cores.superficie },
  contador: { fontSize: fonte.corpo, fontWeight: '700' },
});
