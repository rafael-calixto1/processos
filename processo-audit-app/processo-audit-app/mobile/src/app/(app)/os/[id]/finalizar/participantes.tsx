import { Text, View } from 'react-native';
import { EstadoVazio } from '@/components/EstadoVazio';
import { LinhaOpcao } from '@/components/LinhaOpcao';
import { TelaEtapa } from '@/components/TelaEtapa';
import { useFinalizacao } from '@/estado/FinalizacaoProvider';
import { cores, espaco, fonte } from '@/theme';

export default function Participantes() {
  const f = useFinalizacao();
  const equipe = f.dados?.tecnicos ?? [];
  const max = f.dados?.regras.participantes_max ?? 20;
  const marcados = f.rascunho.participantes;
  const alternar = (id: number) => f.alterar((r) => ({ ...r, participantes: r.participantes.includes(id) ? r.participantes.filter((x) => x !== id) : r.participantes.length >= max ? r.participantes : [...r.participantes, id] }));
  return (
    <TelaEtapa titulo="Participantes" concluida={undefined}>
      <Text style={{ fontSize: fonte.corpo, color: cores.textoSuave, lineHeight: 22 }}>Marque quem ajudou nesta OS. Esta etapa é opcional.</Text>
      {equipe.length === 0 ? (
        <EstadoVazio icone="people-outline" titulo="Nenhum outro técnico cadastrado" texto="A lista vem do servidor. Conecte-se à internet uma vez e atualize os dados." />
      ) : (
        <View style={{ gap: espaco.sm }}>
          {equipe.map((t) => (
            <LinhaOpcao key={t.id} tipo="check" rotulo={t.nome} detalhe={t.tipo === 'terceirizado' ? `Terceirizado${t.empresa ? ` · ${t.empresa}` : ''}` : 'Interno'} selecionado={marcados.includes(t.id)} desabilitado={!f.editavel}
              testID={`participante-${t.id}`} onPress={() => alternar(t.id)} />
          ))}
        </View>
      )}
    </TelaEtapa>
  );
}
