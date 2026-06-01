import React, { useState, useRef } from 'react';
import { RouterIcon, WifiIcon, ZapIcon, BarChart2Icon, TrashIcon, ClockIcon } from 'lucide-react';
import styles from './HotspotMikrotikConfig.module.css';

export default function HotspotMikrotikConfig() {
  const [tipoWan, setTipoWan] = useState('');
  const [habilitarBanda, setHabilitarBanda] = useState(false);
  const [habilitarRelatorio, setHabilitarRelatorio] = useState(true);
  const [habilitarLimpeza, setHabilitarLimpeza] = useState(false);
  const [configGerada, setConfigGerada] = useState('');
  const [showResult, setShowResult] = useState(false);

  const formRef = useRef(null);
  const resultRef = useRef(null);

  function gerarConfiguracao(form) {
    const identificacao = form.identificacao.value;
    const localizacao = form.localizacao.value;
    const interfaceWan = form.interfaceWan.value;
    const tipoWanVal = form.tipoWan.value;
    const fusoHorario = form.fusoHorario.value;

    const habBanda = form.habilitarBanda.checked;
    const velocidadeDown = form.velocidadeDown?.value ?? '';
    const velocidadeUp = form.velocidadeUp?.value ?? '';

    const habRelatorio = form.habilitarRelatorio.checked;
    const intervaloRelatorio = form.intervaloRelatorio?.value ?? '5m';

    const habLimpeza = form.habilitarLimpeza.checked;
    const intervaloLimpeza = form.intervaloLimpeza?.value ?? '7d';

    const agora = new Date();
    const data = agora.toLocaleDateString('pt-BR');
    const hora = agora.toLocaleTimeString('pt-BR');

    let c = '';
    c += '# =====================================================\n';
    c += '# Configuração Completa Hotspot MikroTik\n';
    c += '# Gerado por: CLUBE DE REDE - linktr.ee/clubederede\n';
    c += '# Data: ' + data + ', ' + hora + '\n';
    c += '# Sistema: ' + identificacao + '\n';
    if (localizacao) c += '# Localização: ' + localizacao + '\n';
    c += '# =====================================================\n';
    c += '# INSTRUÇÕES:\n';
    c += '# 1. Faça upload do arquivo default.rsc no MikroTik\n';
    c += '# 2. Cole este script completo no terminal\n';
    c += '# 3. Aguarde a execução automática\n';
    c += '# =====================================================\n\n';

    c += '# PASSO 1: Importando scripts base (default.rsc)\n';
    c += ':log info "Iniciando importacao do default.rsc..."\n';
    c += '/import default.rsc\n';
    c += ':delay 3s\n';
    c += ':log info "Scripts base importados com sucesso!"\n\n';

    c += '# PASSO 2: Aplicando configurações personalizadas\n';
    c += ':log info "Aplicando configuracoes personalizadas..."\n\n';

    c += '# Configuração WAN\n';
    c += ':log info "Configurando conexao WAN..."\n';
    if (tipoWanVal === 'dhcp') {
      c += '/ip dhcp-client\n';
      c += 'add interface=' + interfaceWan + '\n';
      c += ':log info "DHCP configurado na interface ' + interfaceWan + '"\n';
    } else if (tipoWanVal === 'pppoe') {
      const usuario = form.usuarioPppoe?.value ?? '';
      const senha = form.senhaPppoe?.value ?? '';
      if (usuario && senha) {
        c += '/interface pppoe-client\n';
        c += 'add add-default-route=yes disabled=no interface=' + interfaceWan + ' name=pppoe-out1 password=' + senha + ' user=' + usuario + '\n';
        c += ':log info "PPPoE configurado - Usuario: ' + usuario + '"\n';
      }
    } else if (tipoWanVal === 'static') {
      const ipStatic = form.ipStatic?.value ?? '';
      const gatewayStatic = form.gatewayStatic?.value ?? '';
      if (ipStatic && gatewayStatic) {
        c += '/ip address\n';
        c += 'add address=' + ipStatic + ' interface=' + interfaceWan + '\n';
        c += '/ip route\n';
        c += 'add distance=1 gateway=' + gatewayStatic + '\n';
        c += ':log info "IP Fixo configurado: ' + ipStatic + '"\n';
      }
    }
    c += '\n';

    if (habBanda && velocidadeDown && velocidadeUp) {
      c += '# Controle de Banda PCQ\n';
      c += ':log info "Configurando controle de banda..."\n';
      c += '/queue type\n';
      c += 'add kind=pcq name=Download pcq-classifier=dst-address pcq-rate=' + velocidadeDown + 'M\n';
      c += 'add kind=pcq name=Upload pcq-classifier=src-address pcq-rate=' + velocidadeUp + 'M\n';
      c += '/queue simple\n';
      c += 'add name=CONTROLE-HS queue=Upload/Download target=LAN\n';
      c += ':log info "Controle de banda configurado: ' + velocidadeDown + 'M/' + velocidadeUp + 'M"\n\n';
    }

    c += '# Schedulers (chamam scripts do default.rsc)\n';
    c += ':log info "Configurando schedulers automaticos..."\n';
    c += '/system scheduler\n';

    if (habRelatorio) {
      c += 'add interval=' + intervaloRelatorio + ' name=RELATORIO on-event=GeraRelatorio policy=ftp,reboot,read,write,policy,test,password,sniff,sensitive,romon start-time=startup\n';
      c += ':log info "Scheduler de relatorios configurado: ' + intervaloRelatorio + '"\n';
    }

    if (habLimpeza) {
      c += 'add interval=' + intervaloLimpeza + ' name=LIMPEZA_USUARIOS on-event=LimpaUsuarios policy=ftp,reboot,read,write,policy,test,password,sniff,sensitive,romon start-time=startup\n';
      c += ':log info "Scheduler de limpeza configurado: ' + intervaloLimpeza + '"\n';
    }
    c += '\n';

    c += '# Sistema\n';
    c += ':log info "Configurando sistema..."\n';
    c += '/system identity\n';
    c += 'set name="' + identificacao + '"\n';
    c += '/system clock\n';
    c += 'set time-zone-name=' + fusoHorario + '\n';
    c += ':log info "Sistema configurado - Nome: ' + identificacao + '"\n\n';

    c += '# CONFIGURAÇÃO CONCLUÍDA\n';
    c += ':delay 2s\n';
    c += ':log info "================================================"\n';
    c += ':log info "HOTSPOT MIKROTIK CONFIGURADO COM SUCESSO!"\n';
    c += ':log info "Sistema: ' + identificacao + '"\n';
    c += ':log info "Scripts base + configuracoes personalizadas aplicados"\n';
    c += ':log info "Proximo passo: /ip hotspot setup"\n';
    c += ':log info "================================================"\n';
    c += ':put "✅ CONFIGURAÇÃO CONCLUÍDA! Execute: /ip hotspot setup"\n\n';

    c += '# =====================================================\n';
    c += '# RESUMO DA CONFIGURAÇÃO APLICADA\n';
    c += '# =====================================================\n';
    c += '# ✅ Scripts base importados automaticamente\n';
    c += '# ✅ Conexão WAN configurada (' + tipoWanVal.toUpperCase() + ')\n';
    if (habBanda) c += '# ✅ Controle de banda ativo (' + velocidadeDown + 'M/' + velocidadeUp + 'M)\n';
    if (habRelatorio) c += '# ✅ Relatórios automáticos (' + intervaloRelatorio + ')\n';
    if (habLimpeza) c += '# ✅ Limpeza automática (' + intervaloLimpeza + ')\n';
    c += '# ✅ Sistema configurado (' + identificacao + ')\n';
    c += '# =====================================================\n';
    c += '# PRÓXIMOS PASSOS:\n';
    c += '# 1. Execute: /ip hotspot setup\n';
    c += '# 2. Adicione interfaces à bridge LAN\n';
    c += '# 3. Configure página de login (opcional)\n';
    c += '# =====================================================\n';

    return c;
  }

  function handleSubmit(e) {
    e.preventDefault();
    const form = formRef.current;
    if (!form.identificacao.value) { alert('❌ Nome do sistema é obrigatório!'); return; }
    if (!form.tipoWan.value) { alert('❌ Selecione o tipo de conexão WAN!'); return; }

    const config = gerarConfiguracao(form);
    setConfigGerada(config);
    setShowResult(true);

    setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    alert('✅ Configuração completa gerada!\n\n📋 INSTRUÇÕES:\n1. Faça upload do default.rsc no MikroTik\n2. Cole o script abaixo no terminal\n3. Aguarde a execução automática');
  }

  function togglePreview() {
    setShowResult(v => !v);
    if (!showResult) setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  }

  function copyConfig() {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(configGerada)
        .then(() => alert('✅ Script copiado! Cole no terminal do MikroTik.'))
        .catch(() => alert('❌ Erro ao copiar. Use Ctrl+C manualmente.'));
    } else {
      const ta = document.getElementById('configOutput');
      ta.select();
      ta.setSelectionRange(0, 99999);
      try { document.execCommand('copy'); alert('✅ Script copiado!'); }
      catch { alert('❌ Erro ao copiar. Use Ctrl+C manualmente.'); }
    }
  }

  return (
    <div className={styles.page}>

      {/* Page header */}
      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderIcon}>
          <RouterIcon size={22} />
        </div>
        <div className={styles.pageHeaderText}>
          <h1>Criar Config do Hotspot</h1>
          <p>Gera script MikroTik que importa o <code>default.rsc</code> e aplica configurações personalizadas</p>
        </div>
      </div>

      <form ref={formRef} onSubmit={handleSubmit}>

        {/* Brand + Identificação */}
        <div className={styles.card}>
          <div className={styles.brandRow}>
            <div className={styles.brandLogo}>
              <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2C6.486 2 2 6.486 2 12s4.486 10 10 10 10-4.486 10-10S17.514 2 12 2zm0 18c-4.411 0-8-3.589-8-8s3.589-8 8-8 8 3.589 8 8-3.589 8-8 8z"/>
                <circle cx="12" cy="8" r="3"/>
                <path d="M12 14c-2.5 0-4.71 1.28-6 3.22.65.44 1.39.78 2.2.78 1.6 0 2.8-1.2 2.8-2.8V14h2v1.2c0 1.6 1.2 2.8 2.8 2.8.81 0 1.55-.34 2.2-.78C16.71 15.28 14.5 14 12 14z"/>
              </svg>
            </div>
            <div className={styles.brandInfo}>
              <span className={styles.brandName}>CLUBE DE REDE</span>
              <a href="https://linktr.ee/clubederede" target="_blank" rel="noreferrer" className={styles.brandLink}>
                linktr.ee/clubederede
              </a>
            </div>
          </div>

          <div className={styles.cardHeader}>
            <div className={styles.cardHeaderIcon}><RouterIcon size={15} /></div>
            <h3>Identificação do Sistema</h3>
          </div>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="identificacao">Nome do Sistema</label>
              <input type="text" id="identificacao" name="identificacao" placeholder="Ex: HOTSPOT CLUBE DE REDE" required />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="localizacao">Localização (opcional)</label>
              <input type="text" id="localizacao" name="localizacao" placeholder="Ex: Centro - São Paulo/SP" />
            </div>
          </div>
        </div>

        {/* WAN */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={styles.cardHeaderIcon}><WifiIcon size={15} /></div>
            <h3>Conexão WAN</h3>
          </div>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="interfaceWan">Interface WAN</label>
              <input type="text" id="interfaceWan" name="interfaceWan" defaultValue="ether1" required />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="tipoWan">Tipo de Conexão</label>
              <select id="tipoWan" name="tipoWan" required value={tipoWan} onChange={e => setTipoWan(e.target.value)}>
                <option value="">Selecione...</option>
                <option value="dhcp">DHCP</option>
                <option value="pppoe">PPPoE</option>
                <option value="static">IP Fixo</option>
              </select>
            </div>
          </div>

          {tipoWan === 'pppoe' && (
            <div className={styles.subSection}>
              <p className={styles.subSectionTitle}>⚡ Configurações PPPoE</p>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label htmlFor="usuarioPppoe">Usuário</label>
                  <input type="text" id="usuarioPppoe" name="usuarioPppoe" placeholder="usuario@provedor.com" />
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="senhaPppoe">Senha</label>
                  <input type="password" id="senhaPppoe" name="senhaPppoe" placeholder="••••••••" />
                </div>
              </div>
            </div>
          )}

          {tipoWan === 'static' && (
            <div className={styles.subSection}>
              <p className={styles.subSectionTitle}>🔧 Configurações IP Fixo</p>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label htmlFor="ipStatic">IP/Máscara</label>
                  <input type="text" id="ipStatic" name="ipStatic" placeholder="192.168.1.10/24" />
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="gatewayStatic">Gateway</label>
                  <input type="text" id="gatewayStatic" name="gatewayStatic" placeholder="192.168.1.1" />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Controle de Banda */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={styles.cardHeaderIcon}><ZapIcon size={15} /></div>
            <h3>Controle de Banda</h3>
          </div>
          <div className={styles.checkboxRow}>
            <input type="checkbox" id="habilitarBanda" name="habilitarBanda" checked={habilitarBanda} onChange={e => setHabilitarBanda(e.target.checked)} />
            <label htmlFor="habilitarBanda">Habilitar controle de banda PCQ</label>
          </div>
          {habilitarBanda && (
            <div className={styles.subSection}>
              <p className={styles.subSectionTitle}>🚀 Velocidades PCQ</p>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label htmlFor="velocidadeDown">Download (Mbps)</label>
                  <input type="number" id="velocidadeDown" name="velocidadeDown" placeholder="100" min="1" />
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="velocidadeUp">Upload (Mbps)</label>
                  <input type="number" id="velocidadeUp" name="velocidadeUp" placeholder="50" min="1" />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Relatórios */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={styles.cardHeaderIcon}><BarChart2Icon size={15} /></div>
            <h3>Relatórios Automáticos</h3>
          </div>
          <div className={styles.checkboxRow}>
            <input type="checkbox" id="habilitarRelatorio" name="habilitarRelatorio" checked={habilitarRelatorio} onChange={e => setHabilitarRelatorio(e.target.checked)} />
            <label htmlFor="habilitarRelatorio">Gerar relatórios automáticos (chama <code>GeraRelatorio</code>)</label>
          </div>
          {habilitarRelatorio && (
            <div className={styles.subSection}>
              <p className={styles.subSectionTitle}>⏰ Frequência</p>
              <div className={styles.formGroup}>
                <label htmlFor="intervaloRelatorio">Intervalo</label>
                <select id="intervaloRelatorio" name="intervaloRelatorio" defaultValue="5m">
                  <option value="5m">5 minutos</option>
                  <option value="10m">10 minutos</option>
                  <option value="30m">30 minutos</option>
                  <option value="1h">1 hora</option>
                  <option value="6h">6 horas</option>
                  <option value="12h">12 horas</option>
                  <option value="24h">24 horas</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Limpeza */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={styles.cardHeaderIcon}><TrashIcon size={15} /></div>
            <h3>Limpeza Automática de Usuários</h3>
          </div>
          <div className={styles.checkboxRow}>
            <input type="checkbox" id="habilitarLimpeza" name="habilitarLimpeza" checked={habilitarLimpeza} onChange={e => setHabilitarLimpeza(e.target.checked)} />
            <label htmlFor="habilitarLimpeza">Limpeza automática (chama <code>LimpaUsuarios</code>)</label>
          </div>
          {habilitarLimpeza && (
            <div className={styles.subSection}>
              <p className={styles.subSectionTitle}>🕒 Frequência</p>
              <div className={styles.formGroup}>
                <label htmlFor="intervaloLimpeza">Intervalo</label>
                <select id="intervaloLimpeza" name="intervaloLimpeza" defaultValue="7d">
                  <option value="1d">1 dia</option>
                  <option value="3d">3 dias</option>
                  <option value="7d">7 dias</option>
                  <option value="15d">15 dias</option>
                  <option value="30d">30 dias</option>
                  <option value="90d">90 dias</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Sistema */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={styles.cardHeaderIcon}><ClockIcon size={15} /></div>
            <h3>Sistema</h3>
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="fusoHorario">Fuso Horário</label>
            <select id="fusoHorario" name="fusoHorario" defaultValue="America/Fortaleza">
              <option value="America/Fortaleza">America/Fortaleza (CE, MA, PI)</option>
              <option value="America/Recife">America/Recife (PE, AL, SE)</option>
              <option value="America/Bahia">America/Bahia (BA)</option>
              <option value="America/Sao_Paulo">America/Sao_Paulo (SP, RJ, MG, Sul)</option>
              <option value="America/Campo_Grande">America/Campo_Grande (MS)</option>
              <option value="America/Cuiaba">America/Cuiaba (MT)</option>
              <option value="America/Porto_Velho">America/Porto_Velho (RO, AC)</option>
              <option value="America/Manaus">America/Manaus (AM)</option>
            </select>
          </div>
          <p className={styles.hintText}>O nome do equipamento será o mesmo do campo "Nome do Sistema".</p>
        </div>

        {/* Actions */}
        <div className={styles.actionRow}>
          <button type="submit" className={styles.btnGenerate}>
            ⚙️ Gerar Configurações
          </button>
          <button type="button" className={styles.btnToggle} disabled={!configGerada} onClick={togglePreview}>
            {showResult ? '🔍 Ocultar' : '👁️ Mostrar'}
          </button>
        </div>
      </form>

      {showResult && (
        <div className={styles.resultCard} ref={resultRef}>
          <h3>⚙️ Configurações Personalizadas Geradas</h3>
          <textarea id="configOutput" className={styles.scriptOutput} readOnly value={configGerada} />
          <div className={styles.resultActions}>
            <button className={styles.btnCopy} onClick={copyConfig}>📋 Copiar Script</button>
          </div>
        </div>
      )}
    </div>
  );
}
