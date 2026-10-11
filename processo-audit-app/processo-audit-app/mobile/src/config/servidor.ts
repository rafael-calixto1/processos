import { normalizarUrlServidor, type ResultadoUrl } from '@/api/servidor';
import type { Armazenamento } from '@/auth/armazenamento';

const CHAVE = 'os.config.servidor';

/** Endereço do servidor: o que o técnico digitou (guardado no aparelho) ou o padrão de EXPO_PUBLIC_API_URL. */
export class ConfigServidor {
  private atual: string | null;
  private readonly armazenamento: Armazenamento;
  constructor(armazenamento: Armazenamento, padrao?: string) {
    this.armazenamento = armazenamento;
    const n = padrao ? normalizarUrlServidor(padrao) : null;
    this.atual = n?.ok ? n.url : null;
  }
  async carregar(): Promise<void> {
    const salvo = await this.armazenamento.get(CHAVE);
    if (salvo) this.atual = salvo;
  }
  url(): string | null { return this.atual; }
  async definir(texto: string): Promise<ResultadoUrl> {
    const n = normalizarUrlServidor(texto);
    if (!n.ok) return n;
    this.atual = n.url;
    await this.armazenamento.set(CHAVE, n.url);
    return n;
  }
}
