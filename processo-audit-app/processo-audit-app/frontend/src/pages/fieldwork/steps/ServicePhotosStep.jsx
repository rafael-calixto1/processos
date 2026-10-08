import React, { useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Camera, ImagePlus, X } from 'lucide-react';
import { useServiceOrder } from '../state';
import { fw, StickyButton } from '../ui';
import StepScreen from './StepScreen';

const ServicePhotosStep = () => {
  const { orderId } = useParams();
  const { draft, act } = useServiceOrder(orderId);
  const cameraRef = useRef(null);
  const galleryRef = useRef(null);
  // Reduz a foto (1280 px, JPEG) e guarda como data URL para ir junto com o rascunho no banco
  const compress = (file) => new Promise((resolve, reject) => {
    const src = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, 1280 / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(src);
      resolve(c.toDataURL('image/jpeg', 0.7));
    };
    img.onerror = () => { URL.revokeObjectURL(src); reject(new Error('Imagem inválida')); };
    img.src = src;
  });

  const onFiles = (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    files.forEach((file) => compress(file).then((url) => {
      act('PHOTO_ADDED', { photo: { id: crypto.randomUUID(), url, fileName: file.name, takenAt: new Date().toISOString() } });
    }).catch(() => {}));
  };

  const photos = draft?.servicePhotos || [];
  return (
    <StepScreen stepKey="service-photos" action={<StickyButton tone="alert" icon={Camera} onClick={() => cameraRef.current?.click()}>Tirar Foto</StickyButton>}>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={onFiles} />
      <input ref={galleryRef} type="file" accept="image/*" multiple hidden onChange={onFiles} />
      {photos.length === 0
        ? <div className={`${fw.card} ${fw.emptyState}`}><Camera size={40} /><b>Nenhuma foto ainda</b><span>Fotografe a CEO fechada no poste, a rota lançada e as etiquetas.</span></div>
        : (
          <div className={fw.photoGrid}>
            {photos.map((p) => (
              <div key={p.id} className={fw.photo}>
                <img src={p.url} alt="Foto do serviço" />
                <button className={fw.photoRemove} aria-label="Remover foto" onClick={() => act('PHOTO_REMOVED', { photoId: p.id })}><X size={20} /></button>
                <span className={fw.photoCap}>{new Date(p.takenAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            ))}
          </div>
        )}
      <button className={fw.btnOutline} style={{ borderStyle: 'solid', borderColor: 'var(--border-color)', color: 'var(--text-medium)' }} onClick={() => galleryRef.current?.click()}><ImagePlus size={20} />Escolher da galeria</button>
    </StepScreen>
  );
};
export default ServicePhotosStep;
