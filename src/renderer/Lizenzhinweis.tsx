import lizenztext from '../../LICENSE.txt?raw';
import './lizenzhinweis.css';

/** Dieselbe vollständige Projektlizenz wie im Repository und Windows-Paket. */
export function Lizenzhinweis() {
  return (
    <section className="lizenzhinweis" aria-label="Nutzung und Lizenz">
      <h2>Nutzung und Lizenz</h2>
      <dl>
        <div>
          <dt>Privat und nichtkommerziell</dt>
          <dd>Kostenlos</dd>
        </div>
        <div>
          <dt>Kommerziell</dt>
          <dd>Kostenpflichtige Lizenz erforderlich</dd>
        </div>
      </dl>
      <p>
        Eine kommerzielle Lizenz vereinbarst du separat mit Leon Stolz. Preis, Umfang und Laufzeit werden
        dabei festgelegt.
      </p>
      <p>
        Eigene Inhalte und rechtmäßig erzeugte Exporte bleiben unabhängig nutzbar. Die Lizenzen der
        enthaltenen Drittanbieter gelten weiterhin.
      </p>
      <details>
        <summary>Vollständige Lizenzbedingungen</summary>
        <pre>{lizenztext}</pre>
      </details>
    </section>
  );
}
