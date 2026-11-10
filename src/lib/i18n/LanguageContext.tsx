'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

export type Language = 'id' | 'en';

export const TRANSLATIONS: Record<Language, Record<string, string>> = {
  id: {
    // Header & AppShell
    'app.version': 'Versi: 1.0.0-edutax',
    'app.academic': 'Simulasi Akademik',
    'app.notifications': 'Notifikasi',
    'app.help': 'Bantuan',
    'app.last_login': 'Login terakhir',
    'app.reset_data': 'Reset data',
    'app.reset_confirm': 'Seluruh data praktikum di browser ini akan dihapus. Lanjutkan?',
    'app.logout': 'Keluar',
    'app.reload': 'Muat ulang halaman',
    'app.impersonating': 'You are currently impersonating user:',

    // Nav
    'nav.portal': 'Portal Saya',
    'nav.efaktur': 'e-Faktur',
    'nav.ebupot': 'eBupot',
    'nav.spt': 'Surat Pemberitahuan (SPT)',
    'nav.payment': 'Pembayaran',
    'nav.ledger': 'Buku Besar',
    'nav.services': 'Layanan Wajib Pajak',
    'nav.access': 'Manajemen Akses',

    // Portal Menu
    'portal.dokumen-saya': 'Dokumen Saya',
    'portal.notifikasi-saya': 'Notifikasi Saya',
    'portal.kasus-saya': 'Kasus Saya',
    'portal.kasus-berjalan-saya': 'Kasus Berjalan Saya',
    'portal.profil-saya': 'Profil Saya',
    'portal.aktivasi-nik': 'Aktivasi NIK',
    'portal.sertifikat-digital': 'Permohonan Kode Otorisasi/Sertifikat Digital',
    'portal.pengukuhan-pkp': 'Pengukuhan PKP',
    'portal.pbb-p5l': 'Pendaftaran Objek Pajak PBB P5L',
    'portal.perubahan-data': 'Perubahan Data',
    'portal.perubahan-status': 'Perubahan Status',
    'portal.penghapusan-pencabutan': 'Penghapusan & Pencabutan',

    // Submenu exact labels (ID)
    'BPPU': 'BPPU',
    'BPNR': 'BPNR',
    'Penyetoran Sendiri': 'Penyetoran Sendiri',
    'Pemotongan Secara Digunggung': 'Pemotongan Secara Digunggung',
    'BP21 - Bukti Pemotongan Selain Pegawai Tetap': 'BP21 - Bukti Pemotongan Selain Pegawai Tetap',
    'BP26 - Bukti Pemotongan Wajib Pajak Luar Negeri': 'BP26 - Bukti Pemotongan Wajib Pajak Luar Negeri',
    'BPA1 - Bukti Pemotongan A1 Masa Pajak Terakhir': 'BPA1 - Bukti Pemotongan A1 Masa Pajak Terakhir',
    'BPA2 - Bukti Pemotongan A2 Masa Pajak Terakhir': 'BPA2 - Bukti Pemotongan A2 Masa Pajak Terakhir',
    'Bukti Pemotongan Bulanan Pegawai Tetap': 'Bukti Pemotongan Bulanan Pegawai Tetap',
    'Unggah Dokumen yang Dipersamakan': 'Unggah Dokumen yang Dipersamakan',
    'Dokumen Saya': 'Dokumen Saya',
    'Notifikasi Saya': 'Notifikasi Saya',
    'Kasus Saya': 'Kasus Saya',
    'Kasus Berjalan Saya': 'Kasus Berjalan Saya',
    'Profil Saya': 'Profil Saya',
    'Aktivasi NIK': 'Aktivasi NIK',
    'Permohonan Kode Otorisasi/Sertifikat Digital': 'Permohonan Kode Otorisasi/Sertifikat Digital',
    'Pengukuhan PKP': 'Pengukuhan PKP',
    'Pendaftaran Objek Pajak PBB P5L': 'Pendaftaran Objek Pajak PBB P5L',
    'Perubahan Data': 'Perubahan Data',
    'Perubahan Status': 'Perubahan Status',
    'Penghapusan & Pencabutan': 'Penghapusan & Pencabutan',

    // Identity Switcher
    'id_switch.main_account': 'Main Account',
    'id_switch.taxpayers': 'Taxpayers',
    'id_switch.no_taxpayer': 'Belum ada Taxpayer terdaftar.',
    'id_switch.not_found': 'Tidak ditemukan.',
    'id_switch.register_new': 'Daftarkan Taxpayer baru',
    'id_switch.search_placeholder': 'Cari NPWP atau nama…',
    'id_switch.tin_placeholder': 'NPWP 16 digit',
    'id_switch.name_placeholder': 'Nama badan/OP',
    'id_switch.address_placeholder': 'Alamat',
    'id_switch.cancel': 'Batal',
    'id_switch.save': 'Simpan',

    // Common Actions & Tabs
    'tab.unissued': 'Belum Terbit',
    'tab.issued': 'Telah Terbit',
    'tab.invalid': 'Tidak Valid',
    'action.delete': 'Hapus',
    'action.issue': 'Terbitkan',
    'action.import': 'Impor data',
    'action.view': 'Lihat',
    'action.edit': 'Ubah',
    'action.download': 'Unduh',
    'action.close': 'Tutup',
    'action.save_draft': 'Simpan Konsep',
    'action.submit': 'Submit',
    'action.sign_confirm': 'Konfirmasi Tanda Tangan',
    'action.pay_report': 'Bayar dan Lapor',
    'action.simulate_pay': 'Simulasikan Pembayaran',
    'action.download_billing': 'Unduh Billing (PDF)',
    'action.prev': 'Sebelumnya',
    'action.next': 'Berikutnya',
    'table.no_data': 'Tidak ada data yang ditemukan.',

    // Login Page
    'login.title': 'Login',
    'login.subtitle': 'Tahap 1 — Modul Role Akses',
    'login.user_id_label': 'ID Pengguna (NIM Mahasiswa) *',
    'login.user_id_placeholder': 'Masukkan 11 digit NIM Anda',
    'login.password_label': 'Kata Sandi *',
    'login.password_placeholder': 'Masukan Kata Sandi ID Pengguna Anda',
    'login.lang_label': 'Pemilihan Bahasa',
    'login.captcha_label': 'Kode Keamanan *',
    'login.captcha_placeholder': 'Masukkan Captcha',
    'login.forgot_pass': 'Lupa Kata Sandi?',
    'login.submit_button': 'Login',
    'login.info_title': 'Akun Praktikum Mahasiswa UNY',
    'login.info_desc': 'Gunakan NIM Anda sebagai ID Pengguna dan kata sandi praktikum untuk masuk. Setelah masuk, identitas akun Orang Pribadi dan dokumen simulasi otomatis terisi sesuai dengan nama dan NIM Anda masing-masing.',
    'login.aside_desc': 'Simulasi pembelajaran administrasi perpajakan untuk lingkungan akademik Fakultas Ekonomi & Bisnis UNY.',
  },
  en: {
    // Header & AppShell
    'app.version': 'Version: 1.0.0-edutax',
    'app.academic': 'Academic Simulation',
    'app.notifications': 'Notifications',
    'app.help': 'Help',
    'app.last_login': 'Last login',
    'app.reset_data': 'Reset Data',
    'app.reset_confirm': 'All practicum data in this browser will be wiped. Continue?',
    'app.logout': 'Logout',
    'app.reload': 'Reload page',
    'app.impersonating': 'You are currently impersonating user:',

    // Nav
    'nav.portal': 'My Portal',
    'nav.efaktur': 'e-Invoice',
    'nav.ebupot': 'e-Withholding',
    'nav.spt': 'Tax Return (SPT)',
    'nav.payment': 'Payment',
    'nav.ledger': 'General Ledger',
    'nav.services': 'Taxpayer Services',
    'nav.access': 'Access Management',

    // Portal Menu
    'portal.dokumen-saya': 'My Documents',
    'portal.notifikasi-saya': 'My Notifications',
    'portal.kasus-saya': 'My Cases',
    'portal.kasus-berjalan-saya': 'My Ongoing Cases',
    'portal.profil-saya': 'My Profile',
    'portal.aktivasi-nik': 'National ID / TIN Activation',
    'portal.sertifikat-digital': 'Digital Certificate / Authorization Code Request',
    'portal.pengukuhan-pkp': 'VAT Enterprise Confirmation (PKP)',
    'portal.pbb-p5l': 'Land & Building Tax Object Registration (PBB P5L)',
    'portal.perubahan-data': 'Data Amendment',
    'portal.perubahan-status': 'Status Amendment',
    'portal.penghapusan-pencabutan': 'Deregistration & Revocation',

    // Submenu exact labels (EN)
    'BPPU': 'BPPU',
    'BPNR': 'BPNR',
    'Penyetoran Sendiri': 'Self-Remittance',
    'Pemotongan Secara Digunggung': 'Aggregated Withholding',
    'BP21 - Bukti Pemotongan Selain Pegawai Tetap': 'BP21 - Non-Permanent Employee Withholding',
    'BP26 - Bukti Pemotongan Wajib Pajak Luar Negeri': 'BP26 - Non-Resident Taxpayer Withholding',
    'BPA1 - Bukti Pemotongan A1 Masa Pajak Terakhir': 'BPA1 - Last Period A1 Withholding Slip',
    'BPA2 - Bukti Pemotongan A2 Masa Pajak Terakhir': 'BPA2 - Last Period A2 Withholding Slip',
    'Bukti Pemotongan Bulanan Pegawai Tetap': 'Monthly Employee Withholding Slip',
    'Unggah Dokumen yang Dipersamakan': 'Upload Equivalent Documents',
    'Dokumen Saya': 'My Documents',
    'Notifikasi Saya': 'My Notifications',
    'Kasus Saya': 'My Cases',
    'Kasus Berjalan Saya': 'My Ongoing Cases',
    'Profil Saya': 'My Profile',
    'Aktivasi NIK': 'National ID / TIN Activation',
    'Permohonan Kode Otorisasi/Sertifikat Digital': 'Digital Certificate / Authorization Code Request',
    'Pengukuhan PKP': 'VAT Enterprise Confirmation (PKP)',
    'Pendaftaran Objek Pajak PBB P5L': 'Land & Building Tax Object Registration (PBB P5L)',
    'Perubahan Data': 'Data Amendment',
    'Perubahan Status': 'Status Amendment',
    'Penghapusan & Pencabutan': 'Deregistration & Revocation',

    // Identity Switcher
    'id_switch.main_account': 'Main Account',
    'id_switch.taxpayers': 'Taxpayers',
    'id_switch.no_taxpayer': 'No Taxpayers registered.',
    'id_switch.not_found': 'Not found.',
    'id_switch.register_new': 'Register new Taxpayer',
    'id_switch.search_placeholder': 'Search TIN or name…',
    'id_switch.tin_placeholder': '16-digit TIN',
    'id_switch.name_placeholder': 'Entity / Individual Name',
    'id_switch.address_placeholder': 'Address',
    'id_switch.cancel': 'Cancel',
    'id_switch.save': 'Save',

    // Common Actions & Tabs
    'tab.unissued': 'Unissued',
    'tab.issued': 'Issued',
    'tab.invalid': 'Invalid',
    'action.delete': 'Delete',
    'action.issue': 'Issue',
    'action.import': 'Import data',
    'action.view': 'View',
    'action.edit': 'Edit',
    'action.download': 'Download',
    'action.close': 'Close',
    'action.save_draft': 'Save Draft',
    'action.submit': 'Submit',
    'action.sign_confirm': 'Confirm Signature',
    'action.pay_report': 'Pay and File',
    'action.simulate_pay': 'Simulate Payment',
    'action.download_billing': 'Download Billing (PDF)',
    'action.prev': 'Previous',
    'action.next': 'Next',
    'table.no_data': 'No data found.',

    // Login Page
    'login.title': 'Login',
    'login.subtitle': 'Stage 1 — Access Role Module',
    'login.user_id_label': 'User ID (Student ID) *',
    'login.user_id_placeholder': 'Enter your 11-digit Student ID',
    'login.password_label': 'Password *',
    'login.password_placeholder': 'Enter your User ID password',
    'login.lang_label': 'Language Selection',
    'login.captcha_label': 'Security Code *',
    'login.captcha_placeholder': 'Enter Captcha',
    'login.forgot_pass': 'Forgot Password?',
    'login.submit_button': 'Login',
    'login.info_title': 'UNY Student Practicum Account',
    'login.info_desc': 'Use your Student ID as User ID and practicum password to enter. After logging in, the individual account identity and simulation documents are automatically filled according to your respective name and Student ID.',
    'login.aside_desc': 'Educational tax administration simulation for the academic environment of Faculty of Economics & Business UNY.',
  },
};

interface LanguageContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: string, fallback?: string) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  lang: 'id',
  setLang: () => {},
  t: (key: string, fallback?: string) => fallback ?? key,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Language>('id');

  useEffect(() => {
    try {
      const stored = localStorage.getItem('edutax_lang') as Language;
      if (stored === 'id' || stored === 'en') {
        setLangState(stored);
      }
    } catch {}

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'edutax_lang' && (e.newValue === 'id' || e.newValue === 'en')) {
        setLangState(e.newValue);
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const setLang = (newLang: Language) => {
    setLangState(newLang);
    try {
      localStorage.setItem('edutax_lang', newLang);
      window.dispatchEvent(new Event('edutax:lang-changed'));
    } catch {}
  };

  const t = (key: string, fallback?: string): string => {
    return TRANSLATIONS[lang]?.[key] ?? fallback ?? key;
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
