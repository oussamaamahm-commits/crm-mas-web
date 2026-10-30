import { useSearchParams } from 'react-router-dom';
import { FileText, KeyRound, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { Glass, Notice, PageHeader, Tabs } from '../components/ui.jsx';
import { DocumentsPanel, SecretsPanel } from '../components/lists.jsx';

export default function DocumentsPage() {
  const { can } = useAuth();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') ?? 'documentos';
  const tabs = [{ key: 'documentos', label: 'Documentos', icon: FileText }, can('secrets.use') && { key: 'credenciales', label: 'Credenciales', icon: KeyRound }].filter(Boolean);
  return (
    <div>
      <PageHeader title="Documentación" subtitle="Repositorio documental de clientes y proyectos: contratos, facturas, presupuestos, documentación técnica, manuales y entregables" />
      <Tabs tabs={tabs} value={tab} onChange={(t) => setParams({ tab: t }, { replace: true })} className="mb-6" />
      {tab === 'credenciales' && can('secrets.use') ? (
        <>
          <Notice tone="brand" icon={ShieldCheck} className="mb-4">
            Las credenciales se cifran con AES-256-GCM en el servidor. Nunca se muestran en pantalla: solo pueden copiarse al portapapeles tras confirmar tu contraseña, y cada uso queda registrado en la auditoría.
          </Notice>
          <Glass className="overflow-hidden pt-4">
            <SecretsPanel />
          </Glass>
        </>
      ) : (
        <Glass className="overflow-hidden pt-4">
          <DocumentsPanel />
        </Glass>
      )}
    </div>
  );
}
