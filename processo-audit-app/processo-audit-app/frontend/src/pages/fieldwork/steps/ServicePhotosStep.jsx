import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Camera, ImagePlus, X } from 'lucide-react';
import { osAPI } from '../../../api/estoque';
import { useServiceOrder, useOrderDetail } from '../state';
import { fw, StickyButton } from '../ui';
import StepScreen from './StepScreen';

/* Reduz a foto (1280 px, JPEG) antes de enviar */
const compress = (file) => new Promise((resolve, reject) => {
  const src = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    const k = Math.min(1, 1280 / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    URL.revokeObjectURL(src);
    c.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Imagem inválida'))), 'image/jpeg', 0.7);
  };
  img.onerror = () => { URL.revokeObjectURL(src); reject(new Error('Imagem inválida')); };
  img.src = src;
});

/* Miniatura: a foto é privada, então é buscada com o token e vira um endereço local (revogado ao sair) */
const Thumb = ({ orderId, foto }) => {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    let vivo = true; let criada = null;
    osAPI.fotoUrl(orderId, foto.id).then((u) => { criada = u; if (vivo) setUrl(u); else URL.revokeObjectURL(u); }).catch(() => {});
    return () => { vivo = false; if (criada) URL.revokeObjectURL(criada); };
  }, [orderId, foto.id]);
  return url ? <img src={url} alt="Foto do serviço" /> : <div style={{ width: '100%', height: '100%', background: 'var(--border-color)' }} aria-label="Carregando foto" />;
};

const ServicePhotosStep = () => {
  const { orderId } = useParams();
  const { order, catalogs } = useServiceOrder(orderId);
  const reloadDetail = useOrderDetail(orderId);
  const cameraRef = useRef(null);
  const galleryRef = useRef(null);
  const [enviando, setEnviando] = useState(0);
  const [erro, setErro] = useState('');
  const maxFotos = catalogs?.regras?.fotos_max ?? 30;
  const photos = order?.photos || [];

  // A foto vai para o servidor na hora em que é escolhida (não fica guardada no navegador)
  const onFiles = (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    setErro('');
    files.forEach(async (file) => {
      setEnviando((n) => n + 1);
      try {
        if (photos.length + 1 > maxFotos) throw new Error(`Cada OS aceita no máximo ${maxFotos} fotos.`);
        const blob = await compress(file);
        const uuid = crypto.randomUUID();
        await osAPI.enviarFoto(orderId, blob, { client_uuid: uuid, tirada_em: new Date().toISOString() }, uuid);
        await reloadDetail();
      } catch (err) { setErro(err.message || 'Não foi possível enviar a foto. Tente de novo.'); } finally { setEnviando((n) => n - 1); }
    });
  };
  const remover = async (foto) => {
    setErro('');
    try { await osAPI.removerFoto(orderId, foto.id); await reloadDetail(); } catch (err) { setErro(err.message); }
  };

  return (
    <StepScreen stepKey="service-photos" action={<StickyButton tone="alert" icon={Camera} onClick={() => cameraRef.current?.click()}>Tirar Foto</StickyButton>}>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={onFiles} />
      <input ref={galleryRef} type="file" accept="image/*" multiple hidden onChange={onFiles} />
      {erro && <p className={fw.callout} role="alert" style={{ margin: 0 }}>{erro}</p>}
      {enviando > 0 && <p className={fw.muted} role="status" style={{ margin: 0 }}>Enviando {enviando} foto(s)…</p>}
      {photos.length === 0 && enviando === 0
        ? <div className={`${fw.card} ${fw.emptyState}`}><Camera size={40} /><b>Nenhuma foto ainda</b><span>Fotografe a CEO fechada no poste, a rota lançada e as etiquetas. As fotos são enviadas ao servidor na hora.</span></div>
        : (
          <div className={fw.photoGrid}>
            {photos.map((p) => (
              <div key={p.id} className={fw.photo} data-testid="foto-servico">
                <Thumb orderId={orderId} foto={p} />
                <button className={fw.photoRemove} aria-label="Remover foto" onClick={() => remover(p)}><X size={20} /></button>
                {p.takenAt && <span className={fw.photoCap}>{new Date(p.takenAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>}
              </div>
            ))}
          </div>
        )}
      <button className={fw.btnOutline} style={{ borderStyle: 'solid', borderColor: 'var(--border-color)', color: 'var(--text-medium)' }} onClick={() => galleryRef.current?.click()}><ImagePlus size={20} />Escolher da galeria</button>
    </StepScreen>
  );
};
export default ServicePhotosStep;
