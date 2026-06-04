import React, { useState } from 'react';
import { hubsoftAPI } from '../api/index';
import { Play, Database, Info, Users, MessageSquare, Terminal, ChevronRight, Copy, Check, Search } from 'lucide-react';
import styles from './HubsoftExplorer.module.css';

const PRESETS = [
  {
    id: 'introspection',
    name: 'Explorar Schema (Raiz)',
    icon: Info,
    query: `query {
  __schema {
    queryType {
      fields {
        name
        description
      }
    }
  }
}`
  },
  {
    id: 'explore_cliente',
    name: 'Ver Campos de Cliente',
    icon: Database,
    query: `query {
  __type(name: "Cliente") {
    fields {
      name
      type {
        name
        kind
      }
    }
  }
}`
  },
  {
    id: 'explore_servico_base',
    name: 'Ver Campos de Servico (Base)',
    icon: Database,
    query: `query {
  __type(name: "Servico") {
    fields {
      name
      type { name kind }
    }
  }
}`
  },
  {
    id: 'explore_servico_status',
    name: 'Ver Campos de Status',
    icon: Database,
    query: `query {
  __type(name: "ServicoStatus") {
    fields {
      name
      type { name kind }
    }
  }
}`
  },
  {
    id: 'explore_usuario',
    name: 'Ver Campos de Usuário',
    icon: Database,
    query: `query {
  __type(name: "User") {
    fields {
      name
      type { name kind }
    }
  }
  }`
  },
  {
    id: 'atendimentos',
    name: 'Listar Atendimentos',
    icon: MessageSquare,
    query: `query {
  atendimentos(first: 10, page: 1) {
    paginatorInfo {
      total
    }
    data {
      id_atendimento
      data_cadastro
      usuario_abertura {
        name
      }
    }
  }
  }`
  },
  {
    id: 'explore_login_type',
    name: 'Ver Campos de Login/Autenticação',
    icon: Database,
    query: `query {
  __type(name: "ClienteServicoAutenticacao") {
    fields {
      name
      type { name kind }
    }
  }
}`
  },
  {
    id: 'explore_radius_status',
    name: 'Ver Campos do Status Radius',
    icon: Database,
    query: `query {
  __type(name: "StatusConexaoRadius") {
    fields {
      name
      type { name kind }
    }
  }
}`
  },
  {
    id: 'explore_logins_args',
    name: 'Ver Filtros de Logins',
    icon: Database,
    query: `query {
  __type(name: "Query") {
    fields {
      name
      args {
        name
        type { name kind }
      }
    }
  }
}`
  },
  {
    id: 'explore_servico_fields',
    name: 'Ver Campos do Serviço do Cliente',
    icon: Database,
    query: `query {
  __type(name: "ClienteServico") {
    fields {
      name
      type { name kind }
    }
  }
}`
  },
  {
    id: 'diag_search_login',
    name: 'Diagnóstico: Buscar Login denisfabio1',
    icon: Search,
    query: `query {
  logins(login: "denisfabio1", first: 1) {
    data {
      id_cliente_servico
      login
    }
  }
}`
  },
  {
    id: 'diag_search_cliente',
    name: 'Diagnóstico: Buscar Cliente denisfabio1',
    icon: Search,
    query: `query {
  clienteByNomeRazaoSocial(nome_razaosocial: "denisfabio1", first: 1) {
    data {
      nome_razaosocial
      servicos {
        id_cliente_servico
        cliente_servico_autenticacao {
          login
        }
      }
    }
  }
}`
  },
  {
    id: 'logins',
    name: 'Listar Logins (PPPoE/IP)',
    icon: Terminal,
    query: `query {
  logins(first: 10, page: 1) {
    paginatorInfo {
      total
    }
    data {
      id_cliente_servico
      login
      mac_addr
      vlan
      status_conexao_radius {
        status
        ipv4
        ipv6_wan
        ip_nas
        data_inicio_sessao
      }
    }
  }
}`
  },
  {
    id: 'clientes',
    name: 'Lista de Clientes Detalhada',
    icon: Users,
    query: `query {
  clientes(first: 10, page: 1) {
    paginatorInfo {
      total
      currentPage
      lastPage
    }
    data {
      id_cliente
      codigo_cliente
      nome_razaosocial
      cpf_cnpj
      tipo_pessoa
      data_cadastro
      telefone_primario
      email_principal
      servicos {
        id_cliente_servico
        numero_plano
        valor
        # Use os novos presets para descobrir como pegar o nome do serviço e status
      }
      # O tipo ClienteEnderecoNumero falhou com campos comuns. 
      # Use "Ver Campos de Endereço" para ver o que ele tem.
    }
  }
}`
  },
  {
    id: 'explore_atendimento',
    name: 'Ver Campos de Atendimento',
    icon: Database,
    query: `query {
  __type(name: "Atendimento") {
    fields {
      name
      type { name kind }
    }
  }
}`
  },
  {
    id: 'explore_usuario',
    name: 'Ver Campos de Usuário',
    icon: Database,
    query: `query {
  __type(name: "User") {
    fields {
      name
      type { name kind }
    }
  }
}`
  },
  {
    id: 'atendimentos',
    name: 'Atendimentos (Campos Corrigidos)',
    icon: MessageSquare,
    query: `query {
  atendimentos(first: 10) {
    paginatorInfo {
      total
    }
    data {
      id_atendimento
      # protocolo (verificar nome exato com preset 'Ver Campos de Atendimento')
      data_cadastro
      usuario_abertura {
        name
      }
    }
  }
}`
  }
];

const HubsoftExplorer = () => {
  const [query, setQuery] = useState(PRESETS[0].query);
  const [variables, setVariables] = useState('{}');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  const handleExecute = async () => {
    setLoading(true);
    setError(null);
    try {
      const vars = JSON.parse(variables || '{}');
      const data = await hubsoftAPI.graphql(query, vars);
      setResult(data);
    } catch (err) {
      setError(err.message);
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(JSON.stringify(result, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.titleGroup}>
          <div className={styles.iconBox}>
            <Database size={24} />
          </div>
          <div>
            <h1>HubSoft GraphQL Explorer</h1>
            <p>Explore os dados e o schema da API do HubSoft em tempo real.</p>
          </div>
        </div>
      </header>

      <div className={styles.mainGrid}>
        <aside className={styles.sidebar}>
          <h3>Sugestões de Query</h3>
          <div className={styles.presetList}>
            {PRESETS.map((preset) => (
              <button
                key={preset.id}
                className={`${styles.presetBtn} ${query === preset.query ? styles.activePreset : ''}`}
                onClick={() => setQuery(preset.query)}
              >
                <preset.icon size={18} />
                <span>{preset.name}</span>
                <ChevronRight size={14} className={styles.arrow} />
              </button>
            ))}
          </div>

          <div className={styles.hint}>
            <p><strong>Dica:</strong> O GraphQL do HubSoft é paginado. Use <code>(first: 10, page: 1)</code> em suas consultas.</p>
            <p><strong>Dica 2:</strong> Se campos como <code>servicos</code> ou <code>meios_contato</code> derem erro, use o preset <strong>"Ver Campos de Cliente"</strong> para descobrir os nomes exatos no seu schema.</p>
          </div>
        </aside>

        <section className={styles.editorSection}>
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <div className={styles.tab}>
                <Terminal size={16} />
                <span>Query</span>
              </div>
              <button
                className={styles.executeBtn}
                onClick={handleExecute}
                disabled={loading || !query.trim()}
              >
                {loading ? <div className={styles.spinner} /> : <Play size={16} />}
                Executar
              </button>
            </div>
            <textarea
              className={styles.textarea}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Digite sua query GraphQL aqui..."
              spellCheck="false"
            />
          </div>

          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <span>Variáveis (JSON)</span>
            </div>
            <textarea
              className={`${styles.textarea} ${styles.variables}`}
              value={variables}
              onChange={(e) => setVariables(e.target.value)}
              placeholder="{}"
              spellCheck="false"
            />
          </div>
        </section>

        <section className={styles.resultSection}>
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <span>Resultado</span>
              {result && (
                <button className={styles.copyBtn} onClick={copyToClipboard}>
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? 'Copiado!' : 'Copiar JSON'}
                </button>
              )}
            </div>
            <div className={styles.resultContent}>
              {loading && (
                <div className={styles.loadingState}>
                  <div className={styles.spinnerLarge} />
                  <p>Consultando HubSoft...</p>
                </div>
              )}

              {error && (
                <div className={styles.errorBox}>
                  <strong>Erro na requisição:</strong>
                  <pre>{error}</pre>
                </div>
              )}

              {!loading && !error && !result && (
                <div className={styles.emptyState}>
                  <Play size={48} />
                  <p>Pressione "Executar" para ver os resultados.</p>
                </div>
              )}

              {result && (
                <pre className={styles.jsonOutput}>
                  {JSON.stringify(result, null, 2)}
                </pre>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default HubsoftExplorer;
