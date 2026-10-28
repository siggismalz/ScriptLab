import { createRoot } from 'react-dom/client';
import { Anwendung } from './Anwendung';
import { designTokensAnwenden } from '../gestaltung/tokens';
import './komponenten/komponenten.css';
import './stil.css';
import './produkt.css';
import './start-werkbank.css';
import './palette-werkbank.css';

designTokensAnwenden();
createRoot(document.getElementById('root')!).render(<Anwendung />);
