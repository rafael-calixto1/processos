import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { enderecoLinha, PRIORIDADE_LABEL, redeLinha, slaInfo, STATUS_LABEL, isPendente, type EstadoSla } from '@/domain/os';
import type { OSVisao } from '@/domain/visao';
import { cores, espaco, fonte, raio, type Tom } from '@/theme';
import { IndicadorSync, textoSync } from './IndicadorSync';
import { Selo } from './Selo';

const TOM_SLA: Record<EstadoSla, Tom> = { estourado: 'erro', em_risco: 'aviso', no_prazo: 'sucesso', sem_prazo: 'neutro' };
const TOM_STATUS: Record<OSVisao['status'], Tom> = { aberta: 'info', em_andamento: 'marca', concluida: 'sucesso', cancelada: 'neutro' };

/** Linha da lista "Minhas OS": número, cliente, prazo, prioridade e onde fica. Toda a área é um alvo de toque. */
export function CartaoOS({ os, onPress, agora }: { os: OSVisao; onPress: () => void; agora?: number }) {
  const pendente = isPendente(os.status);
  const sla = slaInfo(os.prazo, agora);
  const local = enderecoLinha(os);
  const rede = redeLinha(os);
  const resumo = `OS ${os.numero}, ${os.cliente}, ${STATUS_LABEL[os.status]}${pendente ? `, ${sla.label}` : ''}, ${textoSync(os.sync, os.pendencias)}`;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={resumo} style={({ pressed }) => [s.cartao, pressed && s.pressionado]}>
      <View style={s.topo}>
        <Text style={s.numero}>OS #{os.numero}</Text>
        <View style={s.selos}>
          {os.prioridade === 'alta' ? <Selo texto="Alta" tom="erro" icone="flame-outline" /> : null}
          <Selo texto={STATUS_LABEL[os.status]} tom={TOM_STATUS[os.status]} />
        </View>
      </View>
      <Text style={s.cliente} numberOfLines={2}>{os.cliente}</Text>
      {os.tipo_servico ? <Text style={s.tipo}>{os.tipo_servico}</Text> : null}
      {local ? <Linha icone="location-outline" texto={local} /> : null}
      {rede ? <Linha icone="git-network-outline" texto={rede} /> : null}
      <IndicadorSync estado={os.sync} pendencias={os.pendencias} />
      <View style={s.rodape}>
        {pendente ? <Selo texto={sla.label} tom={TOM_SLA[sla.estado]} icone="time-outline" /> : <Text style={s.prio}>Prioridade {PRIORIDADE_LABEL[os.prioridade]}</Text>}
        <Ionicons name="chevron-forward" size={22} color={cores.desabilitado} />
      </View>
    </Pressable>
  );
}

function Linha({ icone, texto }: { icone: keyof typeof Ionicons.glyphMap; texto: string }) {
  return (
    <View style={s.linha}>
      <Ionicons name={icone} size={16} color={cores.textoSuave} />
      <Text style={s.linhaTexto} numberOfLines={2}>{texto}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  cartao: { backgroundColor: cores.superficie, borderRadius: raio.lg, borderWidth: 1, borderColor: cores.borda, padding: espaco.lg, gap: espaco.sm },
  pressionado: { backgroundColor: cores.primariaClara },
  topo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: espaco.sm, flexWrap: 'wrap' },
  selos: { flexDirection: 'row', gap: espaco.xs, flexWrap: 'wrap' },
  numero: { fontSize: fonte.destaque, fontWeight: '800', color: cores.primariaEscura },
  cliente: { fontSize: fonte.corpo + 1, fontWeight: '700', color: cores.texto, lineHeight: 24 },
  tipo: { fontSize: fonte.pequena + 1, color: cores.textoSuave, fontWeight: '600' },
  linha: { flexDirection: 'row', gap: espaco.xs, alignItems: 'flex-start' },
  linhaTexto: { flex: 1, fontSize: fonte.pequena + 1, color: cores.textoSuave, lineHeight: 20 },
  rodape: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: espaco.xs },
  prio: { fontSize: fonte.pequena + 1, color: cores.textoSuave },
});
