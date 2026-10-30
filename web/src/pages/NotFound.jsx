import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { EmptyState, Glass } from '../components/ui.jsx';

export default function NotFound() {
  return (
    <Glass className="mx-auto mt-10 max-w-lg">
      <EmptyState icon={Compass} title="Página no encontrada" description="La dirección no existe o ya no está disponible." action={<Link to="/" className="btn-primary">Volver al Overview</Link>} />
    </Glass>
  );
}
