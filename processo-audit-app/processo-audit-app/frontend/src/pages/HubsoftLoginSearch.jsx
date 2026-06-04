import React, { useState } from 'react';
import { hubsoftAPI } from '../api/index';
import { Search, Wifi, WifiOff, Globe, Cpu, Clock, MapPin, User, Activity } from 'lucide-react';
import styles from './HubsoftLoginSearch.module.css';

const HubsoftLoginSearch = () => {
  const [loginSearch, setLoginSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!loginSearch.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      // 1. Tentar buscar o login diretamente via GraphQL (Método mais seguro pois validamos o schema)
      const gqlSearchQuery = `
        query($login: String) {
          logins(login: $login, first: 1) {
            data {
              id_cliente_servico
              login
            }
          }
        }
      `;
      
      let foundServiceId = null;
      try {
        const gqlSearchData = await hubsoftAPI.graphql(gqlSearchQuery, { login: loginSearch });
        foundServiceId = gqlSearchData.data?.logins?.data?.[0]?.id_cliente_servico;
      } catch (e) {
        console.warn('Erro na busca inicial GraphQL:', e);
      }

      // 2. Se não encontrou via GraphQL, tenta via REST 'cliente/todos' (Parâmetro 'termo')
      if (!foundServiceId) {
        try {
          const restResponse = await hubsoftAPI.get('api/v1/integracao/cliente/todos', { 
            termo: loginSearch 
          });
          const clientes = restResponse.clientes || restResponse.data || [];
          
          for (const cli of clientes) {
            const srv = cli.servicos?.find(s => s.login?.toLowerCase() === loginSearch.toLowerCase());
            if (srv) {
              foundServiceId = srv.id_cliente_servico;
              break;
            }
          }
        } catch (e) {
          console.warn('Erro na busca fallback REST:', e);
        }
      }

      if (!foundServiceId) {
        setError(`O login "${loginSearch}" não foi encontrado. Verifique se o login está correto.`);
        setLoading(false);
        return;
      }

      // 3. Com o ID do serviço (seja do GraphQL ou REST), buscamos o dossiê completo
      const fullGqlQuery = `
        query($id: Int!) {
          servicos(id_cliente_servico: $id, first: 1) {
            data {
              id_cliente_servico
              cliente { 
                nome_razaosocial 
                cpf_cnpj
              }
              cliente_servico_autenticacao {
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
          }
        }
      `;

      const [gqlDetail, restDetail] = await Promise.allSettled([
        hubsoftAPI.graphql(fullGqlQuery, { id: parseInt(foundServiceId) }),
        hubsoftAPI.get('api/v1/integracao/cliente/todos', { login: loginSearch })
      ]);

      const servicoGql = gqlDetail.status === 'fulfilled' ? gqlDetail.value.data?.servicos?.data?.[0] : null;
      const restResults = restDetail.status === 'fulfilled' ? (restDetail.value.clientes || restDetail.value.data || []) : [];
      const servicoRest = restResults[0]?.servicos?.find(s => s.id_cliente_servico == foundServiceId) || restResults[0]?.servicos?.[0];
      const clienteRest = restResults[0];

      if (!servicoGql && !servicoRest) {
        setError('Não foi possível carregar os detalhes do login encontrado.');
        setLoading(false);
        return;
      }

      setResult({
        login: servicoGql?.cliente_servico_autenticacao?.login || servicoRest?.login || loginSearch,
        senha: servicoRest?.senha || 'Não disponível',
        id_cliente_servico: foundServiceId,
        nome_cliente: servicoGql?.cliente?.nome_razaosocial || clienteRest?.nome_razaosocial,
        cpf_cnpj: servicoGql?.cliente?.cpf_cnpj || clienteRest?.cpf_cnpj,
        plano: servicoRest?.nome || 'Plano não identificado',
        valor: servicoRest?.valor,
        tecnologia: servicoRest?.tecnologia || 'FIBRA',
        status_servico: servicoRest?.status || 'Habilitado',
        mac_addr: servicoGql?.cliente_servico_autenticacao?.mac_addr || servicoRest?.mac_addr,
        vlan: servicoGql?.cliente_servico_autenticacao?.vlan || servicoRest?.vlan,
        endereco: servicoRest?.endereco_instalacao?.completo || 'Endereço não disponível',
        coordenadas: servicoRest?.endereco_instalacao?.coordenadas,
        status_conexao_radius: servicoGql?.cliente_servico_autenticacao?.status_conexao_radius || { status: 'Desconectado' }
      });

    } catch (err) {
      setError('Erro crítico na consulta: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const isOnline = result?.status_conexao_radius?.status === 'Conectado' || 
                   result?.status_conexao_radius?.status === 'online';

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.titleGroup}>
          <div className={styles.iconBox}>
            <Activity size={24} />
          </div>
          <div>
            <h1>Consulta Login PPPoE</h1>
            <p>Verifique o status e informações técnicas de um login em tempo real.</p>
          </div>
        </div>
      </header>

      <div className={styles.searchCard}>
        <form onSubmit={handleSearch} className={styles.searchForm}>
          <div className={styles.inputWrapper}>
            <Search className={styles.searchIcon} size={20} />
            <input
              type="text"
              placeholder="Digite o login PPPoE (ex: joao@provedor)..."
              value={loginSearch}
              onChange={(e) => setLoginSearch(e.target.value)}
              className={styles.input}
              autoFocus
            />
          </div>
          <button type="submit" className={styles.searchButton} disabled={loading || !loginSearch.trim()}>
            {loading ? <div className={styles.spinner} /> : 'Consultar'}
          </button>
        </form>
      </div>

      {error && (
        <div className={styles.errorBox}>
          <p>{error}</p>
        </div>
      )}

      {result && (
        <div className={styles.resultGrid}>
          {/* Card de Status Principal */}
          <div className={`${styles.card} ${styles.statusCard} ${isOnline ? styles.online : styles.offline}`}>
            <div className={styles.statusHeader}>
              {isOnline ? <Wifi size={48} /> : <WifiOff size={48} />}
              <div className={styles.statusInfo}>
                <span className={styles.statusLabel}>Status Atual</span>
                <h2 className={styles.statusValue}>{result.status_conexao_radius?.status || 'Desconhecido'}</h2>
              </div>
            </div>
            <div className={styles.mainDetails}>
              <div className={styles.detailItem}>
                <User size={16} />
                <span>Cliente: <strong>{result.nome_cliente}</strong></span>
              </div>
              <div className={styles.detailItem}>
                <Activity size={16} />
                <span>ID Serviço: <strong>{result.id_cliente_servico}</strong></span>
              </div>
              <div className={styles.detailItem}>
                <Clock size={16} />
                <span>Senha: <strong>{result.senha}</strong></span>
              </div>
            </div>
          </div>

          {/* Card de Endereço */}
          <div className={`${styles.card} ${styles.fullWidth}`}>
            <div className={styles.cardHeader}>
              <MapPin size={20} />
              <h3>Localização e Endereço</h3>
            </div>
            <div className={styles.addressBody}>
              <p className={styles.addressText}>{result.endereco || 'Endereço não informado'}</p>
              {result.coordenadas?.latitude && (
                <a 
                  href={`https://www.google.com/maps?q=${result.coordenadas.latitude},${result.coordenadas.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.mapLink}
                >
                  <MapPin size={16} /> Ver no Google Maps
                </a>
              )}
            </div>
          </div>

          {/* Card de Rede IPv4/IPv6 */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <Globe size={20} />
              <h3>Endereçamento IP</h3>
            </div>
            <div className={styles.cardBody}>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>IPv4 Atual</span>
                <span className={styles.infoValue}>{result.status_conexao_radius?.ipv4 || '—'}</span>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>IPv6 WAN</span>
                <span className={styles.infoValue}>{result.status_conexao_radius?.ipv6_wan || '—'}</span>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>NAS / Concentrador</span>
                <span className={styles.infoValue}>{result.status_conexao_radius?.ip_nas || '—'}</span>
              </div>
            </div>
          </div>

          {/* Card de Informações Técnicas */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <Cpu size={20} />
              <h3>Dados Técnicos</h3>
            </div>
            <div className={styles.cardBody}>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>MAC Address</span>
                <span className={styles.infoValue}>{result.mac_addr || '—'}</span>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>VLAN</span>
                <span className={styles.infoValue}>{result.vlan || '—'}</span>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>Início da Sessão</span>
                <span className={styles.infoValue}>
                  {result.status_conexao_radius?.data_inicio_sessao ? 
                    new Date(result.status_conexao_radius.data_inicio_sessao).toLocaleString() : '—'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HubsoftLoginSearch;
