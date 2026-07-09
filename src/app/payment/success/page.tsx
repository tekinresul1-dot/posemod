import Link from 'next/link'
import { CheckCircle } from 'lucide-react'

export default function PaymentSuccessPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white flex items-center justify-center p-6">
      <div className="max-w-md text-center">
        <CheckCircle className="mx-auto text-green-400 mb-4" size={40} />
        <h1 className="text-2xl font-bold mb-2">Ödeme alındı</h1>
        <p className="text-gray-400 mb-6">
          PayTR bildirimi ulaştığında kredileriniz otomatik olarak hesabınıza yüklenecek.
        </p>
        <Link href="/dashboard" className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-lg">
          Dashboard’a dön
        </Link>
      </div>
    </div>
  )
}
