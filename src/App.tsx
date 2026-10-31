import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { Header } from './components/Header'
import { Footer } from './components/Footer'
import { HomePage } from './pages/HomePage'
import { GalleryPage } from './pages/GalleryPage'
import { PhotoPage } from './pages/PhotoPage'
import { AboutPage } from './pages/AboutPage'
import { ContactPage } from './pages/ContactPage'
import { AdminPage } from './pages/AdminPage'
import { CalendarPage } from './pages/CalendarPage'
import { StorePage } from './pages/StorePage'
import { StoreProductPage } from './pages/StoreProductPage'
import { StoreCartPage } from './pages/StoreCartPage'
import { StoreCheckoutPage } from './pages/StoreCheckoutPage'
import { StoreOrderPage } from './pages/StoreOrderPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { PhotosProvider } from './data/PhotosProvider'
import { SiteSettingsProvider } from './data/SiteSettingsProvider'
import { CartProvider } from './data/CartProvider'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

function Shell() {
  const { pathname } = useLocation()
  const isAdmin = pathname.startsWith('/admin')

  return (
    <div className={`app-shell${isAdmin ? ' app-shell--admin' : ''}`}>
      {!isAdmin && <Header />}
      <main>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/gallery" element={<GalleryPage />} />
          <Route path="/gallery/:photoId" element={<PhotoPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/store" element={<StorePage />} />
          <Route path="/store/cart" element={<StoreCartPage />} />
          <Route path="/store/checkout" element={<StoreCheckoutPage />} />
          <Route path="/store/order/:orderId" element={<StoreOrderPage />} />
          <Route path="/store/:productId" element={<StoreProductPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
      {!isAdmin && <Footer />}
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <PhotosProvider>
        <SiteSettingsProvider>
          <CartProvider>
            <ScrollToTop />
            <Shell />
          </CartProvider>
        </SiteSettingsProvider>
      </PhotosProvider>
    </BrowserRouter>
  )
}
