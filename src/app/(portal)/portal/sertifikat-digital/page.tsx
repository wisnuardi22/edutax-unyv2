'use client';

import { useState, type ChangeEvent } from 'react';
import { useDb } from '@/lib/storage/useDb';
import { emptyMainAccountProfile, type CertificateProvider } from '@/lib/domain/types';

/**
 * Permohonan Kode Otorisasi/Sertifikat Digital, mengikuti slide 17-22.
 * Hanya bisa diakses dari Main Account — bila sedang impersonating Badan,
 * halaman ini menampilkan penjelasan dan mengarahkan kembali ke dropdown
 * identitas, bukan formulirnya.
 */

const PROVIDER_OPTIONS: { value: CertificateProvider; label: string }[] = [
  { value: 'BRIN', label: 'BRIN' },
  { value: 'BSSN', label: 'BSSN' },
  { value: 'KODE_OTORISASI_DJP', label: 'Kode Otorisasi DJP' },
  { value: 'PERURI', label: 'Peruri' },
  { value: 'PRIVY_ID', label: 'Privy ID' },
];

function todayDMY() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
}

function downloadText(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function SertifikatDigitalPage() {
  const { db, mutate } = useDb();
  const session = db.session!;
  const isMainAccount = !session.impersonatingTin;
  const profile = db.mainAccountProfile ?? emptyMainAccountProfile(session.personNik, session.personName);
  const alreadyIssued = !!profile.signingCredential;

  // Semua hook dideklarasikan lebih dulu, tanpa syarat, supaya urutan hook
  // tetap konsisten walau `isMainAccount` berubah saat halaman ini masih
  // terbuka (mis. pengguna berpindah identitas lewat dropdown header).
  const [alamat, setAlamat] = useState(profile.alamat);
  const [email, setEmail] = useState(profile.email);
  const [phone, setPhone] = useState(profile.phone);
  const [provider, setProvider] = useState<CertificateProvider | ''>('');
  const [signerId, setSignerId] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [photoVerified, setPhotoVerified] = useState(false);
  const [photoName, setPhotoName] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [justIssued, setJustIssued] = useState<typeof profile.signingCredential>(null);
  const [error, setError] = useState<string | null>(null);

  const contactLocked = !!profile.email;
  const isPsre = provider && provider !== 'KODE_OTORISASI_DJP';

  if (!isMainAccount) {
    const entity = db.entities.find((e) => e.tin === session.impersonatingTin);
    return (
      <section className="rounded-card bg-white p-5 shadow-card">
        <h1 className="text-lg font-semibold">Permohonan Kode Otorisasi/Sertifikat Digital</h1>
        <p className="mt-3 rounded-md border border-warn/40 bg-[#FFF4E8] px-3 py-2 text-[13px] text-ink">
          Pengajuan KO DJP/Sertel hanya bisa dilakukan di akun Orang Pribadi (tidak bisa akun
          badan/Instansi Pemerintah). Anda saat ini sedang impersonating sebagai{' '}
          <strong>{entity?.name ?? session.impersonatingTin}</strong>. Beralihlah ke <strong>Main
          Account</strong> lewat dropdown identitas di header untuk membuka menu ini.
        </p>
      </section>
    );
  }

  function handlePhoto(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // Simulasi: tidak ada pencocokan Dukcapil/Imigrasi sungguhan di praktikum ini.
    setPhotoName(file.name);
    setPhotoVerified(true);
  }

  function submit() {
    if (!alamat.trim() || !email.trim() || !phone.trim()) {
      setError('Lengkapi Alamat, Email, dan Nomor Telepon Seluler terlebih dahulu.');
      return;
    }
    if (!provider) {
      setError('Pilih Jenis Sertifikat Digital.');
      return;
    }
    if (isPsre && !signerId.trim()) {
      setError('Isi ID Penandatangan untuk provider PSrE yang dipilih.');
      return;
    }
    if (provider === 'KODE_OTORISASI_DJP' && !passphrase.trim()) {
      setError('Isi Passphrase untuk Kode Otorisasi DJP.');
      return;
    }
    if (!photoVerified) {
      setError('Ambil atau unggah foto pada bagian Verifikasi Identitas.');
      return;
    }
    if (!agreed) {
      setError('Centang pernyataan sebelum mengirim permohonan.');
      return;
    }
    setError(null);

    const now = new Date().toISOString();
    const credential = {
      provider,
      signerId: isPsre ? signerId.trim() : null,
      passphrase: provider === 'KODE_OTORISASI_DJP' ? passphrase : null,
      bpeNumber: String(Math.floor(100_000_000_000 + Math.random() * 900_000_000_000)),
      requestedAt: now,
      issuedAt: now,
    };

    mutate((d) => {
      d.mainAccountProfile = {
        nik: session.personNik,
        nama: session.personName,
        alamat: alamat.trim(),
        email: email.trim(),
        phone: phone.trim(),
        signingCredential: credential,
      };
    });
    setJustIssued(credential);
  }

  if (alreadyIssued && !justIssued) {
    const cred = profile.signingCredential!;
    return (
      <section className="rounded-card bg-white p-5 shadow-card">
        <h1 className="text-lg font-semibold">Permohonan Kode Otorisasi/Sertifikat Digital</h1>
        <p className="mt-3 rounded-md border border-good/40 bg-[#EAF7EE] px-3 py-2 text-[13px] text-ink">
          Sertifikat digital sudah terdaftar untuk akun ini.
        </p>
        <div className="mt-4 grid gap-2 text-[13px] sm:grid-cols-2">
          <ReadRow label="Jenis Sertifikat Digital" value={PROVIDER_OPTIONS.find((p) => p.value === cred.provider)!.label} />
          <ReadRow label={cred.signerId ? 'ID Penandatangan' : 'Passphrase'} value={cred.signerId ?? '••••••••'} />
          <ReadRow label="Nomor BPE" value={cred.bpeNumber} />
          <ReadRow label="Diterbitkan" value={new Date(cred.issuedAt).toLocaleString('id-ID')} />
        </div>
        <div className="mt-4 flex gap-2">
          <button
            className="btn-secondary"
            onClick={() => downloadText(`BPE-${cred.bpeNumber}.txt`, buildBpeText(profile, cred))}
          >
            Unduh Bukti Tanda Terima
          </button>
          <button
            className="btn-secondary"
            onClick={() => downloadText(`Surat-Penerbitan-Sertel-${cred.bpeNumber}.txt`, buildSuratText(profile, cred))}
          >
            Unduh Surat Penerbitan Sertifikat Digital
          </button>
        </div>
      </section>
    );
  }

  if (justIssued) {
    return (
      <section className="rounded-card bg-white p-5 shadow-card">
        <p className="rounded-md border border-good/40 bg-[#EAF7EE] px-3 py-2 text-[13px] font-medium text-good">
          Sertifikat Digital Berhasil Dibuat!
        </p>
        <div className="mt-4 flex gap-2">
          <button
            className="btn-primary"
            onClick={() => downloadText(`BPE-${justIssued.bpeNumber}.txt`, buildBpeText({ ...profile, alamat, email, phone }, justIssued))}
          >
            Unduh Bukti Tanda Terima
          </button>
          <button
            className="btn-primary"
            onClick={() => downloadText(`Surat-Penerbitan-Sertel-${justIssued.bpeNumber}.txt`, buildSuratText({ ...profile, alamat, email, phone }, justIssued))}
          >
            Unduh Surat Penerbitan Sertifikat Digital
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-card bg-white p-5 shadow-card">
      <h1 className="text-lg font-semibold">Permintaan Sertifikat Digital</h1>

      <div className="mt-4 space-y-4">
        <FormSection title="Manajemen Kasus">
          <div className="grid gap-3 sm:grid-cols-2">
            <ReadOnlyField label="Kanal" value="Daring (Portal Wajib Pajak)" />
            <ReadOnlyField label="Tanggal Permohonan" value={todayDMY()} />
          </div>
        </FormSection>

        <FormSection title="Identitas Wajib Pajak">
          <div className="grid gap-3 sm:grid-cols-2">
            <ReadOnlyField label="NIK/NPWP" value={session.personNik} mono />
            <ReadOnlyField label="Nama Wajib Pajak" value={session.personName} />
            <div className="sm:col-span-2">
              <label className="field-label" htmlFor="alamat">Alamat</label>
              <input
                id="alamat"
                className="field-input disabled:bg-canvas"
                value={alamat}
                disabled={!!profile.alamat}
                onChange={(e) => setAlamat(e.target.value)}
                placeholder="Alamat sesuai KTP"
              />
            </div>
          </div>
        </FormSection>

        <FormSection title="Detail Kontak">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="field-label" htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                className="field-input disabled:bg-canvas"
                value={email}
                disabled={contactLocked}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="field-label" htmlFor="phone">Nomor Telepon Seluler</label>
              <input
                id="phone"
                className="field-input disabled:bg-canvas"
                value={phone}
                disabled={contactLocked}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+62…"
              />
            </div>
          </div>
        </FormSection>

        <FormSection title="Rincian Sertifikat">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="field-label" htmlFor="jenis">Jenis Sertifikat Digital</label>
              <select
                id="jenis"
                className="field-input"
                value={provider}
                onChange={(e) => setProvider(e.target.value as CertificateProvider)}
              >
                <option value="">Silakan Pilih</option>
                {PROVIDER_OPTIONS.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
            {isPsre && (
              <div>
                <label className="field-label" htmlFor="signerId">ID Penandatangan</label>
                <input id="signerId" className="field-input" value={signerId} onChange={(e) => setSignerId(e.target.value)} />
              </div>
            )}
            {provider === 'KODE_OTORISASI_DJP' && (
              <div>
                <label className="field-label" htmlFor="passphrase">Passphrase</label>
                <input id="passphrase" type="password" className="field-input" value={passphrase} onChange={(e) => setPassphrase(e.target.value)} />
              </div>
            )}
          </div>
        </FormSection>

        <FormSection title="Verifikasi Identitas">
          <label className="flex cursor-pointer flex-col items-center gap-1 rounded-md border border-dashed border-line bg-canvas px-4 py-6 text-center text-[13px] text-ink-muted hover:border-brand-400">
            <input type="file" accept="image/*" capture="user" className="hidden" onChange={handlePhoto} />
            {photoVerified ? (
              <span className="font-medium text-good">Foto tersimpan: {photoName} (simulasi terverifikasi)</span>
            ) : (
              <span>Silakan ambil foto atau unggah dari komputer Anda (Take a photo / Upload photo)</span>
            )}
          </label>
          <p className="mt-1 text-xxs text-ink-muted">
            Pada praktikum ini foto tidak benar-benar dicocokkan ke Dukcapil/Imigrasi seperti Coretax
            asli — mengunggah berkas apa pun sudah dianggap "terverifikasi" untuk keperluan simulasi.
          </p>
        </FormSection>

        <FormSection title="Pernyataan Wajib Pajak">
          <label className="flex items-start gap-2 text-[13px]">
            <input type="checkbox" className="mt-0.5" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
            Dengan menyadari sepenuhnya akan segala akibatnya termasuk sanksi sesuai dengan ketentuan
            peraturan perundang-undangan yang berlaku, saya menyatakan bahwa apa yang saya sampaikan di
            atas adalah benar dan lengkap, dan saya menyetujui untuk menggunakan Akun Wajib Pajak saya
            sebagai sarana penerimaan surat dan dokumen perpajakan.
          </label>
        </FormSection>

        {error && <p role="alert" className="text-sm text-bad">{error}</p>}
        <button className="btn-primary" onClick={submit}>Kirim</button>
      </div>
    </section>
  );
}

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-line">
      <p className="border-b border-line bg-brand-50 px-3 py-2 text-[13px] font-semibold text-brand-800">{title}</p>
      <div className="p-3">{children}</div>
    </div>
  );
}

function ReadOnlyField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <label className="field-label">{label}</label>
      <output className={`field-input block bg-canvas ${mono ? 'font-mono' : ''}`}>{value}</output>
    </div>
  );
}

function ReadRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xxs text-ink-muted">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}

function buildBpeText(
  profile: { nik: string; nama: string; alamat: string; email: string; phone: string },
  cred: NonNullable<ReturnType<typeof emptyMainAccountProfile>['signingCredential']>,
) {
  return [
    'BUKTI PENERIMAAN ELEKTRONIK (BPE)',
    'Permohonan Kode Otorisasi/Sertifikat Digital',
    '',
    `Nomor BPE     : ${cred.bpeNumber}`,
    `NIK/NPWP      : ${profile.nik}`,
    `Nama          : ${profile.nama}`,
    `Alamat        : ${profile.alamat}`,
    `Email         : ${profile.email}`,
    `Telepon       : ${profile.phone}`,
    `Diterima pada : ${new Date(cred.requestedAt).toLocaleString('id-ID')}`,
    '',
    'Dokumen ini dibuat oleh simulasi EduTax UNY untuk keperluan praktikum,',
    'bukan dokumen resmi Direktorat Jenderal Pajak.',
  ].join('\n');
}

function buildSuratText(
  profile: { nik: string; nama: string; alamat: string; email: string; phone: string },
  cred: NonNullable<ReturnType<typeof emptyMainAccountProfile>['signingCredential']>,
) {
  const providerLabel = PROVIDER_OPTIONS.find((p) => p.value === cred.provider)!.label;
  return [
    'SURAT PENERBITAN SERTIFIKAT DIGITAL',
    '',
    `Nomor BPE          : ${cred.bpeNumber}`,
    `NIK/NPWP           : ${profile.nik}`,
    `Nama               : ${profile.nama}`,
    `Jenis Sertifikat   : ${providerLabel}`,
    cred.signerId ? `ID Penandatangan   : ${cred.signerId}` : 'Autentikasi          : Kode Otorisasi DJP (Passphrase)',
    `Diterbitkan pada   : ${new Date(cred.issuedAt).toLocaleString('id-ID')}`,
    '',
    'Dokumen ini dibuat oleh simulasi EduTax UNY untuk keperluan praktikum,',
    'bukan dokumen resmi Direktorat Jenderal Pajak.',
  ].join('\n');
}
