import { useEffect, useState } from 'react';
import { Linking, StyleSheet, Text, TextInput, View } from 'react-native';
import { mensagemDeErro } from '@/api/erros';
import type { PontoGeocodificado } from '@/api/endpoints';
import { Botao } from '@/components/Botao';
import { Cartao } from '@/components/Cartao';
import { Faixa } from '@/components/Faixa';
import { LinhaOpcao } from '@/components/LinhaOpcao';
import { MapaLocal } from '@/components/MapaLocal';
import { TelaEtapa } from '@/components/TelaEtapa';
import { ErroLocalizacao, localDoEndereco, localDoGps, localDoPoste, qualidadeDaPrecisao, rotuloOrigem, type SugestaoEndereco } from '@/domain/localizacao';
import { urlDoPonto } from '@/domain/mapa';
import { useApp } from '@/estado/AppProvider';
import { useFinalizacao } from '@/estado/FinalizacaoProvider';
import { capturarPosicao } from '@/estado/localizacao';
import { useOnline } from '@/estado/rede';
import { ALVO_MINIMO, cores, espaco, fonte, raio } from '@/theme';

/** Onde o serviço foi feito: GPS (com a precisão à vista), coordenadas do poste (funciona sem sinal) ou busca de endereço (precisa de internet). */
export default function Local() {
  const f = useFinalizacao();
  const { api, servidor } = useApp();
  const online = useOnline();
  const urlServidor = servidor?.url?.();
  const origemDoServidor = urlServidor ? new URL(urlServidor).origin : undefined;
  const [obtendo, setObtendo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [simulado, setSimulado] = useState(false);
  const [texto, setTexto] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [sugestoes, setSugestoes] = useState<SugestaoEndereco[] | null>(null);
  const [rua, setRua] = useState<{ chave: string; estado: 'buscando' | 'nao_achou' | 'erro' } | null>(null);
  const [tentativa, setTentativa] = useState(0);

  const local = f.rascunho.local;
  const poste = f.os ? localDoPoste(f.os) : null;
  const qualidade = local?.origem === 'gps' ? qualidadeDaPrecisao(local.precisao_m) : null;
  const definir = (l: NonNullable<typeof local>) => f.alterar((r) => ({ ...r, local: l }));
  const chave = local ? `${local.lat.toFixed(6)},${local.lng.toFixed(6)}` : null;

  // Nome da rua do ponto (GPS ou poste): consulta reversa pelo servidor, só com internet. O resultado é guardado no local para ir no fechamento.
  useEffect(() => {
    if (!local || !chave || local.origem === 'address' || local.endereco || !online) return;
    let ativo = true;
    setRua({ chave, estado: 'buscando' });
    api.buscarEndereco(`${local.lat.toFixed(6)}, ${local.lng.toFixed(6)}`).then((itens) => {
      if (!ativo) return;
      const i = itens[0];
      if (!i || !(i.logradouro || i.bairro || i.cidade)) { setRua({ chave, estado: 'nao_achou' }); return; }
      setRua(null);
      f.alterar((r) => (r.local && r.local.lat === local.lat && r.local.lng === local.lng && !r.local.endereco ? { ...r, local: { ...r.local, endereco: i.label } } : r));
    }).catch(() => { if (ativo) setRua({ chave, estado: 'erro' }); });
    return () => { ativo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave, online, tentativa, local?.endereco]);

  const abrirNoMapa = async () => {
    if (!local) return;
    try { await Linking.openURL(urlDoPonto(local.lat, local.lng)); } catch { setErro('Não foi possível abrir o app de mapas neste aparelho.'); }
  };

  const gps = async () => {
    setErro(null); setObtendo(true);
    try {
      const pos = await capturarPosicao();
      setSimulado(Boolean(pos.simulado));
      definir(localDoGps(pos));
    } catch (e) {
      setErro(e instanceof ErroLocalizacao ? e.message : mensagemDeErro(e));
    } finally { setObtendo(false); }
  };

  const buscar = async () => {
    setErro(null); setSugestoes(null);
    if (texto.trim().length < 3) { setErro('Digite ao menos 3 letras ou números: CEP, rua com número ou as coordenadas.'); return; }
    setBuscando(true);
    try { setSugestoes(await api.buscarEndereco(texto.trim())); } catch (e) { setErro(mensagemDeErro(e)); } finally { setBuscando(false); }
  };

  const escolher = async (s: SugestaoEndereco) => {
    setErro(null); setBuscando(true);
    try {
      let ponto: PontoGeocodificado = { latitude: s.latitude, longitude: s.longitude, aproximado: false };
      if (ponto.latitude == null || ponto.longitude == null) ponto = await api.geocodificar({ street: s.logradouro, numero: s.numero, city: s.cidade, uf: s.uf, cep: s.cep, bairro: s.bairro });
      if (ponto.latitude == null || ponto.longitude == null) { setErro('Não foi possível localizar esse endereço no mapa. Escolha outro, use o GPS ou as coordenadas do poste.'); return; }
      definir(localDoEndereco({ lat: ponto.latitude, lng: ponto.longitude, rotulo: s.label, aproximado: ponto.aproximado }));
      setSugestoes(null); setTexto('');
    } catch (e) { setErro(mensagemDeErro(e)); } finally { setBuscando(false); }
  };

  return (
    <TelaEtapa titulo="Local do Endereço" concluida={f.concluidas.local}>
      <Cartao titulo="Local da intervenção">
        {local ? (
          <View style={{ gap: espaco.xs }} accessible accessibilityLabel={`Local registrado: ${local.lat.toFixed(5)}, ${local.lng.toFixed(5)}. ${rotuloOrigem(local)}`}>
            <Text style={s.coordenadas} testID="local-coordenadas">{local.lat.toFixed(5)}, {local.lng.toFixed(5)}</Text>
            <Text style={s.origem} testID="local-origem">{rotuloOrigem(local)}</Text>
            {local.endereco ? <Text style={s.endereco} testID="local-endereco">{local.origem === 'address' ? local.endereco : `Perto de: ${local.endereco}`}</Text> : null}
            {local.origem !== 'address' && !local.endereco ? (
              !online ? <Text style={s.nota} testID="rua-sem-conexao">O nome da rua aparece quando houver internet. As coordenadas já estão guardadas.</Text>
                : rua?.estado === 'buscando' ? <Text style={s.nota} testID="rua-buscando">Buscando o nome da rua…</Text>
                : rua?.estado === 'nao_achou' ? <Text style={s.nota} testID="rua-nao-achou">Não encontramos o nome da rua para este ponto (pode ser estrada ou rua fora do mapa). As coordenadas valem do mesmo jeito.</Text>
                : rua?.estado === 'erro' ? <Text style={s.nota} testID="rua-erro">Não foi possível buscar o nome da rua agora.</Text> : null
            ) : null}
            {rua?.estado === 'erro' && online && !local.endereco ? <Botao titulo="Tentar de novo" variante="fantasma" onPress={() => setTentativa((t) => t + 1)} testID="rua-tentar" /> : null}
          </View>
        ) : <Text style={s.vazio}>Nenhuma posição registrada ainda.</Text>}
      </Cartao>
      {local ? (
        <>
          <MapaLocal lat={local.lat} lng={local.lng} precisaoM={local.origem === 'gps' ? local.precisao_m : null} online={online} origem={origemDoServidor} />
          <Botao titulo="Abrir no app de mapas" variante="secundario" onPress={() => void abrirNoMapa()} testID="botao-abrir-mapa" />
        </>
      ) : null}
      {qualidade === 'ruim' ? <Faixa tom="aviso" icone="warning-outline" texto={`Precisão baixa (${local?.precisao_m} m). Se puder, vá para um lugar aberto e capture de novo.`} /> : null}
      {qualidade === 'media' ? <Faixa tom="info" icone="information-circle-outline" texto={`Precisão razoável (${local?.precisao_m} m). Serve para o registro; capture de novo se quiser mais exatidão.`} /> : null}
      {local?.origem === 'address' && local.aproximado ? <Faixa tom="aviso" icone="warning-outline" texto="Posição aproximada: a rua não está no mapa. Se puder, confirme pelo GPS no local." /> : null}
      {simulado && local?.origem === 'gps' ? <Faixa tom="aviso" icone="flask-outline" texto="SIMULAÇÃO: esta pré-visualização no navegador não tem GPS. No celular a posição é a real." /> : null}
      {erro ? <Faixa tom="erro" texto={erro} /> : null}

      <Botao titulo={obtendo ? 'Obtendo GPS…' : 'Capturar posição por GPS'} onPress={gps} carregando={obtendo} desabilitado={!f.editavel} testID="botao-gps" />
      {poste ? <Botao titulo={`Usar coordenadas do ${f.os?.poste_id ?? 'local da OS'}`} variante="secundario" onPress={() => definir(poste)} desabilitado={!f.editavel} testID="botao-poste" /> : <Text style={s.nota}>Esta OS não tem coordenadas do poste.</Text>}

      <Cartao titulo="Ou escolha pelo endereço">
        {!online ? (
          <Faixa tom="aviso" icone="cloud-offline-outline" texto="Sem conexão: a busca de endereço precisa de internet. Use o GPS ou as coordenadas do poste." />
        ) : (
          <>
            <TextInput testID="campo-endereco" accessibilityLabel="Buscar endereço" value={texto} onChangeText={setTexto} editable={f.editavel} placeholder="CEP, rua com número ou lat, lng" placeholderTextColor={cores.desabilitado}
              returnKeyType="search" onSubmitEditing={() => void buscar()} autoCorrect={false} style={s.campo} />
            <Botao titulo={buscando ? 'Buscando…' : 'Buscar endereço'} variante="secundario" onPress={buscar} carregando={buscando} desabilitado={!f.editavel} testID="botao-buscar" />
            {sugestoes && sugestoes.length === 0 ? <Text style={s.nota}>Nenhum endereço encontrado. Confira o texto ou use o GPS.</Text> : null}
            {sugestoes?.map((x, i) => <LinhaOpcao key={`${x.label}-${i}`} tipo="radio" rotulo={x.label} selecionado={false} onPress={() => void escolher(x)} testID={`sugestao-${i}`} desabilitado={buscando} />)}
          </>
        )}
      </Cartao>
    </TelaEtapa>
  );
}

const s = StyleSheet.create({
  coordenadas: { fontSize: fonte.grande, fontWeight: '800', color: cores.primariaEscura },
  origem: { fontSize: fonte.corpo + 1, fontWeight: '700', color: cores.texto },
  endereco: { fontSize: fonte.corpo, color: cores.textoSuave, lineHeight: 22 },
  vazio: { fontSize: fonte.corpo, color: cores.textoSuave },
  nota: { fontSize: fonte.pequena + 1, color: cores.textoSuave, lineHeight: 20 },
  campo: { minHeight: Math.max(ALVO_MINIMO, 56), borderWidth: 2, borderColor: cores.borda, borderRadius: raio.md, paddingHorizontal: espaco.md, fontSize: fonte.corpo + 1, color: cores.texto, backgroundColor: cores.superficie },
});
