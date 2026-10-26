import {
  useId,
  type InputHTMLAttributes,
  type TextareaHTMLAttributes,
  type SelectHTMLAttributes,
  type ReactNode,
} from 'react';

interface FeldAngaben {
  beschriftung: string;
  hilfe?: string;
  fehler?: string;
}
type FeldEigenschaften = FeldAngaben & InputHTMLAttributes<HTMLInputElement>;
type TextfeldEigenschaften = FeldAngaben & TextareaHTMLAttributes<HTMLTextAreaElement>;
type AuswahlfeldEigenschaften = FeldAngaben &
  SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode };

function beschreibungen(id: string, hilfe?: string, fehler?: string, zusaetzlich?: string) {
  return (
    [zusaetzlich, hilfe ? `${id}-hilfe` : undefined, fehler ? `${id}-fehler` : undefined]
      .filter(Boolean)
      .join(' ') || undefined
  );
}

export function Feld({
  beschriftung,
  hilfe,
  fehler,
  id,
  className = '',
  ...eigenschaften
}: FeldEigenschaften) {
  const erzeugteId = useId();
  const feldId = id || erzeugteId;
  return (
    <div className={`sl-feld ${className}`}>
      <label htmlFor={feldId}>{beschriftung}</label>
      <input
        {...eigenschaften}
        id={feldId}
        className="sl-feld-eingabe"
        aria-invalid={fehler ? true : eigenschaften['aria-invalid']}
        aria-describedby={beschreibungen(feldId, hilfe, fehler, eigenschaften['aria-describedby'])}
      />
      {hilfe && (
        <p id={`${feldId}-hilfe`} className="sl-feld-hilfe">
          {hilfe}
        </p>
      )}
      {fehler && (
        <p id={`${feldId}-fehler`} className="sl-feld-fehler">
          {fehler}
        </p>
      )}
    </div>
  );
}

export function Textfeld({
  beschriftung,
  hilfe,
  fehler,
  id,
  className = '',
  ...eigenschaften
}: TextfeldEigenschaften) {
  const erzeugteId = useId();
  const feldId = id || erzeugteId;
  return (
    <div className={`sl-feld ${className}`}>
      <label htmlFor={feldId}>{beschriftung}</label>
      <textarea
        {...eigenschaften}
        id={feldId}
        className="sl-feld-eingabe"
        aria-invalid={fehler ? true : eigenschaften['aria-invalid']}
        aria-describedby={beschreibungen(feldId, hilfe, fehler, eigenschaften['aria-describedby'])}
      />
      {hilfe && (
        <p id={`${feldId}-hilfe`} className="sl-feld-hilfe">
          {hilfe}
        </p>
      )}
      {fehler && (
        <p id={`${feldId}-fehler`} className="sl-feld-fehler">
          {fehler}
        </p>
      )}
    </div>
  );
}

export function Auswahlfeld({
  beschriftung,
  hilfe,
  fehler,
  id,
  className = '',
  children,
  ...eigenschaften
}: AuswahlfeldEigenschaften) {
  const erzeugteId = useId();
  const feldId = id || erzeugteId;
  return (
    <div className={`sl-feld ${className}`}>
      <label htmlFor={feldId}>{beschriftung}</label>
      <select
        {...eigenschaften}
        id={feldId}
        className="sl-feld-eingabe"
        aria-invalid={fehler ? true : eigenschaften['aria-invalid']}
        aria-describedby={beschreibungen(feldId, hilfe, fehler, eigenschaften['aria-describedby'])}
      >
        {children}
      </select>
      {hilfe && (
        <p id={`${feldId}-hilfe`} className="sl-feld-hilfe">
          {hilfe}
        </p>
      )}
      {fehler && (
        <p id={`${feldId}-fehler`} className="sl-feld-fehler">
          {fehler}
        </p>
      )}
    </div>
  );
}
