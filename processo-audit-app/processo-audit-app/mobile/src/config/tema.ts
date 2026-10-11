import type { Armazenamento } from '@/auth/armazenamento';
import { preferenciaValida, type PreferenciaTema } from '@/estado/tema';

const CHAVE = 'os.config.tema';

/** Escolha de tema do técnico, guardada no aparelho. Valor desconhecido ou ilegível volta ao padrão (seguir o aparelho). */
export class ConfigTema {
  private atualValor: PreferenciaTema = 'sistema';
  private readonly armazenamento: Armazenamento;
  constructor(armazenamento: Armazenamento) { this.armazenamento = armazenamento; }
  async carregar(): Promise<PreferenciaTema> {
    try {
      const salvo = await this.armazenamento.get(CHAVE);
      if (preferenciaValida(salvo)) this.atualValor = salvo;
    } catch { /* cofre indisponível: padrão */ }
    return this.atualValor;
  }
  atual(): PreferenciaTema { return this.atualValor; }
  async definir(p: PreferenciaTema): Promise<void> {
    this.atualValor = p;
    await this.armazenamento.set(CHAVE, p).catch(() => undefined); // não guardar não impede de aplicar agora
  }
}
