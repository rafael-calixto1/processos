import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

/* Identidade Conexão Web */
const C = {
  verde: [11, 165, 43], escuro: [39, 69, 24], lima: [187, 248, 4], fundo: [242, 246, 240], claro: [230, 249, 236],
  texto: [26, 26, 26], medio: [55, 65, 81], suave: [107, 114, 128], borda: [221, 229, 218],
};
const M = 14;          // margem lateral
const TOPO = 34;       // início do conteúdo (abaixo da faixa)

const carregarImagem = (url, tipo = 'image/png') => new Promise((resolve, reject) => {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const ctx = c.getContext('2d');
    if (tipo === 'image/jpeg') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); }
    ctx.drawImage(img, 0, 0);
    resolve({ dataURL: c.toDataURL(tipo, 0.92), width: img.width, height: img.height });
  };
  img.onerror = reject;
  img.src = url;
});

const faixa = (doc, logo, rotulo) => {
  const W = doc.internal.pageSize.width;
  doc.setFillColor(...C.escuro); doc.rect(0, 0, W, 24, 'F');
  doc.setFillColor(...C.lima); doc.rect(0, 24, W, 1.4, 'F');
  if (logo) { const h = 15; doc.addImage(logo.dataURL, 'PNG', M, 4.5, h * (logo.width / logo.height), h); }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...C.lima);
  doc.text(rotulo.toUpperCase().split('').join(' '), W - M, 13.8, { align: 'right' });
};

const rodape = (doc, texto) => {
  const W = doc.internal.pageSize.width, H = doc.internal.pageSize.height, n = doc.internal.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    doc.setDrawColor(...C.borda); doc.setLineWidth(0.3); doc.line(M, H - 14, W - M, H - 14);
    doc.setFillColor(...C.verde); doc.rect(M, H - 14.4, 14, 0.9, 'F');
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...C.suave);
    doc.text(texto, M, H - 9);
    doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.escuro);
    doc.text(`Página ${i} de ${n}`, W - M, H - 9, { align: 'right' });
  }
};

const pilula = (doc, x, y, rotulo, valor) => {
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold'); const wr = doc.getTextWidth(rotulo.toUpperCase());
  doc.setFont('helvetica', 'normal'); const wv = doc.getTextWidth(valor);
  const w = wr + wv + 11;
  doc.setFillColor(...C.claro); doc.roundedRect(x, y, w, 7, 3.5, 3.5, 'F');
  doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.verde); doc.text(rotulo.toUpperCase(), x + 4, y + 4.7);
  doc.setFont('helvetica', 'normal'); doc.setTextColor(...C.escuro); doc.text(valor, x + 7 + wr, y + 4.7);
  return w;
};

const pilulas = (doc, y, itens) => {
  const W = doc.internal.pageSize.width; let x = M;
  itens.filter(Boolean).forEach(([r, v]) => {
    doc.setFontSize(8);
    const prev = doc.getTextWidth(r.toUpperCase()) + doc.getTextWidth(v) + 11;
    if (x + prev > W - M) { x = M; y += 9; }
    x += pilula(doc, x, y, r, v) + 3;
  });
  return y + 9;
};

const titulo = (doc, texto, y) => {
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(...C.escuro);
  doc.text(texto.toUpperCase().split('').join(' '), M, y);
  doc.setFillColor(...C.lima); doc.rect(M, y + 2, 12, 1.1, 'F');
  doc.setDrawColor(...C.borda); doc.setLineWidth(0.3); doc.line(M + 13, y + 2.5, doc.internal.pageSize.width - M, y + 2.5);
  return y + 8;
};

const dataHora = () => new Date().toLocaleString('pt-BR');
const dataBR = (v) => (v ? new Date(v).toLocaleDateString('pt-BR') : '—');
const statusLabel = (s) => (s === 'active' ? 'Ativo' : s === 'draft' ? 'Rascunho' : s === 'archived' ? 'Arquivado' : s || '—');

/* ───────── PDF de um processo ───────── */
export const exportProcessPdf = async (process, getFullUrl = (u) => u) => {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.width;
  const logo = await carregarImagem('/logo-cw-full.png', 'image/png').catch(() => null);
  faixa(doc, logo, 'Processos');

  // Título + metadados
  doc.setFont('helvetica', 'bold'); doc.setFontSize(20); doc.setTextColor(...C.escuro);
  const tl = doc.splitTextToSize(process.title || 'Processo', W - 2 * M);
  doc.text(tl, M, TOPO + 6);
  let y = TOPO + 6 + tl.length * 8.2;
  y = pilulas(doc, y - 2, [
    ['Departamento', process.department_name || '—'], ['Versão', String(process.version ?? '—')],
    ['Status', statusLabel(process.status)], ['Criado por', process.created_by_name || '—'], ['Em', dataBR(process.created_at)],
  ]) + 3;

  // Descrição
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
  const dl = doc.splitTextToSize(process.description || 'Sem descrição', W - 2 * M - 12);
  const hDesc = Math.max(14, dl.length * 5 + 11);
  doc.setFillColor(...C.fundo); doc.roundedRect(M, y, W - 2 * M, hDesc, 2, 2, 'F');
  doc.setFillColor(...C.verde); doc.rect(M, y, 1.6, hDesc, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(...C.verde); doc.text('DESCRIÇÃO', M + 6, y + 5.5);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...C.medio); doc.text(dl, M + 6, y + 11);
  y += hDesc + 9;

  y = titulo(doc, `Passos do processo · ${process.steps?.length || 0}`, y);

  const passos = await Promise.all((process.steps || []).map(async (s) => {
    let img = null;
    if (s.photo_url) { try { img = await carregarImagem(getFullUrl(s.photo_url), 'image/jpeg'); } catch (e) { console.error('Erro ao carregar imagem para o PDF:', e); } }
    return { ...s, img };
  }));

  const linhas = []; const numeros = new Map(); const imagens = new Map(); const secoes = new Set();
  let ultima = null;
  passos.forEach((s, i) => {
    if (s.section && s.section !== ultima) {
      secoes.add(linhas.length);
      linhas.push([{ content: s.section, colSpan: 3, styles: { fillColor: C.escuro, textColor: C.lima, fontStyle: 'bold', fontSize: 9.5, cellPadding: { top: 3.5, bottom: 3.5, left: 5, right: 4 } } }]);
    }
    ultima = s.section || null;
    numeros.set(linhas.length, i + 1);
    linhas.push(['', { content: s.title || '', styles: { fontStyle: 'bold', textColor: C.escuro } }, s.description || '—']);
    if (s.img) {
      const mw = 150, mh = 85, r = Math.min(mw / s.img.width, mh / s.img.height);
      const w = s.img.width * r, h = s.img.height * r;
      imagens.set(linhas.length, { ...s.img, w, h });
      linhas.push([{ content: '', colSpan: 3, styles: { minCellHeight: h + 9, fillColor: [255, 255, 255] } }]);
    }
  });

  autoTable(doc, {
    head: [['Nº', 'Passo', 'Procedimento / instruções']],
    body: linhas,
    startY: y,
    margin: { top: TOPO, left: M, right: M, bottom: 20 },
    theme: 'plain',
    styles: { font: 'helvetica', fontSize: 9.5, cellPadding: { top: 4.5, bottom: 4.5, left: 4, right: 4 }, textColor: C.medio, lineColor: C.borda, lineWidth: 0, valign: 'top' },
    headStyles: { fillColor: C.verde, textColor: 255, fontStyle: 'bold', fontSize: 8.5, cellPadding: { top: 3.5, bottom: 3.5, left: 4, right: 4 } },
    alternateRowStyles: { fillColor: C.fundo },
    columnStyles: { 0: { cellWidth: 16, halign: 'center' }, 1: { cellWidth: 55 }, 2: { cellWidth: 'auto' } },
    rowPageBreak: 'avoid',
    didDrawPage: () => faixa(doc, logo, 'Processos'),
    didDrawCell: (d) => {
      if (d.section !== 'body') return;
      const idx = d.row.index;
      if (d.column.index === 0 && numeros.has(idx)) {
        const cx = d.cell.x + d.cell.width / 2, cy = d.cell.y + 4.5 + 3;
        doc.setFillColor(...C.verde); doc.circle(cx, cy, 3.6, 'F');
        doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(255);
        doc.text(String(numeros.get(idx)), cx, cy + 1, { align: 'center' });
      }
      if (d.column.index === 0 && imagens.has(idx)) {
        const im = imagens.get(idx);
        const x = d.cell.x + (d.cell.width - im.w) / 2, yy = d.cell.y + 4.5;
        doc.setDrawColor(...C.borda); doc.setLineWidth(0.4); doc.setFillColor(255, 255, 255);
        doc.roundedRect(x - 1.2, yy - 1.2, im.w + 2.4, im.h + 2.4, 1.5, 1.5, 'FD');
        doc.addImage(im.dataURL, 'JPEG', x, yy, im.w, im.h);
      }
      if (secoes.has(idx)) { doc.setFillColor(...C.lima); doc.rect(d.cell.x, d.cell.y, 1.6, d.cell.height, 'F'); }
    },
  });

  rodape(doc, `Conexão Web · Documento gerado em ${dataHora()}`);
  doc.save(`processo_${process.id}_${Date.now()}.pdf`);
};

/* ───────── Relatório de processos (lista) ───────── */
export const exportProcessListPdf = async ({ processes, filtros = [] }) => {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.width;
  const logo = await carregarImagem('/logo-cw-full.png', 'image/png').catch(() => null);
  faixa(doc, logo, 'Relatório');

  doc.setFont('helvetica', 'bold'); doc.setFontSize(20); doc.setTextColor(...C.escuro);
  doc.text('Relatório de Processos', M, TOPO + 6);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...C.suave);
  doc.text(`Gerado em ${dataHora()}`, M, TOPO + 12);
  let y = TOPO + 18;

  // Indicadores
  const cont = (s) => processes.filter((p) => p.status === s).length;
  const cards = [['Total', processes.length, C.escuro], ['Ativos', cont('active'), C.verde], ['Rascunhos', cont('draft'), [217, 119, 6]], ['Arquivados', cont('archived'), C.suave]];
  const gap = 4, cw = (W - 2 * M - gap * 3) / 4;
  cards.forEach(([r, v, cor], i) => {
    const x = M + i * (cw + gap);
    doc.setFillColor(...C.fundo); doc.roundedRect(x, y, cw, 20, 2.5, 2.5, 'F');
    doc.setFillColor(...cor); doc.rect(x, y + 3, 1.4, 14, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.setTextColor(...cor); doc.text(String(v), x + 6, y + 11.5);
    doc.setFontSize(7.5); doc.setTextColor(...C.suave); doc.text(r.toUpperCase(), x + 6, y + 16.5);
  });
  y += 26;
  if (filtros.length) y = pilulas(doc, y, filtros.map((f) => f)) + 2;
  y = titulo(doc, 'Processos', y + 2);

  autoTable(doc, {
    head: [['ID', 'Título', 'Departamento', 'Status', 'Passos']],
    body: processes.map((p) => [p.id, p.title, p.department_name || '—', statusLabel(p.status), p.steps?.length || 0]),
    startY: y,
    margin: { top: TOPO, left: M, right: M, bottom: 20 },
    theme: 'plain',
    styles: { font: 'helvetica', fontSize: 9, cellPadding: { top: 3.6, bottom: 3.6, left: 4, right: 4 }, textColor: C.medio, valign: 'middle' },
    headStyles: { fillColor: C.escuro, textColor: C.lima, fontStyle: 'bold', fontSize: 8.5 },
    alternateRowStyles: { fillColor: C.fundo },
    columnStyles: { 0: { cellWidth: 14, halign: 'center', textColor: C.suave }, 1: { fontStyle: 'bold', textColor: C.escuro }, 3: { cellWidth: 28, halign: 'center' }, 4: { cellWidth: 18, halign: 'center' } },
    didParseCell: (d) => {
      if (d.section === 'body' && d.column.index === 3) {
        const v = d.cell.raw;
        d.cell.styles.fontStyle = 'bold';
        d.cell.styles.textColor = v === 'Ativo' ? C.verde : v === 'Rascunho' ? [217, 119, 6] : C.suave;
      }
    },
    didDrawPage: () => faixa(doc, logo, 'Relatório'),
  });

  rodape(doc, `Conexão Web · ${processes.length} processo(s) · Gerado em ${dataHora()}`);
  doc.save(`relatorio_processos_${Date.now()}.pdf`);
};
