import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

const KEY = 'aswf-store-cart'

export type CartItem = {
  productId: string
  variantId: string
  quantity: number
  title: string
  variantTitle: string
  previewUrl: string
  unitPriceCents: number
}

type CartContextValue = {
  items: CartItem[]
  count: number
  addItem: (item: CartItem) => void
  setQuantity: (productId: string, variantId: string, quantity: number) => void
  removeItem: (productId: string, variantId: string) => void
  clear: () => void
}

const CartContext = createContext<CartContextValue | null>(null)

function isCartItem(value: unknown): value is CartItem {
  if (!value || typeof value !== 'object') return false
  const item = value as Partial<CartItem>
  return (
    typeof item.productId === 'string' &&
    typeof item.variantId === 'string' &&
    typeof item.title === 'string' &&
    typeof item.variantTitle === 'string' &&
    typeof item.previewUrl === 'string' &&
    typeof item.unitPriceCents === 'number' &&
    typeof item.quantity === 'number' &&
    item.quantity > 0
  )
}

function loadCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isCartItem).slice(0, 15)
  } catch {
    return []
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => loadCart())

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(items))
  }, [items])

  const addItem = useCallback((item: CartItem) => {
    setItems((current) => {
      const index = current.findIndex(
        (line) => line.productId === item.productId && line.variantId === item.variantId,
      )
      if (index < 0) return [...current, item].slice(0, 15)
      const next = [...current]
      const existing = next[index]!
      next[index] = { ...item, quantity: Math.min(20, existing.quantity + item.quantity) }
      return next
    })
  }, [])

  const setQuantity = useCallback((productId: string, variantId: string, quantity: number) => {
    setItems((current) =>
      current.flatMap((line) => {
        if (line.productId !== productId || line.variantId !== variantId) return [line]
        if (quantity < 1) return []
        return [{ ...line, quantity: Math.min(20, quantity) }]
      }),
    )
  }, [])

  const removeItem = useCallback((productId: string, variantId: string) => {
    setItems((current) =>
      current.filter((line) => line.productId !== productId || line.variantId !== variantId),
    )
  }, [])

  const clear = useCallback(() => setItems([]), [])

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      count: items.reduce((sum, item) => sum + item.quantity, 0),
      addItem,
      setQuantity,
      removeItem,
      clear,
    }),
    [items, addItem, setQuantity, removeItem, clear],
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const cart = useContext(CartContext)
  if (!cart) throw new Error('useCart must be used within CartProvider')
  return cart
}
