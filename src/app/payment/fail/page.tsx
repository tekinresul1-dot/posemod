import Link from 'next/link'
import { XCircle } from 'lucide-react'

export default function PaymentFailPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white flex items-center justify-center p-6">
      <div className="max-w-md text-center">
        <XCircle className="mx-auto text-red-400 mb-4" size={40} />
        <h1 className="text-2xl font-bold mb-2">Ödeme tamamlanamadı</h1>
        <p className="text-gray-400 mb-6">
          Kartınızdan ücret alınmadıysa tekrar deneyebilir veya farklı bir ödeme yöntemi kullanabilirsiniz.
        </p>
        <Link href="/pricing" className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-lg">
          Paketlere dön
        </Link>
      </div>
    </div>
  )
}
