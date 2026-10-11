import { View } from 'react-native';
import { EstadoVazio } from '@/components/EstadoVazio';
import { LinhaOpcao } from '@/components/LinhaOpcao';
import { TelaEtapa } from '@/components/TelaEtapa';
import { useFinalizacao } from '@/estado/FinalizacaoProvider';
import { espaco } from '@/theme';

export default function Motivo() {
  const f = useFinalizacao();
  const motivos = f.dados?.motivos ?? [];
  return (
    <TelaEtapa titulo="Motivo de Fechamento" concluida={f.concluidas.motivo}>
      {motivos.length === 0 ? (
        <EstadoVazio icone="list-outline" titulo="Nenhum motivo disponível" texto="Os motivos vêm do servidor. Conecte-se à internet uma vez e atualize os dados." />
      ) : (
        <View style={{ gap: espaco.sm }} accessibilityRole="radiogroup" accessibilityLabel="Motivo de fechamento">
          {motivos.map((m) => (
            <LinhaOpcao key={m.id} tipo="radio" rotulo={m.rotulo} selecionado={f.rascunho.motivo_codigo === m.codigo} desabilitado={!f.editavel} testID={`motivo-${m.codigo}`}
              onPress={() => f.alterar((r) => ({ ...r, motivo_codigo: m.codigo }))} />
          ))}
        </View>
      )}
    </TelaEtapa>
  );
}
