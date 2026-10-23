import { useEffect, useState } from 'react';

export default function StatisticsQr({ token, onCopy, copying, copyError }) {
  const [image, setImage] = useState('');
  const [error, setError] = useState('');
  const url = new URL(`/statistics/${encodeURIComponent(token)}`, window.location.origin).href;

  useEffect(() => {
    let active = true;
    async function generate() {
      try {
        const { default: QRCode } = await import('qrcode');
        const result = await QRCode.toDataURL(url, {
          width: 512,
          margin: 4,
          errorCorrectionLevel: 'M',
          color: { dark: '#000000', light: '#ffffff' },
        });
        if (active) setImage(result);
      } catch {
        if (active) setError('Nie udało się wygenerować kodu QR. Zamknij panel i spróbuj ponownie.');
      }
    }
    generate();
    return () => { active = false; };
  }, [url]);

  return (
    <section className="statistics-card statistics-qr" id="statistics-qr" aria-labelledby="statistics-qr-title">
      <h2 id="statistics-qr-title">Udostępnij statystyki</h2>
      <p>Zeskanuj kod QR, aby otworzyć publiczne statystyki bez logowania.</p>
      {error ? <p role="alert">{error}</p> : image ? (
        <img className="statistics-qr-image" src={image} width="256" height="256" alt="Kod QR prowadzący do publicznych statystyk użytkownika" />
      ) : <p role="status">Generowanie kodu QR…</p>}
      <div className="statistics-share-actions">
        {image && <a className="statistics-qr-download" href={image} download="statystyki-qr.png">Pobierz kod QR (PNG)</a>}
        <button type="button" onClick={onCopy} disabled={copying}>Skopiuj link</button>
      </div>
      {copyError && <p role="alert">{copyError}</p>}
    </section>
  );
}
