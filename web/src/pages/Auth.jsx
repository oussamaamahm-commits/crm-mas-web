import { useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { ArrowLeft, Lock, Mail, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../lib/api.js';
import { Button, Field, Input, Notice } from '../components/ui.jsx';
import { PulsarMark } from '../layout/Logo.jsx';
import { finish, settle, skipMotion } from '../lib/motion.js';

function AuthLayout({ title, subtitle, children }) {
  const scope = useRef(null);
  useGSAP(
    () => {
      if (skipMotion()) return undefined;
      gsap.from('[data-auth]', { opacity: 0, y: 16, duration: 0.5, ease: 'power3.out', stagger: 0.06, clearProps: 'opacity,transform' });
      return settle(() => finish(scope.current.querySelectorAll('[data-auth]')), 900);
    },
    { scope },
  );
  return (
    <div ref={scope} className="relative flex min-h-screen items-center justify-center px-4 py-10">
      <div className="app-backdrop" />
      <div className="pointer-events-none absolute left-1/2 top-[18%] h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(96,165,250,0.28),transparent_65%)] blur-2xl" />
      <div className="relative w-full max-w-[400px]">
        <div data-auth className="mb-8 flex flex-col items-center text-center">
          <PulsarMark size={52} />
          <p className="mt-4 text-[13px] font-semibold tracking-[0.22em] text-brand-deep">WEB PULSAR</p>
          <p className="text-[11.5px] text-ink-soft">Business Control Center</p>
        </div>
        <div data-auth className="glass-strong sheen p-7">
          <h1 className="text-[20px] font-medium">{title}</h1>
          {subtitle && <p className="mt-1 text-[13px] text-ink-soft">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
        <p data-auth className="mt-6 flex items-center justify-center gap-1.5 text-[11.5px] text-ink-faint">
          <ShieldCheck className="h-3.5 w-3.5" /> Acceso privado · conexión cifrada · actividad auditada
        </p>
      </div>
    </div>
  );
}

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email, password);
      navigate(location.state?.from?.pathname ?? '/', { replace: true });
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  };

  return (
    <AuthLayout title="Iniciar sesión" subtitle="Accede al centro de operaciones de Web Pulsar.">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Email" htmlFor="email" error={error?.fields?.email}>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
            <Input id="email" type="email" autoComplete="username" className="pl-9" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
          </div>
        </Field>
        <Field label="Contraseña" htmlFor="password" error={error?.fields?.password}>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
            <Input id="password" type="password" autoComplete="current-password" className="pl-9" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
        </Field>
        {error && !Object.keys(error.fields ?? {}).length && <Notice tone="danger">{error.message}</Notice>}
        <Button type="submit" className="w-full py-2.5" loading={busy}>
          Entrar
        </Button>
        <div className="text-center">
          <Link to="/recuperar" className="text-[12.5px] font-medium text-brand hover:underline">
            ¿Has olvidado la contraseña?
          </Link>
        </div>
      </form>
    </AuthLayout>
  );
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api.post('/auth/forgot', { email });
      setMessage(res.message);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };
  return (
    <AuthLayout title="Recuperar contraseña" subtitle="Te enviaremos un enlace temporal para crear una nueva contraseña.">
      {message ? (
        <Notice tone="ok">{message}</Notice>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Field label="Email de tu cuenta" htmlFor="email" error={error?.fields?.email}>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
          </Field>
          {error && !error.fields?.email && <Notice tone="danger">{error.message}</Notice>}
          <Button type="submit" className="w-full py-2.5" loading={busy}>
            Enviar enlace
          </Button>
        </form>
      )}
      <Link to="/login" className="mt-5 inline-flex items-center gap-1 text-[12.5px] font-medium text-ink-soft hover:text-brand">
        <ArrowLeft className="h-3.5 w-3.5" /> Volver al inicio de sesión
      </Link>
    </AuthLayout>
  );
}

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(null);
  const submit = async (e) => {
    e.preventDefault();
    if (password !== repeat) return setError({ fields: { repeat: 'Las contraseñas no coinciden' } });
    setBusy(true);
    setError(null);
    try {
      await api.post('/auth/reset', { token, password });
      setDone(true);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };
  return (
    <AuthLayout title="Nueva contraseña" subtitle="Mínimo 12 caracteres combinando mayúsculas, minúsculas, números o símbolos.">
      {done ? (
        <div className="space-y-4">
          <Notice tone="ok">Contraseña actualizada. Por seguridad se han cerrado todas las sesiones abiertas.</Notice>
          <Link to="/login" className="btn-primary w-full">
            Iniciar sesión
          </Link>
        </div>
      ) : !token ? (
        <Notice tone="danger">El enlace no es válido. Solicita uno nuevo desde «¿Has olvidado la contraseña?».</Notice>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Field label="Nueva contraseña" error={error?.fields?.password}>
            <Input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required autoFocus />
          </Field>
          <Field label="Repite la contraseña" error={error?.fields?.repeat}>
            <Input type="password" autoComplete="new-password" value={repeat} onChange={(e) => setRepeat(e.target.value)} required />
          </Field>
          {error?.message && !error.fields?.password && <Notice tone="danger">{error.message}</Notice>}
          <Button type="submit" className="w-full py-2.5" loading={busy}>
            Guardar contraseña
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
