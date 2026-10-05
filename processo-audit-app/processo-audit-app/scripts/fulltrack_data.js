// ---------------------------------------------------------------------------
// FULLTRACK — dados dos processos para importação
//
// Fonte: "FULLTRACK - MANUAL PASSO A PASSO.md" (CONEXAOWEB/FULLTRACK).
// Usado por seed_fulltrack.js (cria processos + passos) e por
// attach_fulltrack_photos.js (anexa as Fotos de Instrução depois).
//
// O campo `photo` de cada passo guarda o placeholder do Anexo A do manual;
// null significa "sem foto" — não reaproveitar imagem de outro passo.
// ---------------------------------------------------------------------------

export const DEPARTMENT_NAME = 'FULLTRACK';

// Placeholder -> caminho relativo à raiz "segundo cerebro" do Drive.
// Original: G:\Meu Drive\segundo cerebro\<caminho abaixo>
const CAD = 'images/CONEXAOWEB/FULLTRACK/01 CADASTRO';

export const PHOTO_PATHS = {
  'DADOS DE MONITORAMENTO':   `${CAD}/DADOS DE MONITORAMENTO.png`,
  'DADOS DE MONITORAMENTO 1': `${CAD}/DADOS DE MONITORAMENTO 1.png`,
  'DADOS DE MONITORAMENTO 2': `${CAD}/DADOS DE MONITORAMENTO 2.png`,
  'DADOS DE MONITORAMENTO 3': `${CAD}/DADOS DE MONITORAMENTO 3.png`,
  'DADOS DE MONITORAMENTO 4': `${CAD}/DADOS DE MONITORAMENTO 4.png`,
  'DADOS DE MONITORAMENTO 5': `${CAD}/DADOS DE MONITORAMENTO 5.png`,
  'DADOS DE MONITORAMENTO 6': `${CAD}/DADOS DE MONITORAMENTO 6.png`,
  'CADATRO DE CLIENTES 0':    `${CAD}/CADATRO DE CLIENTES 0.png`,
  'CADATRO DE CLIENTES 2':    `${CAD}/CADATRO DE CLIENTES 2.png`,
  'CADATRO DE CLIENTES 3':    `${CAD}/CADATRO DE CLIENTES 3.png`,
  'CADASTRO EXPRESSO0':       `${CAD}/CADASTRO EXPRESSO0.png`,
  'CADASTRO EXPRESSO 1':      `${CAD}/CADASTRO EXPRESSO 1.png`,
  'CADASTRO DE EQUIPAMENTOS':  `${CAD}/CADASTRO DE EQUIPAMENTOS.png`,
  'CADASTRO DE EQUIPAMENTOS1': `${CAD}/CADASTRO DE EQUIPAMENTOS1.png`,
  'CADASTRO DE EQUIPAMENTOS2': `${CAD}/CADASTRO DE EQUIPAMENTOS2.png`,
  'CADASTRO DE EQUIPAMENTOS3': `${CAD}/CADASTRO DE EQUIPAMENTOS3.png`,
  'CADASTRO DE VEICULOS - RASTREADOS 1': `${CAD}/CADASTRO DE VEICULOS - RASTREADOS 1.png`,
  'CADASTRO DE VEICULOS - RASTREADOS 2': `${CAD}/CADASTRO DE VEICULOS - RASTREADOS 2.png`,
  'CADASTRO DE VEICULOS - RASTREADOS 3': `${CAD}/CADASTRO DE VEICULOS - RASTREADOS 3.png`,
  'CADASTRO DE VEICULOS - RASTREADOS 4': `${CAD}/CADASTRO DE VEICULOS - RASTREADOS 4.png`,
  'CADASTRO DE VEICULOS - RASTREADOS 5': `${CAD}/CADASTRO DE VEICULOS - RASTREADOS 5.png`,
  'CADASTRO DE VEICULOS - RASTREADOS 6': `${CAD}/CADASTRO DE VEICULOS - RASTREADOS 6.png`,
  'Pasted image 20260909105345': 'Pasted image 20260909105345.png',
  'Pasted image 20260909110208': 'Pasted image 20260909110208.png',
  'Pasted image 20260909142443': 'Pasted image 20260909142443.png',
  'Pasted image 20260915093334': 'Pasted image 20260915093334.png',
  'Pasted image 20260915093429': 'Pasted image 20260915093429.png',
  'cortar(1)':                   'cortar(1).jpg',
  'Pasted image 20260720153100': 'Pasted image 20260720153100.png',
  'Pasted image 20260720153402': 'Pasted image 20260720153402.png',
  'Pasted image 20260828144659': 'Pasted image 20260828144659.png',
  'Pasted image 20260828144756': 'Pasted image 20260828144756.png',
  'Pasted image 20260828144850': 'Pasted image 20260828144850.png',
  'Pasted image 20260828142839': 'Pasted image 20260828142839.png',
  'Pasted image 20260828142937': 'Pasted image 20260828142937.png',
  'Pasted image 20260828143005': 'Pasted image 20260828143005.png',
  'Pasted image 20260828143024': 'Pasted image 20260828143024.png',
  'Pasted image 20260828143049': 'Pasted image 20260828143049.png',
  'Pasted image 20260828143250': 'Pasted image 20260828143250.png',
  'Pasted image 20260828150352': 'Pasted image 20260828150352.png',
  'Pasted image 20260828142654': 'Pasted image 20260828142654.png',
};

export const processes = [
  {
    title: 'DADOS DE MONITORAMENTO',
    description: 'Cadastro e conferência dos dados da empresa contratante na plataforma FullTrack. São as informações de identificação e de suporte que aparecem para o cliente.',
    steps: [
      { title: 'ABRIR DADOS DO MONITORAMENTO', description: 'Acesse o módulo de dados do monitoramento na plataforma.', section: 'Acesso', photo: 'DADOS DE MONITORAMENTO' },
      { title: 'CONFERIR OS DADOS DA EMPRESA', description: 'Confirme as informações de identificação e os dados de suporte da empresa contratante.', section: 'Cadastro', photo: 'DADOS DE MONITORAMENTO 1' },
      { title: 'CADASTRAR OS CANAIS DE ATENDIMENTO', description: 'Cadastre os canais de atendimento da empresa.', section: 'Cadastro', photo: 'DADOS DE MONITORAMENTO 2' },
      { title: 'CRIAR UM PERFIL MOBILE (OPCIONAL)', description: 'Caso deseje criar um perfil mobile, siga por esta tela.', section: 'Cadastro', photo: 'DADOS DE MONITORAMENTO 3' },
      { title: 'CONTINUAR O CADASTRO DO PERFIL MOBILE', description: 'Prossiga com o preenchimento do perfil mobile.', section: 'Cadastro', photo: 'DADOS DE MONITORAMENTO 4' },
      { title: 'SELECIONAR E EDITAR', description: 'Selecione o registro desejado e clique em editar.', section: 'Edição', photo: 'DADOS DE MONITORAMENTO 5' },
      { title: 'CONFIRMAR A EDIÇÃO', description: 'Confirme e salve as alterações.', section: 'Edição', photo: 'DADOS DE MONITORAMENTO 6' },
    ],
  },
  {
    title: 'CADASTRO DE CLIENTES',
    description: 'Como criar um cliente na FullTrack, cadastrar contatos, definir o perfil mobile e liberar os acessos da plataforma WEB.',
    steps: [
      { title: 'ACESSAR O MENU DE CLIENTES', description: 'Vá em CADASTRO -> CLIENTES.', section: 'Acesso', photo: 'CADATRO DE CLIENTES 0' },
      { title: 'PREENCHER OS DADOS DO CLIENTE', description: 'Preencha os dados do cliente. ATENÇÃO: o campo "Liberado" deve estar marcado como SIM se você quiser que o cliente tenha acesso ao sistema.', section: 'Cadastro', photo: null },
      { title: 'CADASTRAR OS CONTATOS', description: 'Ainda na aba de cadastro de clientes, cadastre os contatos. Eles servem para o usuário utilizar o F-Mobile e para a equipe conseguir entrar em contato com o cliente.', section: 'Cadastro', photo: 'Pasted image 20260909105345' },
      { title: 'DEFINIR O PERFIL MOBILE', description: 'O perfil mobile define as permissões que o aplicativo do usuário vai ter. Podem ser criados vários tipos de perfil — por função (administrador, piloto) ou por plano (bronze, silver, gold...).', section: 'Permissões', photo: 'Pasted image 20260909110208' },
      { title: 'CONCLUIR O CADASTRO', description: 'Finalize o cadastro do cliente.', section: 'Cadastro', photo: 'CADATRO DE CLIENTES 2' },
      { title: 'LIBERAR O ACESSO À PLATAFORMA WEB', description: 'Dentro do cadastro do cliente existe o menu de acesso, que permite liberar acessos e grupos de comandos. Acessos recomendados pela FULLTIME para clientes finais: mapa geral, relatórios, manutenção, motorista (a depender do caso), cadastro de itinerário, cadastro de outros e cadastro de motoristas.', section: 'Permissões', photo: 'Pasted image 20260909142443' },
      { title: 'CONFERIR OS RELATÓRIOS LIBERADOS', description: 'Relatórios recomendados: itinerário, velocidade, alertas e cadastro de usuários do sistema.', section: 'Permissões', photo: 'CADATRO DE CLIENTES 3' },
    ],
  },
  {
    title: 'CADASTRO EXPRESSO',
    description: 'Cadastro rápido de cliente pela tela de Cadastro Expresso.',
    steps: [
      { title: 'ABRIR O CADASTRO EXPRESSO', description: 'Acesse a tela de Cadastro Expresso.', section: 'Acesso', photo: 'CADASTRO EXPRESSO0' },
      { title: 'PREENCHER E CONCLUIR', description: 'Preencha os dados solicitados e finalize o cadastro.', section: 'Cadastro', photo: 'CADASTRO EXPRESSO 1' },
    ],
  },
  {
    title: 'CADASTRO DE EQUIPAMENTOS',
    description: 'Cadastro de equipamentos rastreadores na FullTrack, diferença entre COMODATO e ACESSO, preenchimento dos dados do chip e ativação do equipamento.',
    steps: [
      { title: 'ABRIR O CADASTRO DE EQUIPAMENTOS', description: 'Acesse o módulo de cadastro de equipamentos.', section: 'Acesso', photo: 'CADASTRO DE EQUIPAMENTOS' },
      { title: 'ENTENDER COMODATO X ACESSO', description: 'COMODATO: equipamento providenciado pela Fulltime. ACESSO: equipamento comprado com terceiros.', section: 'Conceito', photo: 'CADASTRO DE EQUIPAMENTOS1' },
      { title: 'CADASTRAR O ACESSO', description: 'Preencha os campos do equipamento. ID do equipamento = ID do rastreador. Número do chip = número extenso que vem impresso no chip. Linha = número do telefone (55119********).', section: 'Cadastro', photo: 'CADASTRO DE EQUIPAMENTOS2' },
      { title: 'DEFINIR OS CAMPOS EXIBIDOS NO F/MOBILE', description: 'Segundo a equipe X3TECH, o rastreador XT40-TM possui Odômetro e Horímetro, portanto podem ser utilizados como embarcados. Utilizar o odômetro/horímetro da plataforma exige cadastro prévio.', section: 'Configuração', photo: null },
      { title: 'ATIVAR O ACESSO', description: 'Depois de cadastrar o acesso, é obrigatório ativá-lo.', section: 'Ativação', photo: 'CADASTRO DE EQUIPAMENTOS3' },
    ],
  },
  {
    title: 'CADASTRO DE VEÍCULOS / RASTREADOS',
    description: 'Cadastro de veículos, pessoas ou cargas rastreadas na FullTrack, incluindo limite de velocidade e configuração de providências.',
    steps: [
      { title: 'ESCOLHER O TIPO DE CADASTRO', description: 'Veículos: moto, carro ou caminhão. Pessoas: monitoramento pessoal. Outros: exemplo, carga.', section: 'Acesso', photo: 'CADASTRO DE VEICULOS - RASTREADOS 1' },
      { title: 'ACESSAR O CADASTRO DE VEÍCULOS', description: 'Entre no cadastro de veículos por este caminho.', section: 'Cadastro', photo: 'CADASTRO DE VEICULOS - RASTREADOS 2' },
      { title: 'CAMINHO ALTERNATIVO PARA O CADASTRO', description: 'O cadastro também pode ser acessado por este outro caminho.', section: 'Cadastro', photo: 'CADASTRO DE VEICULOS - RASTREADOS 3' },
      { title: 'INICIAR O CADASTRO DO RASTREADO', description: 'Comece o cadastro do rastreado.', section: 'Cadastro', photo: 'CADASTRO DE VEICULOS - RASTREADOS 4' },
      { title: 'CONTINUAR O CADASTRO DO RASTREADO', description: 'Prossiga com o preenchimento.', section: 'Cadastro', photo: 'CADASTRO DE VEICULOS - RASTREADOS 5' },
      { title: 'PREENCHER OS CAMPOS PRINCIPAIS', description: 'Descrição: nome do veículo. Limite de velocidade: gera alertas caso o limite seja ultrapassado.', section: 'Cadastro', photo: 'CADASTRO DE VEICULOS - RASTREADOS 6' },
      { title: 'CONFIGURAR OPÇÕES -> PROVIDÊNCIAS', description: 'PALAVRA-CHAVE: pessoa que entra em contato com o veículo. RESPOSTA: resposta que o motorista deve dar para que a ação seja executada. AÇÕES: o que acontece após a resposta.', section: 'Configuração', photo: null },
    ],
  },
  {
    title: 'MUDAR A TAG (RFID) ATRIBUÍDA AO MOTORISTA',
    description: 'Como localizar o motorista no cadastro e editar o RFID, incluindo a regra de leitura do número válido impresso na TAG.',
    steps: [
      { title: 'ACESSAR CADASTRO -> MOTORISTA', description: 'Vá em CADASTRO -> MOTORISTA.', section: 'Acesso', photo: 'Pasted image 20260915093334' },
      { title: 'LOCALIZAR O MOTORISTA', description: 'Dentro do cadastro de motorista, identifique os motoristas cujo RFID você deseja editar.', section: 'Edição', photo: 'Pasted image 20260915093429' },
      { title: 'LER O NÚMERO CORRETO DA TAG', description: 'O número válido nas TAGs é contado a partir do último zero sequencial e vai até o primeiro espaço. Exemplo: na TAG da imagem, o número é 9951982.', section: 'Leitura da TAG', photo: 'cortar(1)' },
    ],
  },
  {
    title: 'CRIAR PERFIL DE EVENTOS (PERFIL DE ALERTA)',
    description: 'O Perfil de Eventos, também chamado de perfil de alertas, serve para atrelar a placa ao recebimento de eventos como ignição e cabo de bateria violado.',
    steps: [
      { title: 'ACESSAR O PERFIL DE EVENTOS', description: 'Abra o módulo de perfil de eventos.', section: 'Acesso', photo: 'Pasted image 20260720153100' },
      { title: 'CRIAR UM NOVO PERFIL', description: 'Clique em "criar um" e preencha o novo perfil de alerta.', section: 'Criação', photo: 'Pasted image 20260720153402' },
      { title: 'VINCULAR O PERFIL AO VEÍCULO', description: 'Atrele o perfil criado à placa/veículo desejado (ver processo CADASTRO DE VEÍCULOS / RASTREADOS).', section: 'Vínculo', photo: null },
    ],
  },
  {
    title: 'INSTALAÇÃO FÍSICA E ATIVAÇÃO DO RASTREADOR X3TECH',
    description: 'Instalação da parte física do rastreador X3Tech, da ligação dos cabos até a ativação do chip por SMS. Requisito: fonte de 12V.',
    steps: [
      { title: 'SEPARAR UMA FONTE DE 12V', description: 'A parte física necessita de uma fonte de 12V.', section: 'Preparação', photo: null },
      { title: 'LIGAR OS CABOS DE ALIMENTAÇÃO', description: 'Cabo VERMELHO no positivo (+) da fonte. Cabo PRETO no negativo (-) da fonte. Cabo LARANJA na ignição — pode ser ligado junto ao positivo para testar, simulando que está ligando e desligando o veículo. O vermelho e o preto saem emendados e terminam no conector que é plugado no rastreador.', section: 'Ligação dos cabos', photo: 'Pasted image 20260828144659' },
      { title: 'CONFERIR A EMENDA DOS CABOS', description: 'Emenda do cabo vermelho com o preto, protegida com fita ou termorretrátil.', section: 'Ligação dos cabos', photo: 'Pasted image 20260828144756' },
      { title: 'ENCAIXAR O CONECTOR NO CHICOTE', description: 'Lado do conector que entra no chicote do rastreador (chicote completo ao fundo).', section: 'Ligação dos cabos', photo: 'Pasted image 20260828144850' },
      { title: 'CONFERIR O CHICOTE COMPLETO', description: 'Confira a ligação dos cabos no chicote.', section: 'Ligação dos cabos', photo: 'Pasted image 20260828142839' },
      { title: 'CONECTAR E CONFIGURAR O RFID', description: 'O RFID deve ser configurado na plataforma. A conexão deve ser feita no primeiro encaixe que serve nele. É o equipamento que fica exposto, no qual o motorista deve atrelar a sua TAG de identificação. IMPORTANTE: anote o SN (número de série) do RFID.', section: 'Periféricos', photo: 'Pasted image 20260828142937' },
      { title: 'IDENTIFICAR O RASTREADOR (IMEI / Nº DE SÉRIE)', description: 'O rastreador é a unidade onde são conectados os periféricos. IMPORTANTE: anote o IMEI e/ou o número de série do rastreador.', section: 'Periféricos', photo: 'Pasted image 20260828143005' },
      { title: 'INSERIR O CHIP (SIM)', description: 'Anote o número do chip e adicione-o no rastreador.', section: 'Chip', photo: 'Pasted image 20260828143024' },
      { title: 'VIRAR A CHAVE DO RASTREADOR PARA ON', description: 'Após inserir o chip, vire a chave do rastreador para ON. Não esqueça deste passo.', section: 'Chip', photo: 'Pasted image 20260828143049' },
      { title: 'LIGAR O CHICOTE DE CONEXÃO AO RASTREADOR', description: 'Ligue o conector do chicote ao rastreador. Vermelho no positivo (+), preto no negativo (-) e laranja (ignição) no positivo (+).', section: 'Ligação dos cabos', photo: 'Pasted image 20260828143250' },
      { title: 'ENVIAR OS SMS DE ATIVAÇÃO DO CHIP', description: 'Envie três SMS para o número do chip instalado no equipamento, um comando por mensagem e nesta ordem: (1) SETLOCX22#  (2) APN,fulltime.com,ft,ft#  (3) SERVER,8520,x3tech.ftdata.com.br,9680#  — ATENÇÃO: não junte os três comandos num SMS só.', section: 'Ativação', photo: 'Pasted image 20260828150352' },
      { title: 'CONFERIR O RESULTADO FINAL', description: 'Confira: todos os cabos ligados, chip inserido, chave em ON, RFID e periféricos conectados, SN do RFID e IMEI do rastreador anotados.', section: 'Conferência', photo: 'Pasted image 20260828142654' },
    ],
  },
  {
    title: 'ACESSO À API FULLTRACK',
    description: 'Regras de uso da API da plataforma FullTrack liberada para a CONEXÃO WEB TELECOM. Base URL: http://ws.fulltrack2.com — Documentação: http://ws.fulltrack2.com/apidoc/',
    steps: [
      { title: 'OBTER AS CREDENCIAIS', description: 'Solicite a APIKEY e a SECRET KEY na nota interna de credenciais da FullTrack. Estas chaves dão acesso aos dados de rastreamento da empresa — não colar em e-mail, grupo de WhatsApp, repositório público ou chamado de suporte.', section: 'Preparação', photo: null },
      { title: 'CONSULTAR A DOCUMENTAÇÃO DOS ENDPOINTS', description: 'Acesse http://ws.fulltrack2.com/apidoc/ e confira quais parâmetros o endpoint desejado exige.', section: 'Preparação', photo: null },
      { title: 'USAR O ID DA PLATAFORMA PARA VEÍCULOS', description: 'Endpoints relacionados a veículos são consultados SEMPRE pelo ID de cadastro da plataforma FullTrack — não pela placa, nem pelo IMEI, nem pelo nome do cliente. O ID fica no cadastro do veículo (ver processo CADASTRO DE VEÍCULOS / RASTREADOS).', section: 'Regras de consulta', photo: null },
      { title: 'CONVERTER AS DATAS PARA TIMESTAMP', description: 'Endpoints que recebem período (data inicial / data final) exigem as datas em timestamp Unix, não em dd/mm/aaaa. Conversor online: https://www.epochconverter.com/', section: 'Regras de consulta', photo: null },
      { title: 'AJUSTAR O FUSO HORÁRIO (GMT 0 -> GMT-3)', description: 'A API responde em GMT 0 (UTC) e o Brasil está em GMT-3. Da API para o horário local: subtrair 3 horas. Do horário local para a API: somar 3 horas. Exemplo: evento retornado às 17:00 (GMT 0) aconteceu às 14:00 em Brasília. Antes de abrir chamado por "horário errado", confira o fuso — a maioria das divergências é só a diferença de 3 horas.', section: 'Regras de consulta', photo: null },
      { title: 'DELIMITAR O ESCOPO DO SUPORTE', description: 'Qualquer uso ou integração com outro sistema é de responsabilidade do CLIENTE, que deve contratar um desenvolvedor para aplicar. A FullTrack fornece a API e a documentação — não a implementação.', section: 'Escopo', photo: null },
    ],
  },
];
