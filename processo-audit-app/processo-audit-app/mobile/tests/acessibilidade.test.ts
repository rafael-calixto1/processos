/**
 * Varredura de acessibilidade no código-fonte das telas e componentes: todo toque precisa dizer o que é e o que faz para o leitor de
 * tela (TalkBack/VoiceOver), e todo campo de texto precisa de rótulo. Não substitui testar no aparelho com o leitor ligado.
 */
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const raizSrc = path.resolve(__dirname, '../src');
const arquivos = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? (e.name === '__tests__' ? [] : arquivos(path.join(d, e.name))) : e.name.endsWith('.tsx') ? [path.join(d, e.name)] : []));

interface Achado { onde: string; problema: string }
const varrer = (): Achado[] => {
  const achados: Achado[] = [];
  for (const arquivo of arquivos(raizSrc)) {
    const sf = ts.createSourceFile(arquivo, fs.readFileSync(arquivo, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const visitar = (n: ts.Node) => {
      if (ts.isJsxSelfClosingElement(n) || ts.isJsxOpeningElement(n)) {
        const nome = n.tagName.getText();
        const props = new Set(n.attributes.properties.filter(ts.isJsxAttribute).map((a) => a.name.getText()));
        const repasse = n.attributes.properties.some(ts.isJsxSpreadAttribute); // props repassadas: quem chama é conferido no ponto de uso
        const tem = (...ps: string[]) => repasse || ps.some((p) => props.has(p));
        const onde = `${path.relative(raizSrc, arquivo)}:${sf.getLineAndCharacterOfPosition(n.getStart()).line + 1}`;
        if (nome === 'Pressable' && !tem('accessibilityRole')) achados.push({ onde, problema: 'Pressable sem accessibilityRole' });
        if (nome === 'Pressable' && !tem('accessibilityLabel')) achados.push({ onde, problema: 'Pressable sem accessibilityLabel' });
        if (nome === 'TextInput' && !tem('accessibilityLabel')) achados.push({ onde, problema: 'TextInput sem accessibilityLabel' });
        if (nome === 'Image' && !tem('accessibilityLabel', 'accessible', 'accessibilityElementsHidden', 'importantForAccessibility')) achados.push({ onde, problema: 'Image sem descrição' });
        if (['TouchableOpacity', 'TouchableHighlight', 'TouchableWithoutFeedback'].includes(nome)) achados.push({ onde, problema: `${nome} (use Pressable com papel e rótulo)` });
      }
      ts.forEachChild(n, visitar);
    };
    visitar(sf);
  }
  return achados;
};

describe('acessibilidade do código', () => {
  it('nenhum toque sem papel e rótulo, nenhum campo sem rótulo, nenhuma imagem sem descrição', () => {
    expect(varrer()).toEqual([]);
  });
  it('a varredura de fato enxerga problemas (um Pressable sem rótulo seria apontado)', () => {
    const sf = ts.createSourceFile('x.tsx', '<Pressable onPress={f}><Text>a</Text></Pressable>', ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    let achou = false;
    const v = (n: ts.Node) => { if (ts.isJsxOpeningElement(n) && n.tagName.getText() === 'Pressable' && !n.attributes.properties.some((p) => ts.isJsxAttribute(p) && p.name.getText() === 'accessibilityRole')) achou = true; ts.forEachChild(n, v); };
    v(sf);
    expect(achou).toBe(true);
    expect(arquivos(raizSrc).length).toBeGreaterThan(30); // está varrendo o projeto de verdade
  });
});
