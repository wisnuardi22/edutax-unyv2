'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, RefreshCw, Info } from 'lucide-react';
import { addAuditEvent, loadDb, updateDb } from '@/lib/storage/db';
import { ensureSeedData, MAIN_ACCOUNT_SEED } from '@/lib/domain/portal';

/** Akun bersama satu kelas. Sengaja ditampilkan di layar sesuai brief. */
const DEMO_USER = 'edutax';
const DEMO_PASS = 'edutax2026';

function makeCaptcha() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export default function LoginPage() {
  const router = useRouter();
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [captcha, setCaptcha] = useState('');
  const [captchaInput, setCaptchaInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setCaptcha(makeCaptcha()), []);

  function refreshCaptcha() {
    setCaptcha(makeCaptcha());
    setCaptchaInput('');
  }

  function handleLogin() {
    if (captchaInput.trim().toUpperCase() !== captcha) {
      setError('Kode keamanan tidak cocok. Ketik ulang sesuai gambar.');
      refreshCaptcha();
      return;
    }
    if (userId.trim() !== DEMO_USER || password !== DEMO_PASS) {
      setError('ID Pengguna atau Kata Sandi tidak sesuai.');
      return;
    }
    updateDb((db) => {
      db.session = {
        personNik: MAIN_ACCOUNT_SEED.nik,
        personName: MAIN_ACCOUNT_SEED.name,
        impersonatingTin: null,
        activeNitku: null,
        loggedInAt: new Date().toISOString(),
      };
      ensureSeedData(db);
      addAuditEvent(db, 'Login', 'Masuk ke EduTax');
    });
    router.push('/portal');
  }

  // Sudah login sebelumnya di browser yang sama -> langsung ke portal.
  useEffect(() => {
    if (loadDb().session) router.replace('/portal');
  }, [router]);

  return (
    <main className="flex min-h-screen flex-col items-center bg-canvas px-3 py-4 sm:px-4 sm:py-5">
      <header className="mb-3 flex items-center justify-center gap-3 sm:mb-4 sm:gap-4">
        <Image
          src="/logo-uny.png"
          alt=""
          width={64}
          height={64}
          className="rounded-full bg-white p-1 shadow-card"
          priority
        />
        <div>
          <p className="text-3xl font-bold leading-none text-brand-800">
            Edu<span className="text-brand-500">Tax</span>
          </p>
          <p className="mt-1 text-[11px] font-medium tracking-[0.18em] text-ink-muted">
            UNIVERSITAS NEGERI YOGYAKARTA
          </p>
        </div>
      </header>

      <div className="grid w-full max-w-[930px] overflow-hidden rounded-card bg-white shadow-card md:grid-cols-2">
        {/* Kolom formulir */}
        <section className="p-5 sm:p-6 md:p-7">
          <h1 className="text-2xl font-semibold leading-tight text-ink">Login</h1>
          <p className="mt-1 text-xs font-semibold tracking-wide text-brand-600">
            Tahap 1 — Modul Role Akses
          </p>

          <div className="mt-4 space-y-3">
            <div>
              <label className="field-label" htmlFor="userId">
                ID Pengguna <span className="text-bad">*</span>
              </label>
              <input
                id="userId"
                className="field-input"
                placeholder="NIK/NPWP/NITKU identitas khusus untuk ILAP dan Lembaga Lain"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                autoComplete="username"
              />
            </div>

            <div>
              <label className="field-label" htmlFor="password">
                Kata Sandi <span className="text-bad">*</span>
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPass ? 'text' : 'password'}
                  className="field-input pr-10"
                  placeholder="Masukan Kata Sandi ID Pengguna Anda"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-ink-muted hover:text-brand-600"
                  aria-label={showPass ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                >
                  {showPass ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            <div>
              <label className="field-label" htmlFor="lang">
                Pemilihan Bahasa
              </label>
              <select id="lang" className="field-input" defaultValue="id">
                <option value="id">id-ID — Bahasa Indonesia</option>
                <option value="en">en-US — English</option>
              </select>
            </div>

            <div>
              <label className="field-label" htmlFor="captcha">
                Kode Keamanan <span className="text-bad">*</span>
              </label>
              <div className="flex items-center gap-2">
                <output className="select-none rounded-md border border-line bg-[repeating-linear-gradient(135deg,#EDF1F6_0_6px,#FFFFFF_6px_12px)] px-4 py-2.5 font-semibold tracking-[0.3em] text-ink">
                  {captcha}
                </output>
                <button
                  type="button"
                  onClick={refreshCaptcha}
                  className="rounded-md border border-line p-2.5 text-ink-muted hover:text-brand-600"
                  aria-label="Ganti kode keamanan"
                >
                  <RefreshCw size={16} />
                </button>
                <input
                  id="captcha"
                  className="field-input flex-1"
                  placeholder="Masukkan Captcha"
                  value={captchaInput}
                  onChange={(e) => setCaptchaInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                />
              </div>
            </div>

            <a className="inline-block text-sm text-brand-500 hover:underline" href="#">
              Lupa Kata Sandi?
            </a>

            {error && (
              <p role="alert" className="rounded-md bg-bad/10 px-3 py-2 text-sm text-bad">
                {error}
              </p>
            )}

            <button type="button" className="btn-primary w-full" onClick={handleLogin}>
              Login
            </button>

            <p className="text-center text-sm text-ink-muted">
              Pengguna Baru?{' '}
              <a className="text-brand-500 hover:underline" href="#">
                Daftar disini
              </a>
            </p>
            <p className="text-center text-sm">
              <a className="text-brand-500 hover:underline" href="#">
                Permintaan akses digital
              </a>
            </p>

            <div className="rounded-md border border-brand-200 bg-brand-50 p-3 text-[13px] text-brand-800">
              <p className="flex items-center gap-1.5 font-semibold">
                <Info size={14} /> Akun Demo — seluruh mahasiswa memakai akun yang sama
              </p>
              <p className="mt-1">
                ID Pengguna: <code className="rounded bg-white px-1.5 py-0.5">{DEMO_USER}</code>{' '}
                Kata Sandi: <code className="rounded bg-white px-1.5 py-0.5">{DEMO_PASS}</code>{' '}
                <span className="text-brand-600">(captcha diketik sesuai gambar)</span>
              </p>
              <p className="mt-1 text-xxs text-brand-700">
                Setelah masuk, identitas simulasi Anda otomatis terisi sebagai{' '}
                <strong>{MAIN_ACCOUNT_SEED.nik} {MAIN_ACCOUNT_SEED.name}</strong> — kredensial login
                di atas hanya untuk masuk bersama, bukan identitas wajib pajak itu sendiri.
              </p>
            </div>
          </div>
        </section>

        {/* Kolom identitas */}
        <aside className="relative flex flex-col justify-between overflow-hidden bg-brand-900 p-6 text-white sm:p-7">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-25
                       [background-image:linear-gradient(to_right,rgba(255,255,255,.18)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,.18)_1px,transparent_1px)]
                       [background-size:56px_56px]"
          />
          <div className="relative">
            <span className="inline-block rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold text-accent">
              Educational Tax Administration Simulation
            </span>
            <h2 className="mt-4 text-3xl font-bold leading-tight sm:text-[34px]">
              EduTax
              <br />
              Educational Tax
              <br />
              Administration
              <br />
              System
            </h2>
            <div className="mt-5 h-1 w-28 rounded bg-accent" />
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/80">
              Simulasi pembelajaran administrasi perpajakan untuk lingkungan akademik.
            </p>
          </div>

          <div className="relative mt-8 flex items-center gap-3">
            <Image
              src="/logo-uny.png"
              alt=""
              width={44}
              height={44}
              className="rounded-full bg-white p-0.5"
            />
            <p className="text-[11px] font-semibold leading-tight tracking-[0.16em] text-white/90">
              UNIVERSITAS NEGERI
              <br />
              YOGYAKARTA
            </p>
          </div>
        </aside>
      </div>
    </main>
  );
}
