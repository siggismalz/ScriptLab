import { useId, useRef, useState, type ComponentProps, type DragEvent } from 'react';
import { dateipfadAusAblage } from '../../gemeinsam/dateiablage';
import { Feld } from './Feld';
import './dateipfad-feld.css';

type DateipfadEigenschaften = ComponentProps<typeof Feld> & {
  /** Nur die ausdrückliche Ablage übernimmt einen Pfad; normale Eingaben behalten onChange. */
  pfadAendern: (pfad: string) => void;
};

export function DateipfadFeld({
  pfadAendern,
  hilfe,
  id,
  className = '',
  disabled,
  readOnly,
  onChange,
  ...angaben
}: DateipfadEigenschaften) {
  const erzeugteId = useId();
  const feldId = id || erzeugteId;
  const fehlerId = `${feldId}-ablagefehler`;
  const [gezogen, setGezogen] = useState(false);
  const [ablageFehler, setAblageFehler] = useState('');
  const schutz = useRef({ disabled, readOnly });
  schutz.current = { disabled, readOnly };

  const istGesperrt = (e: DragEvent<HTMLInputElement>) =>
    schutz.current.disabled ||
    schutz.current.readOnly ||
    e.currentTarget.disabled ||
    e.currentTarget.readOnly ||
    e.currentTarget.matches(':disabled');
  const dateiAngeboten = (e: DragEvent<HTMLInputElement>) =>
    Array.from(e.dataTransfer.types).includes('Files');
  const abfangen = (e: DragEvent<HTMLInputElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <div className="sl-dateipfad-feld">
      <Feld
        {...angaben}
        id={feldId}
        className={`${className} ${gezogen && !disabled && !readOnly ? 'sl-dateipfad--gezogen' : ''}`}
        disabled={disabled}
        readOnly={readOnly}
        hilfe={[hilfe, 'Datei hier ablegen oder Pfad eingeben'].filter(Boolean).join(' · ')}
        aria-invalid={ablageFehler ? true : angaben['aria-invalid']}
        aria-describedby={
          [angaben['aria-describedby'], ablageFehler ? fehlerId : undefined].filter(Boolean).join(' ') ||
          undefined
        }
        onChange={(e) => {
          setAblageFehler('');
          onChange?.(e);
        }}
        onDragEnter={(e) => {
          abfangen(e);
          setGezogen(!istGesperrt(e) && dateiAngeboten(e));
        }}
        onDragOver={(e) => {
          abfangen(e);
          const erlaubt = !istGesperrt(e) && dateiAngeboten(e);
          e.dataTransfer.dropEffect = erlaubt ? 'copy' : 'none';
          setGezogen(erlaubt);
        }}
        onDragLeave={(e) => {
          abfangen(e);
          setGezogen(false);
        }}
        onDrop={(e) => {
          abfangen(e);
          setGezogen(false);
          if (istGesperrt(e)) return;
          try {
            const pfad = dateipfadAusAblage(e.dataTransfer);
            pfadAendern(pfad);
            setAblageFehler('');
          } catch (fehler) {
            setAblageFehler(
              fehler instanceof Error && fehler.message.trim()
                ? fehler.message
                : 'Der Dateipfad konnte nicht übernommen werden. Wähle eine lokale Datei oder gib den Pfad ein.',
            );
          }
        }}
      />
      {ablageFehler && (
        <p id={fehlerId} className="sl-feld-fehler" role="alert">
          {ablageFehler}
        </p>
      )}
    </div>
  );
}
