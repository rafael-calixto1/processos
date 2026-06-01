import React, { useState, useRef } from 'react';
import { Plug, Link2, Settings, AlertTriangle, Code2 } from 'lucide-react';
import styles from './HotspotGoogleSheets.module.css';

const HotspotGoogleSheets = () => {
  const [url, setUrl] = useState('');
  const [enviarCadastros, setEnviarCadastros] = useState(true);
  const [enviarLogs, setEnviarLogs] = useState(true);
  const [intervalo, setIntervalo] = useState('1m');
  const [script, setScript] = useState('');
  const [showResult, setShowResult] = useState(false);
  const scriptRef = useRef(null);

  function criarScript(scriptUrl, cadastros, logs, intervaloVal) {
    const agora = new Date();
    let s = `# =====================================================
# INTEGRAÇÃO GOOGLE SHEETS - ${agora.toLocaleString('pt-BR')}
# CLUBE DE REDE - linktr.ee/clubederede
# =====================================================
# VERSÃO 3.2 - SISTEMA COMPLETO COM AUTOMAÇÕES
# - Sistema anti-duplicatas por contador (usuários)
# - Sistema anti-duplicatas por timestamp (logs)
# - Backup automático mensal dos logs
# - Script pós-reboot para evitar duplicatas
# - Logs incluem IP do dispositivo
# - CORREÇÃO: Encoding URL para nomes com espaços
# =====================================================

# Remove scripts e schedulers antigos
/system script remove [find name~"GoogleSheets-"]
/system script remove [find name~"UsuariosComMemoria"]
/system script remove [find name~"LogsFinal"]
/system script remove [find name~"TesteUsuarios"]
/system script remove [find name~"UsuariosPorContador"]
/system script remove [find name~"LogsRapido"]
/system scheduler remove [find name~"SHEETS_"]

`;

    const urlEncodeBlock = `
    # Função para encoding URL (caracteres especiais)
    :local urlEncode do={
        :local input $1
        :local output ""
        :local length [:len $input]

        :for i from=0 to=($length - 1) do={
            :local char [:pick $input $i ($i + 1)]

            :if ($char = " ") do={
                :set output ($output . "%20")
            } else={
                :if ($char = "&") do={
                    :set output ($output . "%26")
                } else={
                    :if ($char = "=") do={
                        :set output ($output . "%3D")
                    } else={
                        :if ($char = "+") do={
                            :set output ($output . "%2B")
                        } else={
                            :if ($char = "#") do={
                                :set output ($output . "%23")
                            } else={
                                :if ($char = "?") do={
                                    :set output ($output . "%3F")
                                } else={
                                    :if ($char = "%") do={
                                        :set output ($output . "%25")
                                    } else={
                                        :set output ($output . $char)
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        :return $output
    }`;

    if (cadastros) {
      s += `# ================================================
# SCRIPT USUÁRIOS - ANTI-DUPLICATAS POR CONTADOR
# ================================================
/system script add name=GoogleSheets-UsuariosFinal source={
    :global totalUsuariosEnviados
    :if ([:typeof $totalUsuariosEnviados] = "nothing") do={
        :set totalUsuariosEnviados 0
    }

    :local url "${scriptUrl}"
${urlEncodeBlock}

    # Conta usuarios validos AGORA
    :local totalAtual 0
    :foreach user in=[/ip hotspot user find where !default] do={
        :local telefone [/ip hotspot user get $user name]
        :if ([:find $telefone "default"] < 0 && [:find $telefone "trial"] < 0) do={
            :set totalAtual ($totalAtual + 1)
        }
    }

    # Se tem usuarios novos
    :if ($totalAtual > $totalUsuariosEnviados) do={
        :local count 0
        :foreach user in=[/ip hotspot user find where !default] do={
            :local telefone [/ip hotspot user get $user name]
            :local nome [/ip hotspot user get $user comment]

            :if ([:find $telefone "default"] < 0 && [:find $telefone "trial"] < 0) do={
                :set count ($count + 1)

                :if ($count > $totalUsuariosEnviados) do={
                    :if ([:len $nome] = 0) do={ :set nome $telefone }

                    :local nomeEncoded [$urlEncode $nome]
                    :local telefoneEncoded [$urlEncode $telefone]

                    :do {
                        /tool fetch url=($url . "?sheet=USUARIOS&NOME=" . $nomeEncoded . "&TELEFONE=" . $telefoneEncoded) keep-result=no
                        :log info ("Usuario enviado: " . $telefone . " - " . $nome)
                    } on-error={
                        :log error ("Erro ao enviar usuario: " . $telefone)
                    }
                    :delay 1s
                }
            }
        }

        :set totalUsuariosEnviados $totalAtual
    }
}

/system scheduler add interval=${intervaloVal} name=SHEETS_USUARIOS_FINAL on-event="GoogleSheets-UsuariosFinal" start-time=startup

`;
    }

    if (logs) {
      s += `# ================================================
# SCRIPT LOGS - ANTI-DUPLICATAS COM IP
# ================================================
/system script add name=GoogleSheets-LogsFinal source={
    :global ultimoLogProcessado
    :if ([:typeof $ultimoLogProcessado] = "nothing") do={
        :set ultimoLogProcessado ""
    }

    :local url "${scriptUrl}"
${urlEncodeBlock}

    :local todosLogs [/log find where topics~"hotspot" and (message~"logged in" or message~"logged out")]
    :local totalLogs [:len $todosLogs]

    :if ($totalLogs > 0) do={
        :local ultimoLog [:pick $todosLogs ($totalLogs - 1)]
        :local logEntry [/log get $ultimoLog]
        :local message ($logEntry->"message")
        :local time ($logEntry->"time")
        :local logId ($message . "-" . [:tostr $time])

        :if ($ultimoLogProcessado = $logId) do={
            # Ja processado - nao faz nada
        } else={
            :local userEndPos [:find $message " ("]
            :local ipStartPos [:find $message "("]
            :local ipEndPos [:find $message "):"]

            :if ($userEndPos >= 0 && $ipStartPos >= 0 && $ipEndPos >= 0) do={
                :local telefone [:pick $message 0 $userEndPos]
                :local ip [:pick $message ($ipStartPos + 1) $ipEndPos]

                :local status "conectou"
                :if ([:find $message "logged out"] >= 0) do={ :set status "desconectou" }

                :local statusComIP ($status . "-" . $ip)

                :set ultimoLogProcessado $logId

                :local telefoneEncoded [$urlEncode $telefone]
                :local statusEncoded [$urlEncode $statusComIP]

                :do {
                    /tool fetch url=($url . "?sheet=LOGS&TELEFONE=" . $telefoneEncoded . "&STATUS=" . $statusEncoded) keep-result=no
                    :log info ($telefone . " " . $statusComIP)
                } on-error={
                    :log error ("Erro ao enviar log: " . $telefone . " " . $statusComIP)
                }
            }
        }
    }
}

/system scheduler add interval=${intervaloVal} name=SHEETS_LOGS_FINAL on-event="GoogleSheets-LogsFinal" start-time=startup

`;
    }

    s += `# ================================================
# SCRIPT PÓS-REBOOT - SINCRONIZAÇÃO DE CONTADORES
# ================================================
/system script add name=GoogleSheets-PosReboot source={
    :log info "=== INICIANDO SINCRONIZAÇÃO PÓS-REBOOT ==="

    # SINCRONIZAÇÃO USUÁRIOS`;

    if (cadastros) {
      s += `
    :global totalUsuariosEnviados

    :local usuariosAtuais 0
    :foreach user in=[/ip hotspot user find where !default] do={
        :local telefone [/ip hotspot user get $user name]
        :if ([:find $telefone "default"] < 0 && [:find $telefone "trial"] < 0) do={
            :set usuariosAtuais ($usuariosAtuais + 1)
        }
    }

    :set totalUsuariosEnviados $usuariosAtuais
    :log info ("Usuários sincronizados: " . $usuariosAtuais)`;
    }

    if (logs) {
      s += `

    # SINCRONIZAÇÃO LOGS
    :global ultimoLogProcessado

    :local agora [/system clock get time]
    :local hoje [/system clock get date]
    :set ultimoLogProcessado ("reboot-" . $hoje . "-" . $agora)
    :log info ("Referência logs definida: " . $ultimoLogProcessado)`;
    }

    s += `

    :log info "=== SINCRONIZAÇÃO PÓS-REBOOT CONCLUÍDA ==="
}

/system scheduler add name=SHEETS_POS_REBOOT on-event="GoogleSheets-PosReboot" start-time=startup interval=0s

`;

    s += `# ================================================
# LIMPEZA MANUAL DAS VARIÁVEIS GLOBAIS
# ================================================
/system script add name=GoogleSheets-Limpeza source={`;
    if (cadastros) s += `\n    :global totalUsuariosEnviados`;
    if (logs) s += `\n    :global ultimoLogProcessado`;
    s += `\n    `;
    if (cadastros) s += `\n    :set totalUsuariosEnviados 0`;
    if (logs) s += `\n    :set ultimoLogProcessado ""`;
    s += `\n
    :log info "Variáveis globais limpas (execução manual)"
    :put "RESET MANUAL EXECUTADO - Sistema vai reenviar todos os dados"
}

# NOTA: Script de limpeza SEM scheduler automático
# Para executar manualmente: /system script run GoogleSheets-Limpeza

`;

    s += `# ================================================
# COMANDOS DE TESTE E CONTROLE
# ================================================`;
    if (cadastros) s += `\n:global testeUsuarios do={ /system script run GoogleSheets-UsuariosFinal }`;
    if (logs) s += `\n:global testeLogs do={ /system script run GoogleSheets-LogsFinal }`;

    s += `\n:global verVariaveis do={`;
    if (cadastros) s += `\n    :global totalUsuariosEnviados`;
    if (logs) s += `\n    :global ultimoLogProcessado`;
    if (cadastros) s += `\n    :put ("Total usuarios enviados: " . $totalUsuariosEnviados)`;
    if (logs) s += `\n    :put ("Ultimo log: " . $ultimoLogProcessado)`;
    s += `\n}

:global limpezaManual do={
    /system script run GoogleSheets-Limpeza
}

:global resetTeste do={`;
    if (cadastros) s += `\n    :global totalUsuariosEnviados; :set totalUsuariosEnviados 0`;
    if (logs) s += `\n    :global ultimoLogProcessado; :set ultimoLogProcessado ""`;
    s += `\n    :put "Variáveis resetadas para teste"
}

:global pararIntegracao do={
    /system scheduler disable [find name~"SHEETS_"]
    :put "Integração pausada"
}

:global ativarIntegracao do={
    /system scheduler enable [find name~"SHEETS_"]
    :put "Integração ativada"
}

:global verSchedulers do={
    /system scheduler print where name~"SHEETS_"
}

# ================================================
# INSTALAÇÃO CONCLUÍDA!
# ================================================
:put "INTEGRAÇÃO GOOGLE SHEETS 100% FUNCIONANDO!"
:put "Sistema anti-duplicatas e backup automático ativados!"`;
    if (logs) s += `\n:put "Logs incluem IP do dispositivo!"`;
    s += `\n:put "NOVO: Script pós-reboot evita duplicatas após reinicialização!"
:put "CORREÇÃO: Nomes com espaços agora funcionam perfeitamente!"
:put ""
:put "COMANDOS DISPONÍVEIS:"`;
    if (cadastros) s += `\n:put "• Teste usuarios: :global testeUsuarios; \\$testeUsuarios"`;
    if (logs) s += `\n:put "• Teste logs: :global testeLogs; \\$testeLogs"`;
    s += `\n:put "• Ver variáveis: :global verVariaveis; \\$verVariaveis"
:put "• Limpeza manual: :global limpezaManual; \\$limpezaManual"
:put "• Reset teste: :global resetTeste; \\$resetTeste"
:put "• Pausar: :global pararIntegracao; \\$pararIntegracao"
:put "• Ativar: :global ativarIntegracao; \\$ativarIntegracao"
:put "• Ver schedulers: :global verSchedulers; \\$verSchedulers"
:put ""
:put "IMPORTANTE: Sistema pós-reboot evita duplicatas!"
:put "Schedulers rodando a cada ${intervaloVal}"
:put "Script de limpeza agora é MANUAL (sem scheduler automático)"

# =====================================================
# INTEGRAÇÃO PRONTA E 100% FUNCIONANDO!
# =====================================================`;

    return s;
  }

  const handleGerar = () => {
    const trimmedUrl = url.trim();
    if (!trimmedUrl) { alert('❌ URL obrigatória!'); return; }
    if (!trimmedUrl.includes('script.google.com/macros/s/')) { alert('❌ URL inválida!'); return; }
    if (!enviarCadastros && !enviarLogs) { alert('❌ Selecione pelo menos uma opção!'); return; }

    const generated = criarScript(trimmedUrl, enviarCadastros, enviarLogs, intervalo);
    setScript(generated);
    setShowResult(true);
    setTimeout(() => {
      document.getElementById('hs-result')?.scrollIntoView({ behavior: 'smooth' });
    }, 50);
    alert('✅ Script gerado! Cole no MikroTik.');
  };

  const handleCopiar = () => {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(script)
        .then(() => alert('✅ Script copiado!'))
        .catch(() => fallbackCopy());
    } else {
      fallbackCopy();
    }
  };

  const fallbackCopy = () => {
    const ta = scriptRef.current;
    if (!ta) { alert('❌ Não foi possível copiar.'); return; }
    ta.select();
    ta.setSelectionRange(0, ta.value.length);
    const ok = document.execCommand('copy');
    window.getSelection()?.removeAllRanges();
    alert(ok ? '✅ Script copiado!' : '❌ Use Ctrl+A + Ctrl+C na caixa de texto.');
  };

  const handleBaixar = () => {
    const agora = new Date();
    const timestamp = agora.toISOString().slice(0, 19).replace(/:/g, '-');
    const blob = new Blob([script], { type: 'text/plain' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `integracao-google-sheets-${timestamp}.rsc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
    alert('✅ Arquivo .rsc baixado!');
  };

  return (
    <div className={styles.page}>

      {/* Page Header */}
      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderIcon}>
          <Plug size={22} />
        </div>
        <div className={styles.pageHeaderText}>
          <h1>Integração Hotspot Google Sheet</h1>
          <p>Gere scripts MikroTik para sincronizar usuários e logs do hotspot com o Google Sheets</p>
        </div>
      </div>

      {/* Info card */}
      <div className={styles.infoCard}>
        <div className={styles.brandRow}>
          <div className={styles.brandLogo}>
            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M3 3h18v18H3V3zm16 16V5H5v14h14zM6 12h4v1H6v-1zm0-2h6v1H6v-1zm0 4h8v1H6v-1z" />
            </svg>
          </div>
          <div className={styles.brandInfo}>
            <span className={styles.brandName}>CLUBE DE REDE</span>
            <a href="https://linktr.ee/clubederede" target="_blank" rel="noreferrer" className={styles.brandLink}>
              linktr.ee/clubederede
            </a>
          </div>
        </div>

        <p className={styles.infoCardTitle}>📊 O que faz esta integração?</p>

        <div className={styles.infoGrid}>
          <div className={styles.infoBlock}>
            <strong>🔄 Funcionamento Básico</strong>
            <p>
              Recebe cadastros do hotspot em tempo real · Registra logs completos (conexão + desconexão + IP) ·
              Organiza dados em abas separadas (USUARIOS / LOGS)
            </p>
          </div>
          <div className={styles.infoBlock}>
            <strong>🤖 Automações Inteligentes</strong>
            <p>
              Limpeza de duplicatas a cada 4h · Backup mensal de logs &gt;30 dias em abas mensais a cada 12h ·
              Planilha sempre limpa e organizada
            </p>
          </div>
          <div className={styles.infoBlock}>
            <strong>📁 Estrutura das Abas</strong>
            <p>
              <strong>USUARIOS</strong> — lista única de clientes<br />
              <strong>LOGS</strong> — conexões dos últimos 30 dias<br />
              <strong>LOGS_2025_01</strong> — jan. arquivado<br />
              <strong>LOGS_2025_02</strong> — fev. arquivado
            </p>
          </div>
        </div>

        <a
          href="https://docs.google.com/spreadsheets/d/1pGf69Qlj7T0aYIx0nPX45u77d6jxgTwRtQq_Gi1P7oM/copy"
          className={styles.templateBtn}
          target="_blank"
          rel="noreferrer"
        >
          📋 Planilha modelo pronta (Apps Script incluso)
        </a>

        <div className={styles.stepsBox}>
          <strong>📋 Como publicar o Apps Script:</strong>
          <ol>
            <li><strong>Abrir Apps Script:</strong> Na planilha → "Extensões" → "Apps Script"</li>
            <li><strong>Publicar:</strong> Clique em "Implantar" (canto superior direito)</li>
            <li><strong>Nova implantação:</strong> Clique em "Nova implantação"</li>
            <li><strong>Tipo:</strong> Ícone ⚙️ → "Aplicativo da web"</li>
            <li>
              <strong>Configurar:</strong>
              <ul>
                <li>Executar como: <strong>"Eu"</strong> (seu email)</li>
                <li>Quem tem acesso: <strong>"Qualquer pessoa"</strong></li>
              </ul>
            </li>
            <li><strong>Implantar:</strong> Clique "Implantar" → autorize se necessário</li>
            <li><strong>Copiar URL:</strong> Copie a URL longa (termina com /exec)</li>
            <li><strong>Ativar automação:</strong> Execute "configurarTriggers" uma vez</li>
          </ol>
        </div>
      </div>

      {/* URL input */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div className={styles.cardHeaderIcon}><Link2 size={15} /></div>
          <h3>URL do Google Apps Script</h3>
        </div>
        <div className={styles.formGroup}>
          <label htmlFor="urlGoogleScript">Cole aqui a URL do seu Apps Script:</label>
          <input
            type="url"
            id="urlGoogleScript"
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="https://script.google.com/macros/s/ABC123.../exec"
          />
          <div className={styles.urlHint}>
            Exemplo: https://script.google.com/macros/s/AKfycbziOYPTymmr9_JOCVxbft7U303Hc5oGvVGkVQyhmAt5F7Po6C3_2D0RlPStEcnIk64/exec
          </div>
        </div>
      </div>

      {/* Settings */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div className={styles.cardHeaderIcon}><Settings size={15} /></div>
          <h3>Configurações da Integração</h3>
        </div>

        <div className={styles.checkboxGroup}>
          <div className={styles.checkboxRow}>
            <input
              type="checkbox"
              id="enviarCadastros"
              checked={enviarCadastros}
              onChange={e => setEnviarCadastros(e.target.checked)}
            />
            <label htmlFor="enviarCadastros">📝 Enviar cadastros em tempo real</label>
          </div>
          <div className={styles.checkboxRow}>
            <input
              type="checkbox"
              id="enviarLogs"
              checked={enviarLogs}
              onChange={e => setEnviarLogs(e.target.checked)}
            />
            <label htmlFor="enviarLogs">📋 Enviar logs completos (conexão + desconexão)</label>
          </div>
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="intervaloMonitoramento">Intervalo de monitoramento:</label>
          <select
            id="intervaloMonitoramento"
            value={intervalo}
            onChange={e => setIntervalo(e.target.value)}
          >
            <option value="30s">30 segundos (muito rápido)</option>
            <option value="1m">1 minuto (recomendado)</option>
            <option value="2m">2 minutos</option>
            <option value="3m">3 minutos</option>
            <option value="5m">5 minutos</option>
            <option value="10m">10 minutos</option>
          </select>
          <div className={styles.hintText}>
            Frequência aplicada para cadastros e logs. Anti-duplicatas e backup automático inclusos.
          </div>
        </div>
      </div>

      {/* Warning notice */}
      <div className={styles.notice}>
        <p><AlertTriangle size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
          <strong>Importante:</strong> Esta integração funciona junto com seu sistema atual.</p>
        <p>• Não modifica nada que já está funcionando</p>
        <p>• Adiciona apenas o envio para Google Sheets</p>
        <p>• Sistema anti-duplicatas e backup automático inclusos</p>
        <p>• Pode ser removido a qualquer momento sem afetar o hotspot</p>
      </div>

      <button className={styles.btnGenerate} onClick={handleGerar}>
        <Plug size={18} />
        Gerar Integração Google Sheets
      </button>

      {showResult && (
        <div className={styles.resultCard} id="hs-result">
          <h3><Code2 size={16} /> Script da Integração Gerado</h3>
          <textarea ref={scriptRef} className={styles.scriptOutput} readOnly value={script} />
          <div className={styles.resultActions}>
            <button className={styles.btnCopy} onClick={handleCopiar}>📋 Copiar Script</button>
            <button className={styles.btnDownload} onClick={handleBaixar}>⬇️ Baixar .rsc</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default HotspotGoogleSheets;
