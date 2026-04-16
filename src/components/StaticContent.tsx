import React from 'react';
import { motion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { ChevronRight, HelpCircle, Truck, RefreshCw, ShieldCheck, Info, Briefcase, BookOpen } from 'lucide-react';

interface StaticContentProps {
  view: 'about' | 'help' | 'shipping' | 'returns' | 'privacy' | 'guide' | 'careers' | 'blog';
  onBack: () => void;
}

export const StaticContent: React.FC<StaticContentProps> = ({ view, onBack }) => {
  const content = {
    about: {
      title: "Tentang Devi's Market",
      icon: Info,
      text: "Devi's Market adalah marketplace terpercaya yang didedikasikan untuk mengangkat produk-produk berkualitas dari UMKM dan pengrajin lokal Indonesia. Kami percaya bahwa setiap produk buatan Indonesia memiliki cerita dan keunikan tersendiri yang layak mendapatkan panggung di kancah nasional maupun internasional.",
      sections: [
        { subtitle: "Visi Kami", body: "Menjadi platform e-commerce nomor satu yang memberdayakan ekonomi lokal melalui inovasi digital." },
        { subtitle: "Misi Kami", body: "Memberikan akses pasar yang lebih luas bagi pengrajin lokal, memastikan transaksi yang aman, dan memberikan pengalaman belanja yang unik dengan nuansa budaya Indonesia." }
      ]
    },
    help: {
      title: "Pusat Bantuan",
      icon: HelpCircle,
      text: "Ada yang bisa kami bantu? Temukan jawaban dari pertanyaan yang sering diajukan di sini.",
      sections: [
        { subtitle: "Pesanan & Pembayaran", body: "Informasi mengenai status pesanan, metode pembayaran yang tersedia, dan konfirmasi pembayaran." },
        { subtitle: "Akun & Keamanan", body: "Cara mendaftar, mengganti password, dan menjaga keamanan akun Anda di Devi's Market." }
      ]
    },
    shipping: {
      title: "Informasi Pengiriman",
      icon: Truck,
      text: "Kami bekerja sama dengan berbagai jasa ekspedisi terpercaya untuk memastikan produk Anda sampai dengan aman dan tepat waktu.",
      sections: [
        { subtitle: "Waktu Pengiriman", body: "Estimasi pengiriman reguler adalah 2-4 hari kerja untuk wilayah Jawa dan 4-7 hari kerja untuk luar pulau Jawa." },
        { subtitle: "Lacak Pesanan", body: "Anda dapat melacak posisi paket Anda melalui nomor resi yang tersedia di detail pesanan pada profil akun Anda." }
      ]
    },
    returns: {
      title: "Kebijakan Pengembalian Barang",
      icon: RefreshCw,
      text: "Kepuasan Anda adalah prioritas kami. Jika barang yang diterima rusak atau tidak sesuai, Anda dapat mengajukan pengembalian.",
      sections: [
        { subtitle: "Syarat Pengembalian", body: "Barang harus dalam kondisi yang sama saat diterima, belum pernah dipakai, dan masih memiliki label harga tag utuh. Video unboxing wajib disertakan." },
        { subtitle: "Proses Refund", body: "Refund akan diproses dalam waktu 3-5 hari kerja setelah barang kami terima dan melewati proses inspeksi kualitas." }
      ]
    },
    privacy: {
      title: "Kebijakan Privasi",
      icon: ShieldCheck,
      text: "Kami sangat menghargai privasi data Anda. Informasi pribadi Anda hanya digunakan untuk kepentingan transaksi dan peningkatan layanan kami.",
      sections: [
        { subtitle: "Data yang Kami Kumpulkan", body: "Nama, alamat pengiriman, nomor telepon, dan riwayat transaksi untuk memudahkan proses logistik." },
        { subtitle: "Keamanan Data", body: "Semua data transaksi dienkripsi menggunakan teknologi terkini untuk mencegah akses yang tidak sah." }
      ]
    },
    guide: {
      title: "Cara Pembelian",
      icon: ChevronRight,
      text: "Belanja di Devi's Market sangat mudah dan aman. Ikuti langkah-langkah sederhana berikut ini.",
      sections: [
        { subtitle: "Pilih Produk", body: "Cari produk yang Anda inginkan melalui bar pencarian atau pilih berdasarkan kategori yang tersedia." },
        { subtitle: "Checkout & Bayar", body: "Masukkan produk ke keranjang, isi alamat pengiriman, pilih metode pembayaran, dan lakukan pembayaran." }
      ]
    },
    careers: {
      title: "Karir di Devi's Market",
      icon: Briefcase,
      text: "Bergabunglah dengan tim yang bersemangat untuk memajukan ekonomi digital Indonesia.",
      sections: [
        { subtitle: "Budaya Kerja", body: "Kami mengutamakan kolaborasi, kreativitas, dan rasa memiliki terhadap misi perusahaan." },
        { subtitle: "Lowongan Tersedia", body: "Saat ini kami sedang mencari talenta untuk posisi Software Engineer, Marketing Specialist, dan Customer Support." }
      ]
    },
    blog: {
      title: "Devi's Blog",
      icon: BookOpen,
      text: "Temukan inspirasi gaya hidup, tips belanja, dan cerita dibalik pengrajin-pengrajin hebat kami.",
      sections: [
        { subtitle: "Trend Batik Musim Ini", body: "Eksplorasi motif-motif batik modern yang cocok untuk gaya kasual sehari-hari." },
        { subtitle: "Tips Merawat Perajin Perak", body: "Cara mudah membersihkan perhiasan perak agar tetap berkilau seperti baru." }
      ]
    }
  };

  const current = content[view];
  const Icon = current.icon;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="max-w-4xl mx-auto py-12 px-4"
    >
      <div className="flex items-center gap-4 mb-8">
        <div className="p-3 bg-primary/10 rounded-full text-primary">
          <Icon className="w-8 h-8" />
        </div>
        <h1 className="text-4xl font-heading font-bold">{current.title}</h1>
      </div>
      <p className="text-lg text-secondary-foreground mb-12 leading-relaxed">
        {current.text}
      </p>
      
      <div className="space-y-12">
        {current.sections.map((section, idx) => (
          <div key={idx} className="border-l-4 border-primary pl-6 py-2">
            <h2 className="text-xl font-bold mb-3">{section.subtitle}</h2>
            <p className="text-secondary-foreground leading-relaxed">{section.body}</p>
          </div>
        ))}
      </div>

      <div className="mt-16 pt-8 border-t border-border">
        <Button onClick={onBack} variant="outline" className="rounded-sm">
          Kembali ke Beranda
        </Button>
      </div>
    </motion.div>
  );
};
