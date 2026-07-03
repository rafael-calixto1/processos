import mysql from 'mysql2/promise.js';
import dotenv from 'dotenv';

dotenv.config();

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------
const MAIN_X = 680;   // central spine
const COL = {         // branch column centres
  offline: 120,
  imagem:  530,
  acesso:  900,
  gravacao: 1280,
};

const EDGE_STYLE = {
  type: 'smoothstep',
  markerEnd: { type: 'arrowclosed', width: 18, height: 18, color: '#9ca3af' },
  style: { strokeWidth: 2, stroke: '#9ca3af' },
  labelStyle: { fontSize: 11, fontWeight: 600, fill: '#374151' },
  labelBgStyle: { fill: '#ffffff', fillOpacity: 1 },
  labelBgPadding: [6, 10],
  labelBgBorderRadius: 6,
};

const edge = (id, source, target, label) => ({
  id,
  source,
  target,
  ...(label ? { label } : {}),
  ...EDGE_STYLE,
});

// ---------------------------------------------------------------------------
// NODES
// ---------------------------------------------------------------------------
const nodes = [
  // ── INÍCIO ─────────────────────────────────────────────────────────────────
  {
    id: 'start',
    type: 'startNode',
    data: {
      label: 'Abertura do Chamado — Câmera',
      description: 'Cliente entra em contato relatando problema com câmera de monitoramento.',
      department: 'Suporte',
    },
    position: { x: MAIN_X, y: 60 },
  },

  // ── CONSULTA NO ERP (HubSoft) ────────────────────────────────────────────
  {
    id: 'p-hubsoft',
    type: 'processNode',
    data: {
      label: 'Consultar cliente no HubSoft',
      description:
        'Acessar conexaoweb.hubsoft.com.br → localizar pelo CPF/CNPJ ou número do contrato.\n' +
        'Coletar: nome, contrato ativo, plano de câmera, número de série do equipamento e link direto do dispositivo.\n' +
        'Verificar adimplência — contrato suspenso pode ser causa do bloqueio.',
      department: 'Suporte',
      icon: 'search',
    },
    position: { x: MAIN_X, y: 210 },
  },

  // ── GATEWAY PRINCIPAL ───────────────────────────────────────────────────
  {
    id: 'g-tipo',
    type: 'gatewayNode',
    data: { label: 'Qual é o tipo de problema?' },
    position: { x: MAIN_X, y: 390 },
  },

  // ============================================================
  // BRANCH 1 — CÂMERA OFFLINE
  // ============================================================
  {
    id: 'p-offline-fullcam',
    type: 'processNode',
    data: {
      label: 'Verificar câmera no FULLCAM',
      description:
        'Acessar cameras.cwtelecom.net.br → localizar a câmera pelo serial ou nome do cliente.\n' +
        'Verificar status de conexão (online/offline), última vez vista e logs de eventos.',
      department: 'Suporte',
      icon: 'eye',
    },
    position: { x: COL.offline, y: 580 },
  },
  {
    id: 'g-offline-visivel',
    type: 'gatewayNode',
    data: { label: 'Câmera aparece no FULLCAM?' },
    position: { x: COL.offline, y: 740 },
  },

  // SIM → Reboot remoto
  {
    id: 'p-offline-reboot',
    type: 'processNode',
    data: {
      label: 'Executar reboot remoto via FULLCAM',
      description:
        'No FULLCAM, abrir opções da câmera → executar reinicialização remota.\n' +
        'Aguardar 2–3 minutos para a câmera reconectar.\n' +
        'Verificar se status voltou para online.',
      department: 'Suporte',
      icon: 'zap',
    },
    position: { x: COL.offline + 200, y: 900 },
  },
  {
    id: 'g-offline-voltou',
    type: 'gatewayNode',
    data: { label: 'Câmera voltou online após reboot?' },
    position: { x: COL.offline + 200, y: 1060 },
  },

  // SIM → Reboot funcionou → Registrar e fechar
  {
    id: 'p-offline-registrar',
    type: 'processNode',
    data: {
      label: 'Registrar resolução e encerrar',
      description:
        'Confirmar câmera online no FULLCAM.\n' +
        'Informar o cliente e orientar a monitorar por 24h.\n' +
        'Registrar causa (instabilidade de rede ou reinicialização espontânea) e fechar o chamado.',
      department: 'Suporte',
      icon: 'check',
    },
    position: { x: COL.offline + 380, y: 1220 },
  },

  // NÃO → Reboot não resolveu → Verificar internet do cliente
  {
    id: 'p-offline-internet',
    type: 'processNode',
    data: {
      label: 'Verificar conectividade do cliente',
      description:
        'Usar o link direto do dispositivo no HubSoft para tentar acesso remoto.\n' +
        'Testar ping/acesso à ONU ou roteador do cliente.\n' +
        'Verificar se há outro serviço ativo no endereço (internet, VoIP).',
      department: 'Suporte',
      icon: 'wifi',
    },
    position: { x: COL.offline + 180, y: 1220 },
  },
  {
    id: 'g-offline-internet',
    type: 'gatewayNode',
    data: { label: 'A internet do cliente está OK?' },
    position: { x: COL.offline + 180, y: 1380 },
  },
  {
    id: 'p-offline-sem-internet',
    type: 'processNode',
    data: {
      label: 'Encaminhar para suporte de internet',
      description:
        'O cliente está sem sinal de internet no local da câmera.\n' +
        'Abrir chamado ou escalar para a equipe de conectividade.\n' +
        'A câmera voltará automaticamente quando o sinal for restaurado.',
      department: 'Suporte',
      icon: 'wifiOff',
    },
    position: { x: COL.offline + 40, y: 1540 },
  },
  {
    id: 'p-offline-campo-poe',
    type: 'processNode',
    data: {
      label: 'Escalar técnico em campo — PoE / Fonte',
      description:
        'Internet OK, câmera não responde mesmo após reboot.\n' +
        'Agendar visita técnica para verificar:\n' +
        '• Cabo de rede entre switch/injetor PoE e a câmera\n' +
        '• Injetor PoE ou switch PoE (medir tensão)\n' +
        '• Fonte de alimentação autônoma (se aplicável)\n' +
        '• Possível queda de energia local que travou a câmera.',
      department: 'Suporte',
      icon: 'wrench',
    },
    position: { x: COL.offline + 340, y: 1540 },
  },

  // NÃO visível no FULLCAM → Verificar provisionamento
  {
    id: 'p-offline-provis',
    type: 'processNode',
    data: {
      label: 'Verificar provisionamento no HubSoft',
      description:
        'Acessar ERP → localizar o equipamento pelo serial.\n' +
        'Confirmar: plano de câmera ativo, status do equipamento como "provisionado", link direto funcional.\n' +
        'Verificar se a câmera está cadastrada no FULLCAM com as credenciais corretas (IP/DDNS, porta, usuário).',
      department: 'Suporte',
      icon: 'database',
    },
    position: { x: COL.offline - 100, y: 900 },
  },
  {
    id: 'g-offline-provis',
    type: 'gatewayNode',
    data: { label: 'Câmera provisionada corretamente?' },
    position: { x: COL.offline - 100, y: 1060 },
  },
  {
    id: 'p-offline-fix-provis',
    type: 'processNode',
    data: {
      label: 'Corrigir provisionamento + recadastrar no FULLCAM',
      description:
        'No HubSoft: corrigir dados do equipamento (serial, plano, status), reativar contrato de câmera se necessário.\n' +
        'No FULLCAM: adicionar ou reativar câmera com IP/DDNS, porta RTSP, usuário e senha corretos.\n' +
        'Testar visualização ao vivo após o cadastro.',
      department: 'Suporte',
      icon: 'settings',
    },
    position: { x: COL.offline - 220, y: 1220 },
  },
  {
    id: 'p-offline-campo-equip',
    type: 'processNode',
    data: {
      label: 'Escalar técnico em campo — Equipamento',
      description:
        'Provisionamento OK, câmera não aparece no FULLCAM mesmo assim.\n' +
        'Agendar visita para verificar:\n' +
        '• Câmera liga (LED de status)\n' +
        '• IP local acessível na rede do cliente\n' +
        '• Possível necessidade de reset de fábrica e reconfiguração\n' +
        '• Defeito de hardware (substituição).',
      department: 'Suporte',
      icon: 'wrench',
    },
    position: { x: COL.offline + 40, y: 1220 },
  },

  // END Offline
  {
    id: 'end-offline-ok',
    type: 'endNode',
    data: { label: 'Câmera Restaurada', description: 'Reboot remoto resolveu. Chamado encerrado.' },
    position: { x: COL.offline + 380, y: 1380 },
  },
  {
    id: 'end-offline-internet',
    type: 'endNode',
    data: { label: 'Encaminhado — Sem Internet', description: 'Aguardar resolução do suporte de internet.' },
    position: { x: COL.offline + 40, y: 1700 },
  },
  {
    id: 'end-offline-campo-poe',
    type: 'endNode',
    data: { label: 'Agendado — Campo (PoE/Fonte)', description: 'Técnico acionado.' },
    position: { x: COL.offline + 340, y: 1700 },
  },
  {
    id: 'end-offline-provis',
    type: 'endNode',
    data: { label: 'Provisionamento Corrigido', description: 'Câmera recadastrada no FULLCAM.' },
    position: { x: COL.offline - 220, y: 1380 },
  },
  {
    id: 'end-offline-campo-equip',
    type: 'endNode',
    data: { label: 'Agendado — Campo (Hardware)', description: 'Técnico acionado para verificar equipamento.' },
    position: { x: COL.offline + 40, y: 1380 },
  },

  // ============================================================
  // BRANCH 2 — PROBLEMA DE IMAGEM
  // ============================================================
  {
    id: 'p-img-fullcam',
    type: 'processNode',
    data: {
      label: 'Acessar câmera ao vivo no FULLCAM',
      description:
        'Acessar cameras.cwtelecom.net.br → abrir o feed ao vivo da câmera do cliente.\n' +
        'Observar e descrever exatamente o sintoma para documentação.',
      department: 'Suporte',
      icon: 'eye',
    },
    position: { x: COL.imagem, y: 580 },
  },
  {
    id: 'g-img-sintoma',
    type: 'gatewayNode',
    data: { label: 'Qual é o sintoma da imagem?' },
    position: { x: COL.imagem, y: 740 },
  },

  // Sintoma A: Escura / Night Vision
  {
    id: 'p-img-ir',
    type: 'processNode',
    data: {
      label: 'Ajustar Night Vision / IR no FULLCAM',
      description:
        'No FULLCAM, acessar configurações da câmera:\n' +
        '• Ativar modo IR automático ou manual\n' +
        '• Ajustar brilho, contraste ou modo de exposição noturna\n' +
        '• Verificar se há obstrução física na frente dos LEDs IR.',
      department: 'Suporte',
      icon: 'settings',
    },
    position: { x: COL.imagem - 120, y: 900 },
  },
  {
    id: 'g-img-ir-ok',
    type: 'gatewayNode',
    data: { label: 'Imagem normalizou?' },
    position: { x: COL.imagem - 120, y: 1060 },
  },

  // Sintoma B: Borrada / Embaçada
  {
    id: 'p-img-borrada',
    type: 'processNode',
    data: {
      label: 'Lente suja, borrada ou embaçada',
      description:
        'Orientar o cliente a limpar delicadamente a lente com pano de microfibra seco.\n' +
        'Se o embaçamento for interno (condensação): agendar visita técnica.\n' +
        'Foco fora de ajuste: somente campo pode corrigir (lente de foco manual).',
      department: 'Suporte',
      icon: 'alert',
    },
    position: { x: COL.imagem + 60, y: 900 },
  },

  // Sintoma C: Congelada / Travando
  {
    id: 'p-img-congelada',
    type: 'processNode',
    data: {
      label: 'Imagem congelada / travando',
      description:
        'Executar reboot remoto via FULLCAM → aguardar 2–3 min.\n' +
        'Verificar a banda de upload do cliente (mínimo recomendado: 1 Mbps por câmera Full HD).\n' +
        'Reduzir resolução do stream temporariamente para diagnóstico.',
      department: 'Suporte',
      icon: 'zap',
    },
    position: { x: COL.imagem + 220, y: 900 },
  },
  {
    id: 'g-img-cong-ok',
    type: 'gatewayNode',
    data: { label: 'Stream estabilizou?' },
    position: { x: COL.imagem + 220, y: 1060 },
  },

  // Sintoma D: Ângulo incorreto / PTZ
  {
    id: 'p-img-ptz',
    type: 'processNode',
    data: {
      label: 'Câmera com ângulo incorreto (PTZ)',
      description:
        'Se a câmera é PTZ: no FULLCAM, usar controles de Pan/Tilt/Zoom para reposicionar remotamente.\n' +
        'Salvar a posição como preset padrão.\n' +
        'Se câmera fixa (dome/bullet): agendar visita técnica para reajuste físico.',
      department: 'Suporte',
      icon: 'settings',
    },
    position: { x: COL.imagem + 380, y: 900 },
  },

  // END Imagem
  {
    id: 'end-img-ir-ok',
    type: 'endNode',
    data: { label: 'Night Vision Corrigido', description: 'Ajuste remoto resolveu.' },
    position: { x: COL.imagem - 120, y: 1220 },
  },
  {
    id: 'end-img-ir-campo',
    type: 'endNode',
    data: { label: 'Agendado — Campo (Sensor IR)', description: 'Possível defeito de hardware no módulo IR.' },
    position: { x: COL.imagem - 280, y: 1220 },
  },
  {
    id: 'end-img-lente',
    type: 'endNode',
    data: { label: 'Agendado — Campo (Lente)', description: 'Limpeza interna ou troca de câmera.' },
    position: { x: COL.imagem + 60, y: 1060 },
  },
  {
    id: 'end-img-stream-ok',
    type: 'endNode',
    data: { label: 'Stream Normalizado', description: 'Reboot ou redução de resolução resolveu.' },
    position: { x: COL.imagem + 220, y: 1220 },
  },
  {
    id: 'end-img-stream-campo',
    type: 'endNode',
    data: { label: 'Agendado — Campo ou Upgrade de Plano', description: 'Banda insuficiente ou hardware.' },
    position: { x: COL.imagem + 380, y: 1220 },
  },
  {
    id: 'end-img-ptz',
    type: 'endNode',
    data: { label: 'Ângulo Ajustado ou Campo Agendado', description: '' },
    position: { x: COL.imagem + 520, y: 1060 },
  },

  // ============================================================
  // BRANCH 3 — PROBLEMA DE ACESSO (App / Web)
  // ============================================================
  {
    id: 'p-acc-plataforma',
    type: 'processNode',
    data: {
      label: 'Identificar plataforma e tipo de acesso',
      description:
        'Perguntar ao cliente:\n' +
        '• Está acessando pelo app FULLCAM no celular, pelo navegador web ou por outro software?\n' +
        '• O acesso falha de dentro da rede local, de fora (internet) ou dos dois?\n' +
        '• Qual credencial está usando (e-mail/usuário + senha)?',
      department: 'Suporte',
      icon: 'search',
    },
    position: { x: COL.acesso, y: 580 },
  },
  {
    id: 'g-acc-tipo',
    type: 'gatewayNode',
    data: { label: 'Qual é o problema de acesso?' },
    position: { x: COL.acesso, y: 740 },
  },

  // Acesso A: Esqueceu senha
  {
    id: 'p-acc-senha',
    type: 'processNode',
    data: {
      label: 'Redefinir credenciais no FULLCAM',
      description:
        'No FULLCAM, acessar gerenciamento de usuários → localizar o usuário do cliente.\n' +
        'Redefinir a senha → informar as novas credenciais ao cliente por canal seguro (SMS, e-mail).\n' +
        'Orientar o cliente a alterar a senha após o primeiro acesso.',
      department: 'Suporte',
      icon: 'lock',
    },
    position: { x: COL.acesso - 200, y: 900 },
  },

  // Acesso B: Acesso externo falha (DDNS/Port Forward)
  {
    id: 'p-acc-externo',
    type: 'processNode',
    data: {
      label: 'Verificar DDNS e Port Forwarding',
      description:
        'Verificar se o DDNS do cliente está ativo e atualizando o IP corretamente.\n' +
        'Confirmar se as portas necessárias do FULLCAM estão abertas no roteador do cliente (RTSP: 554, HTTP: 80/8080, HTTPS: 443).\n' +
        'Testar acesso externo pela URL/IP público.\n' +
        'Se necessário, orientar a abertura de portas no roteador.',
      department: 'Suporte',
      icon: 'settings',
    },
    position: { x: COL.acesso, y: 900 },
  },

  // Acesso C: Stream lento / travando no app
  {
    id: 'p-acc-stream',
    type: 'processNode',
    data: {
      label: 'Otimizar qualidade do stream remoto',
      description:
        'No FULLCAM, reduzir a resolução/qualidade do stream (ex.: HD → SD) para diagnóstico.\n' +
        'Orientar o cliente a usar Wi-Fi em vez de dados móveis.\n' +
        'Verificar a banda de upload do ponto de origem da câmera e a de download do cliente.\n' +
        'Se problema persistir: verificar limitação do plano contratado.',
      department: 'Suporte',
      icon: 'zap',
    },
    position: { x: COL.acesso + 200, y: 900 },
  },

  // Acesso D: Câmera não aparece no app (mesmo com login OK)
  {
    id: 'p-acc-vincular',
    type: 'processNode',
    data: {
      label: 'Câmera não listada — Verificar vínculo no FULLCAM',
      description:
        'No FULLCAM, verificar se a câmera está vinculada à conta do cliente.\n' +
        'Adicionar ou corrigir o vínculo entre câmera e usuário.\n' +
        'Verificar permissões: o usuário tem acesso de visualização à câmera em questão?',
      department: 'Suporte',
      icon: 'user',
    },
    position: { x: COL.acesso + 400, y: 900 },
  },

  // END Acesso
  {
    id: 'end-acc-senha',
    type: 'endNode',
    data: { label: 'Acesso Restaurado', description: 'Credenciais redefinidas.' },
    position: { x: COL.acesso - 200, y: 1060 },
  },
  {
    id: 'end-acc-externo',
    type: 'endNode',
    data: { label: 'Acesso Remoto Configurado', description: 'DDNS e portas verificados.' },
    position: { x: COL.acesso, y: 1060 },
  },
  {
    id: 'end-acc-stream',
    type: 'endNode',
    data: { label: 'Stream Otimizado', description: 'Qualidade ajustada para a banda disponível.' },
    position: { x: COL.acesso + 200, y: 1060 },
  },
  {
    id: 'end-acc-vincular',
    type: 'endNode',
    data: { label: 'Câmera Vinculada', description: 'Permissão de acesso configurada.' },
    position: { x: COL.acesso + 400, y: 1060 },
  },

  // ============================================================
  // BRANCH 4 — GRAVAÇÃO / STORAGE
  // ============================================================
  {
    id: 'p-rec-fullcam',
    type: 'processNode',
    data: {
      label: 'Acessar configurações de gravação no FULLCAM',
      description:
        'No FULLCAM, abrir as configurações da câmera → aba de gravação.\n' +
        'Verificar: gravação ativa ou inativa, tipo (contínua / por evento), agenda configurada e espaço em disco disponível.',
      department: 'Suporte',
      icon: 'database',
    },
    position: { x: COL.gravacao, y: 580 },
  },
  {
    id: 'g-rec-tipo',
    type: 'gatewayNode',
    data: { label: 'Qual é a solicitação?' },
    position: { x: COL.gravacao, y: 740 },
  },

  // Gravação A: Recuperar gravação passada
  {
    id: 'p-rec-recuperar',
    type: 'processNode',
    data: {
      label: 'Recuperar e exportar gravação',
      description:
        'No FULLCAM, acessar o playback da câmera → selecionar data e hora do evento.\n' +
        'Cortar o trecho relevante → exportar o clipe de vídeo.\n' +
        'Verificar se o período solicitado está dentro do tempo de retenção configurado.\n' +
        'Enviar o clipe ao cliente via link de download, WhatsApp ou e-mail.',
      department: 'Suporte',
      icon: 'download',
    },
    position: { x: COL.gravacao - 240, y: 900 },
  },

  // Gravação B: Câmera não está gravando
  {
    id: 'p-rec-nao-grava',
    type: 'processNode',
    data: {
      label: 'Câmera não está gravando — Verificar configuração',
      description:
        'Verificar se a gravação está habilitada no FULLCAM (pode ter sido desativada acidentalmente).\n' +
        'Confirmar se o storage (HD/NVR/nuvem) está acessível e com espaço.\n' +
        'Revisar a agenda de gravação (ex.: configurada apenas em horário comercial).\n' +
        'Reativar e testar gravação de 1 minuto para confirmar.',
      department: 'Suporte',
      icon: 'settings',
    },
    position: { x: COL.gravacao - 60, y: 900 },
  },

  // Gravação C: Storage cheio
  {
    id: 'p-rec-storage',
    type: 'processNode',
    data: {
      label: 'Resolver problema de storage cheio',
      description:
        'No FULLCAM, verificar capacidade total × tempo de retenção configurado.\n' +
        'Ações disponíveis:\n' +
        '• Habilitar sobrescrita automática das gravações mais antigas\n' +
        '• Reduzir o período de retenção para liberar espaço\n' +
        '• Reduzir a resolução de gravação (ex.: Full HD → HD)\n' +
        '• Orientar o cliente sobre upgrade de plano de armazenamento.',
      department: 'Suporte',
      icon: 'database',
    },
    position: { x: COL.gravacao + 160, y: 900 },
  },

  // Gravação D: Configurar gravação por evento/movimento
  {
    id: 'p-rec-evento',
    type: 'processNode',
    data: {
      label: 'Configurar gravação por detecção de movimento',
      description:
        'No FULLCAM, configurar:\n' +
        '• Sensibilidade da detecção de movimento (ajustar para evitar falsos positivos)\n' +
        '• Pré-gravação (buffer antes do evento) e pós-gravação (tempo após o evento)\n' +
        '• Agenda de detecção (horários ativos)\n' +
        '• Notificações por push/e-mail ao detectar movimento.',
      department: 'Suporte',
      icon: 'settings',
    },
    position: { x: COL.gravacao + 360, y: 900 },
  },

  // END Gravação
  {
    id: 'end-rec-recuperar',
    type: 'endNode',
    data: { label: 'Gravação Exportada', description: 'Clipe enviado ao cliente.' },
    position: { x: COL.gravacao - 240, y: 1060 },
  },
  {
    id: 'end-rec-nao-grava',
    type: 'endNode',
    data: { label: 'Gravação Reativada', description: 'Configuração corrigida, testada e confirmada.' },
    position: { x: COL.gravacao - 60, y: 1060 },
  },
  {
    id: 'end-rec-storage',
    type: 'endNode',
    data: { label: 'Storage Normalizado', description: 'Sobrescrita ou retenção ajustada.' },
    position: { x: COL.gravacao + 160, y: 1060 },
  },
  {
    id: 'end-rec-evento',
    type: 'endNode',
    data: { label: 'Detecção de Movimento Configurada', description: 'Gravação por evento ativa.' },
    position: { x: COL.gravacao + 360, y: 1060 },
  },
];

// ---------------------------------------------------------------------------
// EDGES
// ---------------------------------------------------------------------------
const edges = [
  // ── Spine principal ──────────────────────────────────────────────────────
  edge('e-start-hubsoft', 'start', 'p-hubsoft'),
  edge('e-hubsoft-gtipo', 'p-hubsoft', 'g-tipo'),

  // Gateway principal → 4 branches
  edge('e-gtipo-offline',  'g-tipo', 'p-offline-fullcam',  'Câmera Offline'),
  edge('e-gtipo-imagem',   'g-tipo', 'p-img-fullcam',      'Problema de Imagem'),
  edge('e-gtipo-acesso',   'g-tipo', 'p-acc-plataforma',   'Sem Acesso / App'),
  edge('e-gtipo-gravacao', 'g-tipo', 'p-rec-fullcam',      'Gravação / Storage'),

  // ── BRANCH 1: Offline ────────────────────────────────────────────────────
  edge('e-off-fullcam-g',    'p-offline-fullcam',  'g-offline-visivel'),
  edge('e-off-vis-sim',      'g-offline-visivel',  'p-offline-reboot',       'Sim — visível'),
  edge('e-off-vis-nao',      'g-offline-visivel',  'p-offline-provis',       'Não — verificar cadastro'),

  edge('e-off-reboot-g',     'p-offline-reboot',   'g-offline-voltou'),
  edge('e-off-voltou-sim',   'g-offline-voltou',   'p-offline-registrar',    'Sim'),
  edge('e-off-voltou-nao',   'g-offline-voltou',   'p-offline-internet',     'Não'),
  edge('e-off-registrar-end','p-offline-registrar','end-offline-ok'),

  edge('e-off-internet-g',   'p-offline-internet', 'g-offline-internet'),
  edge('e-off-int-nao',      'g-offline-internet', 'p-offline-sem-internet', 'Não — sem internet'),
  edge('e-off-int-sim',      'g-offline-internet', 'p-offline-campo-poe',    'Sim — internet OK'),
  edge('e-off-semint-end',   'p-offline-sem-internet', 'end-offline-internet'),
  edge('e-off-campopoe-end', 'p-offline-campo-poe',    'end-offline-campo-poe'),

  edge('e-off-provis-g',     'p-offline-provis',   'g-offline-provis'),
  edge('e-off-prov-nao',     'g-offline-provis',   'p-offline-fix-provis',   'Não — incorreto'),
  edge('e-off-prov-sim',     'g-offline-provis',   'p-offline-campo-equip',  'Sim — mas não conecta'),
  edge('e-off-fixprov-end',  'p-offline-fix-provis',   'end-offline-provis'),
  edge('e-off-campoeq-end',  'p-offline-campo-equip',  'end-offline-campo-equip'),

  // ── BRANCH 2: Imagem ─────────────────────────────────────────────────────
  edge('e-img-fullcam-g',   'p-img-fullcam',   'g-img-sintoma'),
  edge('e-img-g-ir',        'g-img-sintoma',   'p-img-ir',       'Escuro / Sem IR'),
  edge('e-img-g-borrada',   'g-img-sintoma',   'p-img-borrada',  'Borrada / Embaçada'),
  edge('e-img-g-congelada', 'g-img-sintoma',   'p-img-congelada','Congelada / Travando'),
  edge('e-img-g-ptz',       'g-img-sintoma',   'p-img-ptz',      'Ângulo Errado / PTZ'),

  edge('e-img-ir-g',        'p-img-ir',        'g-img-ir-ok'),
  edge('e-img-ir-sim',      'g-img-ir-ok',     'end-img-ir-ok',      'Sim'),
  edge('e-img-ir-nao',      'g-img-ir-ok',     'end-img-ir-campo',   'Não — hw defeituoso'),

  edge('e-img-borrada-end', 'p-img-borrada',   'end-img-lente'),

  edge('e-img-cong-g',      'p-img-congelada', 'g-img-cong-ok'),
  edge('e-img-cong-sim',    'g-img-cong-ok',   'end-img-stream-ok',  'Sim'),
  edge('e-img-cong-nao',    'g-img-cong-ok',   'end-img-stream-campo','Não — banda / hw'),

  edge('e-img-ptz-end',     'p-img-ptz',       'end-img-ptz'),

  // ── BRANCH 3: Acesso ─────────────────────────────────────────────────────
  edge('e-acc-plat-g',      'p-acc-plataforma','g-acc-tipo'),
  edge('e-acc-g-senha',     'g-acc-tipo',      'p-acc-senha',    'Esqueceu a senha'),
  edge('e-acc-g-externo',   'g-acc-tipo',      'p-acc-externo',  'Acesso externo falha'),
  edge('e-acc-g-stream',    'g-acc-tipo',      'p-acc-stream',   'Stream lento / trava'),
  edge('e-acc-g-vincular',  'g-acc-tipo',      'p-acc-vincular', 'Câmera não aparece no app'),

  edge('e-acc-senha-end',   'p-acc-senha',     'end-acc-senha'),
  edge('e-acc-ext-end',     'p-acc-externo',   'end-acc-externo'),
  edge('e-acc-stream-end',  'p-acc-stream',    'end-acc-stream'),
  edge('e-acc-vinc-end',    'p-acc-vincular',  'end-acc-vincular'),

  // ── BRANCH 4: Gravação ────────────────────────────────────────────────────
  edge('e-rec-fullcam-g',   'p-rec-fullcam',   'g-rec-tipo'),
  edge('e-rec-g-recuperar', 'g-rec-tipo',      'p-rec-recuperar', 'Recuperar gravação'),
  edge('e-rec-g-naograva',  'g-rec-tipo',      'p-rec-nao-grava', 'Câmera não grava'),
  edge('e-rec-g-storage',   'g-rec-tipo',      'p-rec-storage',   'Storage cheio'),
  edge('e-rec-g-evento',    'g-rec-tipo',      'p-rec-evento',    'Configurar gravação por evento'),

  edge('e-rec-rec-end',     'p-rec-recuperar', 'end-rec-recuperar'),
  edge('e-rec-ng-end',      'p-rec-nao-grava', 'end-rec-nao-grava'),
  edge('e-rec-stor-end',    'p-rec-storage',   'end-rec-storage'),
  edge('e-rec-ev-end',      'p-rec-evento',    'end-rec-evento'),
];

// ---------------------------------------------------------------------------
// SEED
// ---------------------------------------------------------------------------
const seed = async () => {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  try {
    console.log('Iniciando seed: Suporte de Câmeras (Processos Visuais)...\n');

    const [admins] = await connection.execute(
      'SELECT id FROM users WHERE role = "admin" LIMIT 1'
    );
    if (admins.length === 0) {
      throw new Error('Nenhum admin encontrado. Execute seedAdmin.js primeiro.');
    }
    const adminId = admins[0].id;

    const title = 'Suporte — Câmera de Monitoramento (FULLCAM)';

    const [existing] = await connection.execute(
      'SELECT id FROM visual_processes WHERE title = ?',
      [title]
    );
    if (existing.length > 0) {
      console.log(`⚠️  Processo "${title}" já existe (id=${existing[0].id}). Atualizando...`);
      await connection.execute(
        'UPDATE visual_processes SET nodes = ?, edges = ?, status = "active" WHERE id = ?',
        [JSON.stringify(nodes), JSON.stringify(edges), existing[0].id]
      );
      console.log(`✓ Processo atualizado (id=${existing[0].id})`);
    } else {
      const [result] = await connection.execute(
        'INSERT INTO visual_processes (title, nodes, edges, created_by, status) VALUES (?, ?, ?, ?, "active")',
        [title, JSON.stringify(nodes), JSON.stringify(edges), adminId]
      );
      console.log(`✓ Processo criado com ID: ${result.insertId}`);
    }

    console.log(`\n  Nós:  ${nodes.length}`);
    console.log(`  Arestas: ${edges.length}`);
    console.log('\n✅ Seed de Suporte de Câmeras concluído!');
    console.log('   Acesse /processos-visual para visualizar o fluxo.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro no seed:', error.message);
    process.exit(1);
  } finally {
    await connection.end();
  }
};

seed();
