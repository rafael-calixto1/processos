import React, { useEffect, useRef } from 'react';
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
  const previewUrls = useRef([]);
  // Libera as URLs de preview ao sair da tela
  useEffect(() => () => previewUrls.current.forEach(URL.revokeObjectURL), []);

  const onFiles = (e) => {
    Array.from(e.target.files || []).forEach((file) => {
      const url = URL.createObjectURL(file);
      previewUrls.current.push(url);
      act('PHOTO_ADDED', { photo: { id: crypto.randomUUID(), url, fileName: file.name, takenAt: new Date().toISOString() } });
    });
    e.target.value = '';
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
