/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  auth, db, googleProvider, signInWithPopup, signOut, onAuthStateChanged, 
  collection, query, where, orderBy, onSnapshot, doc, setDoc, getDoc, 
  addDoc, updateDoc, deleteDoc, serverTimestamp, OperationType, handleFirestoreError,
  signInWithEmailAndPassword, createUserWithEmailAndPassword
} from '@/src/lib/firebase';
import { UserProfile, Product, Order, Notification, CartItem, HeroContent } from '@/src/types';
import { ErrorBoundary } from '@/src/components/ErrorBoundary';
import { StaticContent } from '@/src/components/StaticContent';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { 
  ShoppingBag, Search, User, Bell, LayoutDashboard, LogOut, 
  ShoppingCart, Star, Package, TrendingUp, AlertTriangle, Filter,
  ChevronRight, Home, CreditCard, MapPin, CheckCircle2, Clock,
  Store, Plus, Trash2, Edit, Book, Smartphone, Shirt, Utensils,
  Heart, Gamepad, Car, Dumbbell, HelpCircle, Truck, RefreshCw, Info, Briefcase, BookOpen, ShieldCheck,
  LogIn, UserPlus, Shield
} from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { getProductRecommendations } from '@/src/lib/gemini';
import { motion, AnimatePresence } from 'motion/react';

type View = 'home' | 'search' | 'cart' | 'profile' | 'admin' | 'orders' | 'about' | 'help' | 'shipping' | 'returns' | 'privacy' | 'guide' | 'careers' | 'blog';

const CATEGORIES = [
  { name: 'Elektronik', icon: Smartphone },
  { name: 'Fashion', icon: Shirt },
  { name: 'Makanan', icon: Utensils },
  { name: 'Buku & Media', icon: Book },
  { name: 'Rumah Tangga', icon: Home },
  { name: 'Kesehatan', icon: Heart },
  { name: 'Hobi', icon: Gamepad },
  { name: 'Otomotif', icon: Car },
  { name: 'Olahraga', icon: Dumbbell },
];

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>('home');
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [heroContent, setHeroContent] = useState<HeroContent>({
    title: "Koleksi Warisan Devi's",
    subtitle: "Temukan keindahan abadi dalam setiap detail kerajinan tangan terbaik Indonesia.",
    ctaText: "Lihat Koleksi",
    imageUrl: "https://picsum.photos/seed/hero/1200/600"
  });

  const [isLoginDialogOpen, setIsLoginDialogOpen] = useState(false);
  const [adminLoginForm, setAdminLoginForm] = useState({ username: '', password: '' });
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleLogin = () => {
    setIsLoginDialogOpen(true);
  };

  const handleGoogleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      setIsLoginDialogOpen(false);
    } catch (error) {
      console.error(error);
      toast.error('Login gagal. Silakan coba lagi.');
    }
  };

  const handleAdminCredentialsLogin = async () => {
    if (!adminLoginForm.username || !adminLoginForm.password) {
      toast.error('Username dan password harus diisi');
      return;
    }

    setIsLoggingIn(true);
    try {
      // Map username to email for standard Firebase Auth
      const email = adminLoginForm.username === 'admin1' 
        ? 'admin1@devis.market' 
        : `${adminLoginForm.username}@devis.market`;
      
      try {
        await signInWithEmailAndPassword(auth, email, adminLoginForm.password);
      } catch (err: any) {
        // If user not found, and it's the specific admin1 account, try to create it
        if (err.code === 'auth/user-not-found' && adminLoginForm.username === 'admin1' && adminLoginForm.password === 'admin123') {
           await createUserWithEmailAndPassword(auth, email, adminLoginForm.password);
        } else {
          throw err;
        }
      }
      
      setIsLoginDialogOpen(false);
      setAdminLoginForm({ username: '', password: '' });
      toast.success('Berhasil masuk sebagai Admin');
    } catch (error: any) {
      console.error(error);
      if (error.code === 'auth/wrong-password') {
        toast.error('Password salah');
      } else if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
        toast.error('Kredensial tidak valid');
      } else if (error.code === 'auth/operation-not-allowed') {
        toast.error('Login email/password belum diaktifkan di Firebase Console.');
      } else {
        toast.error('Login gagal: ' + error.message);
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const cancelOrder = async (orderId: string) => {
    if (!window.confirm('Apakah Anda yakin ingin membatalkan pesanan ini?')) return;
    try {
      await updateDoc(doc(db, 'orders', orderId), {
        status: 'cancelled',
        updatedAt: new Date().toISOString()
      });
      toast.success('Pesanan berhasil dibatalkan');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `orders/${orderId}`);
    }
  };

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        const isAdminEmail = firebaseUser.email === 'adom.rama@gmail.com' || firebaseUser.email === 'admin1@devis.market';
        
        if (userDoc.exists()) {
          const userData = userDoc.data() as UserProfile;
          if (isAdminEmail && userData.role !== 'admin') {
            const updatedUser = { ...userData, role: 'admin' as const };
            await updateDoc(doc(db, 'users', firebaseUser.uid), { role: 'admin' });
            setUser(updatedUser);
          } else {
            setUser(userData);
          }
        } else {
          const newUser: UserProfile = {
            uid: firebaseUser.uid,
            email: firebaseUser.email || '',
            displayName: firebaseUser.displayName || (firebaseUser.email?.split('@')[0]) || 'User',
            photoURL: firebaseUser.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${firebaseUser.email}`,
            role: isAdminEmail ? 'admin' : 'user',
            createdAt: new Date().toISOString(),
          };
          await setDoc(doc(db, 'users', firebaseUser.uid), newUser);
          setUser(newUser);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  // Real-time Products
  useEffect(() => {
    const q = query(collection(db, 'products'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedProducts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
      setProducts(fetchedProducts);
      
      // Seed initial data if empty
      if (fetchedProducts.length === 0 && isAuthReady) {
        seedInitialData();
      }
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'products'));
    return () => unsubscribe();
  }, [isAuthReady]);

  // Real-time Hero Content
  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'settings', 'hero'), (snapshot) => {
      if (snapshot.exists()) {
        setHeroContent(snapshot.data() as HeroContent);
      }
    }, (error) => handleFirestoreError(error, OperationType.GET, 'settings/hero'));
    return () => unsubscribe();
  }, []);

  const seedInitialData = async () => {
    const initialProducts = [
      {
        name: 'Novel Laskar Pelangi',
        description: 'Novel fenomenal karya Andrea Hirata. Kisah inspiratif tentang perjuangan anak-anak Belitong menggapai mimpi.',
        price: 95000,
        stock: 100,
        category: 'Buku & Media',
        images: ['https://picsum.photos/seed/book/400/400'],
        sellerId: 'system',
        sellerName: 'Pustaka Jaya',
        avgRating: 4.9,
        reviewCount: 1200,
        createdAt: new Date().toISOString()
      },
      {
        name: 'E-Book: Strategi Bisnis Digital',
        description: 'Panduan lengkap membangun bisnis digital dari nol. Format PDF & EPUB.',
        price: 49000,
        stock: 999,
        category: 'Buku & Media',
        images: ['https://picsum.photos/seed/ebook/400/400'],
        sellerId: 'system',
        sellerName: 'Devi\'s Academy',
        avgRating: 4.8,
        reviewCount: 450,
        createdAt: new Date().toISOString()
      },
      {
        name: 'Kopi Luwak Asli 250g',
        description: 'Kopi luwak liar asli dari pegunungan Gayo, Aceh. Rasa yang sangat halus dan aroma yang kaya.',
        price: 350000,
        stock: 50,
        category: 'Makanan',
        images: ['https://picsum.photos/seed/kopi/400/400'],
        sellerId: 'system',
        sellerName: 'Aceh Coffee Hub',
        avgRating: 4.9,
        reviewCount: 85,
        createdAt: new Date().toISOString()
      },
      {
        name: 'Batik Tulis Solo Sutra',
        description: 'Batik tulis tangan asli Solo dengan bahan sutra berkualitas tinggi. Motif klasik Parang Kusumo.',
        price: 1250000,
        stock: 5,
        category: 'Fashion',
        images: ['https://picsum.photos/seed/batik/400/400'],
        sellerId: 'system',
        sellerName: 'Solo Batik Center',
        avgRating: 5.0,
        reviewCount: 12,
        createdAt: new Date().toISOString()
      },
      {
        name: 'Smartphone Devi\'s X1',
        description: 'Smartphone lokal dengan spesifikasi flagship. RAM 12GB, Storage 256GB, Kamera 108MP.',
        price: 4500000,
        stock: 100,
        category: 'Elektronik',
        images: ['https://picsum.photos/seed/phone/400/400'],
        sellerId: 'system',
        sellerName: 'Devi\'s Tech',
        avgRating: 4.7,
        reviewCount: 240,
        createdAt: new Date().toISOString()
      },
      {
        name: 'Kerajinan Perak Kotagede',
        description: 'Set perhiasan perak buatan tangan dari Kotagede, Yogyakarta. Desain filigree yang rumit.',
        price: 750000,
        stock: 15,
        category: 'Hobi',
        images: ['https://picsum.photos/seed/silver/400/400'],
        sellerId: 'system',
        sellerName: 'Yogya Silver Artisans',
        avgRating: 4.8,
        reviewCount: 45,
        createdAt: new Date().toISOString()
      }
    ];

    for (const p of initialProducts) {
      await addDoc(collection(db, 'products'), p);
    }
    toast.info('Initial products seeded!');
  };

  // Real-time Orders
  useEffect(() => {
    if (!user) return;
    const q = user.role === 'admin' 
      ? query(collection(db, 'orders'), orderBy('createdAt', 'desc'))
      : query(collection(db, 'orders'), where('userId', '==', user.uid), orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'orders'));
    return () => unsubscribe();
  }, [user]);

  // Real-time Notifications
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'notifications'), where('userId', '==', user.uid), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setNotifications(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notification)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'notifications'));
    return () => unsubscribe();
  }, [user]);

  // AI Recommendations
  useEffect(() => {
    if (user && products.length > 0 && isAuthReady) {
      const recentPurchases = orders.flatMap(o => o.items.map(i => i.name)).slice(0, 5);
      getProductRecommendations(user.preferences?.categories || [], recentPurchases, products)
        .then(setRecommendations);
    }
  }, [user, products, orders, isAuthReady]);

  const handleLogout = async () => {
    await signOut(auth);
    setView('home');
    toast.success('Logged out.');
  };

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.productId === product.id);
      if (existing) {
        return prev.map(item => item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { 
        productId: product.id, 
        name: product.name, 
        price: product.price, 
        quantity: 1, 
        image: product.images?.[0] || 'https://picsum.photos/seed/product/200/200' 
      }];
    });
    toast.success(`${product.name} added to cart`);
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.productId !== productId));
  };

  const updateCartQuantity = (productId: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.productId === productId) {
        const newQty = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [checkoutForm, setCheckoutForm] = useState({
    name: '',
    address: '',
    city: '',
    zipCode: '',
    paymentMethod: 'Bank Transfer'
  });

  const checkout = async () => {
    if (!user) {
      handleLogin();
      return;
    }
    if (cart.length === 0) return;
    
    setCheckoutForm({
      name: user.displayName,
      address: '',
      city: '',
      zipCode: '',
      paymentMethod: 'Bank Transfer'
    });
    setIsCheckoutOpen(true);
  };

  const processOrder = async () => {
    if (!checkoutForm.address || !checkoutForm.city) {
      toast.error('Mohon lengkapi alamat pengiriman');
      return;
    }

    try {
      const total = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);
      const newOrder: Omit<Order, 'id'> = {
        userId: user!.uid,
        items: cart,
        total,
        status: 'pending',
        shippingAddress: {
          name: checkoutForm.name,
          address: checkoutForm.address,
          city: checkoutForm.city,
          zipCode: checkoutForm.zipCode
        },
        paymentMethod: checkoutForm.paymentMethod,
        createdAt: new Date().toISOString()
      };

      const orderRef = await addDoc(collection(db, 'orders'), newOrder);
      
      await addDoc(collection(db, 'notifications'), {
        userId: user!.uid,
        message: `Pesanan #${orderRef.id.slice(0, 5)} berhasil dibuat!`,
        type: 'order',
        read: false,
        createdAt: new Date().toISOString()
      });

      setCart([]);
      setIsCheckoutOpen(false);
      setView('orders');
      toast.success('Pesanan berhasil dibuat!');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'orders');
    }
  };

  const [isUpdating, setIsUpdating] = useState(false);

  const updateProfile = async (newName: string) => {
    if (!user) return;
    setIsUpdating(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), { displayName: newName });
      setUser({ ...user, displayName: newName });
      toast.success('Profil berhasil diperbarui!');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'users');
    } finally {
      setIsUpdating(false);
    }
  };

  const becomeSeller = async () => {
    if (!user) return;
    setIsUpdating(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), { role: 'seller' });
      setUser({ ...user, role: 'seller' });
      toast.success('Selamat! Anda sekarang adalah Penjual.');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'users');
    } finally {
      setIsUpdating(false);
    }
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const recommendedProducts = products.filter(p => recommendations.includes(p.id));

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full"
        />
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen luxury-gradient text-foreground font-sans">
        <Toaster position="top-center" />
        
        {/* Navbar */}
        <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center gap-8">
                <div 
                  className="flex items-center gap-3 cursor-pointer" 
                  onClick={() => setView('home')}
                >
                  <div className="w-10 h-10 rounded-sm overflow-hidden border border-primary/20 p-1 bg-white">
                    <img 
                      src="https://lh3.googleusercontent.com/d/1z-BPgCHshf4o0vueI9ZwlnakUnGgy3C3" 
                      alt="Devi's Market Logo" 
                      className="w-full h-full object-contain"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <span className="text-2xl font-heading font-bold tracking-[2px] hidden sm:block uppercase">
                    <span className="teal-text">Devi's</span> <span className="brand-text">Market</span>
                  </span>
                </div>

                <div className="relative hidden md:block w-96">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input 
                    placeholder="Search for collections, limited editions..." 
                    className="pl-10 bg-card border-border focus-visible:ring-primary text-secondary-foreground"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onFocus={() => setView('search')}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 sm:gap-4">
                {user ? (
                  <>
                    <Sheet>
                      <SheetTrigger 
                        render={
                          <button className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "relative")} />
                        }
                      >
                        <Bell className="w-5 h-5" />
                        {notifications.filter(n => !n.read).length > 0 && (
                          <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full" />
                        )}
                      </SheetTrigger>
                      <SheetContent>
                        <SheetHeader>
                          <SheetTitle>Notifikasi</SheetTitle>
                        </SheetHeader>
                        <ScrollArea className="h-[calc(100vh-100px)] mt-4">
                          {notifications.length === 0 ? (
                            <p className="text-center text-gray-500 mt-8">Tidak ada notifikasi</p>
                          ) : (
                            notifications.map(n => (
                              <div key={n.id} className={`p-4 border-b ${n.read ? 'opacity-60' : 'bg-blue-50/50'}`}>
                                <p className="text-sm font-medium">{n.message}</p>
                                <p className="text-xs text-gray-400 mt-1">{new Date(n.createdAt).toLocaleString()}</p>
                              </div>
                            ))
                          )}
                        </ScrollArea>
                      </SheetContent>
                    </Sheet>

                    <Sheet>
                      <SheetTrigger 
                        render={
                          <button className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "relative")} />
                        }
                      >
                        <ShoppingCart className="w-5 h-5" />
                        {cart.length > 0 && (
                          <Badge className="absolute -top-1 -right-1 px-1.5 min-w-[1.25rem] h-5 flex items-center justify-center">
                            {cart.reduce((acc, i) => acc + i.quantity, 0)}
                          </Badge>
                        )}
                      </SheetTrigger>
                      <SheetContent className="w-full sm:max-w-md">
                        <SheetHeader>
                          <SheetTitle>Keranjang Belanja</SheetTitle>
                        </SheetHeader>
                        <div className="flex flex-col h-full">
                          <ScrollArea className="flex-1 mt-4 pr-4">
                            {cart.length === 0 ? (
                              <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                                <ShoppingCart className="w-12 h-12 mb-4 opacity-20" />
                                <p>Keranjang masih kosong</p>
                              </div>
                            ) : (
                              <div className="space-y-4">
                                {cart.map(item => (
                                  <div key={item.productId} className="flex gap-4">
                                    <img src={item.image} alt={item.name} className="w-20 h-20 object-cover rounded-lg" referrerPolicy="no-referrer" />
                                    <div className="flex-1">
                                      <h4 className="font-medium text-sm">{item.name}</h4>
                                      <p className="text-primary font-bold mt-1">Rp {item.price.toLocaleString()}</p>
                                      <div className="flex items-center gap-2 mt-2">
                                        <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateCartQuantity(item.productId, -1)}>-</Button>
                                        <span className="text-sm w-6 text-center">{item.quantity}</span>
                                        <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateCartQuantity(item.productId, 1)}>+</Button>
                                        <Button variant="ghost" size="icon" className="h-7 w-7 ml-auto text-red-500" onClick={() => removeFromCart(item.productId)}>
                                          <LogOut className="w-4 h-4" />
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </ScrollArea>
                          {cart.length > 0 && (
                            <div className="border-t pt-4 mt-auto space-y-4 pb-8">
                              <div className="flex justify-between font-bold text-lg">
                                <span>Total</span>
                                <span>Rp {cart.reduce((acc, i) => acc + i.price * i.quantity, 0).toLocaleString()}</span>
                              </div>
                              <Button className="w-full py-6 text-lg" onClick={checkout}>Checkout Sekarang</Button>
                            </div>
                          )}
                        </div>
                      </SheetContent>
                    </Sheet>

                    <Avatar className="cursor-pointer" onClick={() => setView('profile')}>
                      <AvatarImage src={user.photoURL} />
                      <AvatarFallback>{user.displayName[0]}</AvatarFallback>
                    </Avatar>
                  </>
                ) : (
                  <Button 
                    className="bg-primary text-primary-foreground font-bold rounded-sm uppercase tracking-widest text-[10px]"
                    onClick={handleLogin}
                  >
                    Login / Daftar
                  </Button>
                )}
              </div>
            </div>
          </div>
        </nav>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <AnimatePresence mode="wait">
            {view === 'home' && (
              <motion.div 
                key="home"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-12"
              >
                {/* Hero */}
                <section className="relative h-[400px] rounded-xl overflow-hidden bg-card border border-border">
                  <div className="absolute inset-0 grid grid-cols-1 md:grid-cols-2 gap-8 items-center px-12 z-10">
                    <div className="space-y-6">
                      <Badge className="w-fit bg-primary/10 text-primary border border-primary px-3 py-1 rounded-full text-[10px] uppercase tracking-widest">Recommended for you</Badge>
                      <h1 className="text-5xl font-heading font-bold leading-tight">{heroContent.title}</h1>
                      <p className="text-lg text-secondary-foreground max-w-md">{heroContent.subtitle}</p>
                      <Button className="w-fit bg-primary text-primary-foreground hover:opacity-90 px-8 py-6 text-sm font-bold uppercase tracking-widest rounded-sm" onClick={() => setView('search')}>
                        {heroContent.ctaText}
                      </Button>
                    </div>
                    <div className="hidden md:flex justify-center relative h-full items-center">
                      <img 
                        src={heroContent.imageUrl} 
                        className="absolute inset-0 w-full h-full object-cover opacity-40 mask-gradient" 
                        alt="Hero"
                      />
                      <div className="w-64 h-64 rounded-full border-2 border-primary/20 flex items-center justify-center relative z-10">
                        <div className="w-48 h-48 rounded-full border border-primary/40 flex items-center justify-center">
                          <span className="text-4xl font-heading italic text-primary/60">EST. 2026</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent" />
                </section>

                {/* Categories */}
                <section>
                  <div className="flex justify-between items-end mb-6">
                    <div>
                      <h2 className="text-2xl font-bold">Kategori Populer</h2>
                      <p className="text-gray-500">Temukan apa yang Anda butuhkan</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-9 gap-4">
                    {CATEGORIES.map(cat => (
                      <Card key={cat.name} className="hover:border-primary cursor-pointer transition-colors group" onClick={() => { setSearchQuery(cat.name); setView('search'); }}>
                        <CardContent className="p-4 flex flex-col items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                            <cat.icon className="w-5 h-5 text-gray-600 group-hover:text-primary" />
                          </div>
                          <span className="text-xs font-medium text-center">{cat.name}</span>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </section>

                {/* AI Recommendations */}
                {recommendedProducts.length > 0 && (
                  <section>
                    <div className="flex items-center gap-2 mb-6">
                      <TrendingUp className="w-6 h-6 text-primary" />
                      <h2 className="text-2xl font-bold">Rekomendasi Untuk Anda</h2>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                      {recommendedProducts.map(product => (
                        <ProductCard key={product.id} product={product} onAddToCart={addToCart} />
                      ))}
                    </div>
                  </section>
                )}

                {/* Latest Products */}
                <section>
                  <div className="flex justify-between items-end mb-6">
                    <div>
                      <h2 className="text-2xl font-bold">Produk Terbaru</h2>
                      <p className="text-gray-500">Jangan lewatkan koleksi terbaru kami</p>
                    </div>
                    <Button variant="ghost" className="text-primary font-bold" onClick={() => setView('search')}>
                      Lihat Semua <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {products.slice(0, 8).map(product => (
                      <ProductCard key={product.id} product={product} onAddToCart={addToCart} />
                    ))}
                  </div>
                </section>
              </motion.div>
            )}

            {view === 'search' && (
              <motion.div 
                key="search"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-8"
              >
                <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                  <h2 className="text-2xl font-bold">Hasil Pencarian: {searchQuery || 'Semua Produk'}</h2>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500">{filteredProducts.length} produk ditemukan</span>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {filteredProducts.map(product => (
                    <ProductCard key={product.id} product={product} onAddToCart={addToCart} />
                  ))}
                </div>
                {filteredProducts.length === 0 && (
                  <div className="text-center py-20">
                    <Search className="w-16 h-16 mx-auto text-gray-200 mb-4" />
                    <h3 className="text-xl font-medium">Produk tidak ditemukan</h3>
                    <p className="text-gray-500 mt-2">Coba kata kunci lain atau periksa filter Anda</p>
                  </div>
                )}
              </motion.div>
            )}

            {view === 'profile' && user && (
              <motion.div 
                key="profile"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="max-w-4xl mx-auto"
              >
                <div className="flex items-center gap-6 mb-8">
                  <Avatar className="w-24 h-24 border-2 border-primary shadow-2xl">
                    <AvatarImage src={user.photoURL} />
                    <AvatarFallback>{user.displayName[0]}</AvatarFallback>
                  </Avatar>
                  <div>
                    <h2 className="text-3xl font-bold">{user.displayName}</h2>
                    <p className="text-gray-500">{user.email}</p>
                    <div className="flex gap-2 mt-2">
                      <Badge variant="secondary">{user.role === 'admin' ? 'Administrator' : 'Pembeli'}</Badge>
                      <Badge variant="outline">Member sejak {new Date(user.createdAt).getFullYear()}</Badge>
                    </div>
                  </div>
                  <Button variant="outline" className="ml-auto text-red-500 border-red-200 hover:bg-red-50" onClick={handleLogout}>
                    <LogOut className="w-4 h-4 mr-2" /> Logout
                  </Button>
                </div>

                <Tabs defaultValue="orders" className="w-full">
                  <TabsList className="grid w-full grid-cols-4 mb-8 bg-card border border-border p-1 rounded-sm">
                    <TabsTrigger value="orders" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-sm text-[10px] uppercase tracking-widest font-bold">Pesanan Saya</TabsTrigger>
                    <TabsTrigger value="settings" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-sm text-[10px] uppercase tracking-widest font-bold">Pengaturan</TabsTrigger>
                    {(user.role === 'seller' || user.role === 'admin') && <TabsTrigger value="seller" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-sm text-[10px] uppercase tracking-widest font-bold">Toko Saya</TabsTrigger>}
                    {user.role === 'admin' && <TabsTrigger value="admin" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-sm text-[10px] uppercase tracking-widest font-bold">Admin Panel</TabsTrigger>}
                  </TabsList>
                  
                    <TabsContent value="orders" className="space-y-4">
                    {orders.filter(o => o.userId === user?.uid).length === 0 ? (
                      <div className="text-center py-12 bg-white rounded-2xl border border-dashed">
                        <Package className="w-12 h-12 mx-auto text-gray-200 mb-4" />
                        <p className="text-gray-500">Belum ada riwayat pesanan</p>
                      </div>
                    ) : (
                      orders.filter(o => o.userId === user?.uid).map(order => (
                        <Card key={order.id}>
                          <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                              <CardTitle className="text-sm font-bold">Order #{order.id.slice(0, 8)}</CardTitle>
                              <CardDescription>{new Date(order.createdAt).toLocaleDateString()}</CardDescription>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge className={`rounded-sm text-[10px] uppercase tracking-widest ${
                                order.status === 'delivered' ? 'bg-green-500 text-white' : 
                                order.status === 'pending' ? 'bg-primary text-primary-foreground' : 
                                order.status === 'cancelled' ? 'bg-red-500 text-white' : 'bg-blue-500 text-white'
                              }`}>
                                {order.status.toUpperCase()}
                              </Badge>
                              {order.status === 'pending' && (
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="h-7 text-[10px] uppercase tracking-tighter text-red-500 hover:text-red-600 p-1"
                                  onClick={() => cancelOrder(order.id)}
                                >
                                  Batalkan
                                </Button>
                              )}
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-4">
                              <div className="space-y-2">
                                {order.items.map(item => (
                                  <div key={item.productId} className="flex justify-between text-sm">
                                    <span>{item.name} x{item.quantity}</span>
                                    <span>Rp {(item.price * item.quantity).toLocaleString()}</span>
                                  </div>
                                ))}
                                <Separator className="my-2" />
                                <div className="flex justify-between font-bold">
                                  <span>Total</span>
                                  <span>Rp {order.total.toLocaleString()}</span>
                                </div>
                              </div>
                              
                              <div className="bg-muted p-3 rounded-lg text-xs space-y-2">
                                <p className="font-bold flex items-center gap-2"><MapPin className="w-3 h-3" /> Alamat Pengiriman</p>
                                <p>{order.shippingAddress.name}</p>
                                <p>{order.shippingAddress.address}, {order.shippingAddress.city} {order.shippingAddress.zipCode}</p>
                              </div>

                              <div className="border border-primary/20 bg-primary/5 p-3 rounded-lg text-xs space-y-2">
                                <p className="font-bold flex items-center gap-2"><CreditCard className="w-3 h-3" /> Metode Pembayaran: {order.paymentMethod}</p>
                                {order.paymentMethod === 'Bank Transfer' && order.status === 'pending' && (
                                  <div className="mt-2 space-y-1">
                                    <p className="text-primary font-bold">Silakan transfer ke:</p>
                                    <p className="font-mono">BCA: 1234567890 a/n Devi's Market</p>
                                    <p className="opacity-70 italic text-[9px]">Kirim bukti transfer ke WhatsApp CS kami.</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </TabsContent>

                  <TabsContent value="settings">
                    <Card>
                      <CardHeader>
                        <CardTitle>Profil & Keamanan</CardTitle>
                        <CardDescription>Kelola informasi akun dan preferensi Anda</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid gap-2">
                          <label className="text-[10px] uppercase tracking-widest font-bold text-secondary-foreground">Nama Lengkap</label>
                          <Input 
                            id="profile-name"
                            defaultValue={user.displayName} 
                            className="bg-card border-border rounded-sm" 
                          />
                        </div>
                        <div className="grid gap-2">
                          <label className="text-[10px] uppercase tracking-widest font-bold text-secondary-foreground">Email</label>
                          <Input defaultValue={user.email} disabled className="bg-card border-border rounded-sm opacity-50" />
                        </div>
                        <div className="pt-4 border-t border-border mt-4">
                          <h4 className="text-sm font-bold mb-2">Status Akun</h4>
                          {user.role === 'user' ? (
                            <div className="bg-primary/5 border border-primary/20 p-4 rounded-lg">
                              <p className="text-sm text-secondary-foreground mb-4">Ingin mulai berjualan produk Anda sendiri di Devi's Market?</p>
                              <Button 
                                type="button"
                                disabled={isUpdating}
                                onClick={(e) => {
                                  e.preventDefault();
                                  becomeSeller();
                                }} 
                                className="bg-primary text-primary-foreground rounded-sm uppercase tracking-widest text-xs font-bold"
                              >
                                <Store className="w-4 h-4 mr-2" /> {isUpdating ? 'Memproses...' : 'Buka Toko Sekarang'}
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 text-primary">
                              <Store className="w-5 h-5" />
                              <span className="font-bold uppercase tracking-widest text-xs">Akun Penjual Aktif ({user.role})</span>
                            </div>
                          )}
                        </div>
                        <Button 
                          type="button"
                          disabled={isUpdating}
                          onClick={(e) => {
                            e.preventDefault();
                            const nameInput = document.getElementById('profile-name') as HTMLInputElement;
                            if (nameInput) updateProfile(nameInput.value);
                          }}
                          className="w-fit bg-primary text-primary-foreground rounded-sm uppercase tracking-widest text-xs font-bold"
                        >
                          {isUpdating ? 'Menyimpan...' : 'Simpan Perubahan'}
                        </Button>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {user.role === 'seller' && (
                    <TabsContent value="seller">
                      <SellerDashboard user={user} products={products} />
                    </TabsContent>
                  )}

                  {user.role === 'admin' && (
                    <TabsContent value="admin">
                      <AdminDashboard products={products} orders={orders} />
                    </TabsContent>
                  )}
                </Tabs>
              </motion.div>
            )}

            {['about', 'help', 'shipping', 'returns', 'privacy', 'guide', 'careers', 'blog'].includes(view) && (
              <StaticContent 
                view={view as any} 
                onBack={() => setView('home')} 
              />
            )}

            {view === 'orders' && (
              <motion.div 
                key="order-success"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center justify-center py-20 text-center"
              >
                <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <h2 className="text-3xl font-bold">Pesanan Berhasil!</h2>
                <p className="text-gray-500 mt-2 max-w-md">Terima kasih telah berbelanja di Devi's Market. Pesanan Anda sedang diproses dan akan segera dikirim.</p>
                <div className="flex gap-4 mt-8">
                  <Button variant="outline" onClick={() => setView('home')}>Kembali ke Beranda</Button>
                  <Button onClick={() => setView('profile')}>Lihat Pesanan Saya</Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        <Dialog open={isCheckoutOpen} onOpenChange={setIsCheckoutOpen}>
          <DialogContent className="max-w-md bg-card border-border">
            <DialogHeader>
              <DialogTitle className="font-heading">Penyelesaian Pesanan</DialogTitle>
            </DialogHeader>
            <div className="space-y-6 py-4">
              <div className="space-y-4">
                <h4 className="text-[10px] uppercase tracking-widest font-bold text-primary">Informasi Pengiriman</h4>
                <div className="space-y-3">
                  <Input 
                    placeholder="Nama Penerima" 
                    value={checkoutForm.name} 
                    onChange={e => setCheckoutForm({...checkoutForm, name: e.target.value})}
                  />
                  <Input 
                    placeholder="Alamat Lengkap" 
                    value={checkoutForm.address} 
                    onChange={e => setCheckoutForm({...checkoutForm, address: e.target.value})}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <Input 
                      placeholder="Kota" 
                      value={checkoutForm.city} 
                      onChange={e => setCheckoutForm({...checkoutForm, city: e.target.value})}
                    />
                    <Input 
                      placeholder="Kode Pos" 
                      value={checkoutForm.zipCode} 
                      onChange={e => setCheckoutForm({...checkoutForm, zipCode: e.target.value})}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-[10px] uppercase tracking-widest font-bold text-primary">Metode Pembayaran</h4>
                <div className="grid grid-cols-1 gap-2">
                  {[
                    { id: 'Bank Transfer', label: 'Transfer Bank (BCA Manual)', desc: 'Konfirmasi via WhatsApp' },
                    { id: 'E-Wallet', label: 'E-Wallet (GoPay/OVO)', desc: 'Scan QR Code saat pengiriman' },
                    { id: 'COD', label: 'Bayar di Tempat (COD)', desc: 'Bayar tunai kurir' }
                  ].map(method => (
                    <div 
                      key={method.id}
                      onClick={() => setCheckoutForm({...checkoutForm, paymentMethod: method.id})}
                      className={cn(
                        "p-3 rounded-lg border-2 cursor-pointer transition-all",
                        checkoutForm.paymentMethod === method.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                      )}
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-sm">{method.label}</span>
                        {checkoutForm.paymentMethod === method.id && <CheckCircle2 className="w-4 h-4 text-primary" />}
                      </div>
                      <p className="text-[10px] opacity-60 mt-1">{method.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              <div className="flex justify-between items-center font-bold">
                <span>Total Bayar</span>
                <span className="text-primary text-xl">Rp {cart.reduce((acc, i) => acc + i.price * i.quantity, 0).toLocaleString()}</span>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setIsCheckoutOpen(false)}>Batal</Button>
              <Button className="bg-primary text-primary-foreground px-8" onClick={processOrder}>Konfirmasi Pesanan</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isLoginDialogOpen} onOpenChange={setIsLoginDialogOpen}>
          <DialogContent className="max-w-md bg-card border-border">
            <DialogHeader>
              <DialogTitle className="font-heading text-center text-xl">Selamat Datang</DialogTitle>
              <CardDescription className="text-center">Pilih metode masuk ke Devi's Market</CardDescription>
            </DialogHeader>
            <div className="space-y-6 py-6">
              <Button 
                onClick={handleGoogleLogin}
                variant="outline"
                className="w-full flex items-center justify-center gap-3 py-6 border-border hover:bg-primary/5 transition-all"
              >
                <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
                <span className="font-bold">Masuk dengan Google</span>
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center"><Separator /></div>
                <div className="relative flex justify-center text-[10px] uppercase tracking-widest bg-card px-2 text-secondary-foreground font-bold">Atau Admin Login</div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest font-bold opacity-70">Username Admin</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-50" />
                    <Input 
                      placeholder="Username" 
                      className="pl-10" 
                      value={adminLoginForm.username}
                      onChange={e => setAdminLoginForm({...adminLoginForm, username: e.target.value})}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest font-bold opacity-70">Password</label>
                  <div className="relative">
                    <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-50" />
                    <Input 
                      type="password" 
                      placeholder="••••••••" 
                      className="pl-10"
                      value={adminLoginForm.password}
                      onChange={e => setAdminLoginForm({...adminLoginForm, password: e.target.value})}
                      onKeyDown={e => e.key === 'Enter' && handleAdminCredentialsLogin()}
                    />
                  </div>
                </div>
                <Button 
                  onClick={handleAdminCredentialsLogin}
                  disabled={isLoggingIn}
                  className="w-full bg-secondary text-secondary-foreground font-bold uppercase tracking-widest text-[10px] py-6 rounded-sm"
                >
                  {isLoggingIn ? 'Memproses...' : 'Masuk sebagai Admin'}
                </Button>
                <p className="text-[9px] text-center opacity-40 italic">Hanya untuk akses administrator terdaftar.</p>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Footer */}
        <footer className="bg-card border-t border-border pt-16 pb-8 mt-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
              <div className="col-span-1 md:col-span-2">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-sm overflow-hidden border border-primary/20 p-1 bg-white">
                    <img 
                      src="https://lh3.googleusercontent.com/d/1z-BPgCHshf4o0vueI9ZwlnakUnGgy3C3" 
                      alt="Devi's Market Logo" 
                      className="w-full h-full object-contain"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <span className="text-2xl font-heading font-bold tracking-[2px] uppercase">
                    <span className="teal-text">Devi's</span> <span className="brand-text">Market</span>
                  </span>
                </div>
                <p className="text-secondary-foreground max-w-sm">Marketplace terpercaya untuk produk lokal Indonesia. Mendukung UMKM dan pengrajin lokal untuk go digital.</p>
              </div>
              <div>
                <h4 className="font-heading font-bold mb-6 brand-text uppercase tracking-widest text-xs">Layanan Pelanggan</h4>
                <ul className="space-y-4 text-secondary-foreground text-sm font-medium">
                  <li onClick={() => setView('help')} className="hover:text-primary cursor-pointer transition-colors flex items-center gap-2">
                    <HelpCircle className="w-3 h-3" /> Pusat Bantuan
                  </li>
                  <li onClick={() => setView('guide')} className="hover:text-primary cursor-pointer transition-colors flex items-center gap-2">
                    <ChevronRight className="w-3 h-3" /> Cara Pembelian
                  </li>
                  <li onClick={() => setView('shipping')} className="hover:text-primary cursor-pointer transition-colors flex items-center gap-2">
                    <Truck className="w-3 h-3" /> Pengiriman
                  </li>
                  <li onClick={() => setView('returns')} className="hover:text-primary cursor-pointer transition-colors flex items-center gap-2">
                    <RefreshCw className="w-3 h-3" /> Pengembalian Barang
                  </li>
                </ul>
              </div>
              <div>
                <h4 className="font-heading font-bold mb-6 brand-text uppercase tracking-widest text-xs">Tentang Kami</h4>
                <ul className="space-y-4 text-secondary-foreground text-sm font-medium">
                  <li onClick={() => setView('about')} className="hover:text-primary cursor-pointer transition-colors flex items-center gap-2">
                    <Info className="w-3 h-3" /> Tentang Devi's Market
                  </li>
                  <li onClick={() => setView('careers')} className="hover:text-primary cursor-pointer transition-colors flex items-center gap-2">
                    <Briefcase className="w-3 h-3" /> Karir
                  </li>
                  <li onClick={() => setView('blog')} className="hover:text-primary cursor-pointer transition-colors flex items-center gap-2">
                    <BookOpen className="w-3 h-3" /> Blog
                  </li>
                  <li onClick={() => setView('privacy')} className="hover:text-primary cursor-pointer transition-colors flex items-center gap-2">
                    <ShieldCheck className="w-3 h-3" /> Kebijakan Privasi
                  </li>
                </ul>
              </div>
            </div>
            <Separator className="my-8 opacity-10" />
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-[10px] uppercase tracking-[2px] text-secondary-foreground">
              <p>© 2024 Devi's Market. All rights reserved.</p>
              <div className="flex gap-6">
                <span className="hover:text-foreground cursor-pointer transition-colors">Instagram</span>
                <span className="hover:text-foreground cursor-pointer transition-colors">Twitter</span>
                <span className="hover:text-foreground cursor-pointer transition-colors">Facebook</span>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </ErrorBoundary>
  );
}

interface ProductCardProps {
  key?: React.Key;
  product: Product;
  onAddToCart: (p: Product) => void;
}

function ProductCard({ product, onAddToCart }: ProductCardProps) {
  return (
    <Card className="group overflow-hidden border border-border hover:brand-border transition-all duration-300 bg-card rounded-md">
      <div className="relative aspect-square overflow-hidden bg-[#1a1a1a]">
        <img 
          src={product.images?.[0] || `https://picsum.photos/seed/${product.id}/400/400`} 
          alt={product.name} 
          className="w-full h-full object-cover group-hover:opacity-80 transition-opacity duration-500"
          referrerPolicy="no-referrer"
        />
        <div className="absolute top-3 left-3">
          <Badge className="bg-background/90 backdrop-blur-sm text-foreground border border-border font-bold rounded-sm text-[10px] uppercase tracking-wider">{product.category}</Badge>
        </div>
        <div className="absolute inset-0 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button size="icon" className="rounded-full w-12 h-12 shadow-2xl" onClick={() => onAddToCart(product)}>
            <ShoppingCart className="w-5 h-5" />
          </Button>
        </div>
      </div>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-heading font-bold text-lg line-clamp-1 group-hover:brand-text transition-colors">{product.name}</h3>
          <div className="flex items-center gap-1 brand-text">
            <Star className="w-3 h-3 fill-current" />
            <span className="text-xs font-bold">{product.avgRating || '4.8'}</span>
          </div>
        </div>
        <p className="text-xs text-secondary-foreground line-clamp-2 mt-1 h-8">{product.description}</p>
        <div className="flex items-center justify-between mt-4">
          <span className="text-lg font-bold brand-text">Rp {product.price.toLocaleString()}</span>
          <span className="text-[10px] uppercase tracking-widest text-secondary-foreground">{product.stock} in stock</span>
        </div>
      </CardContent>
    </Card>
  );
}

function AdminDashboard({ products, orders }: { products: Product[], orders: Order[] }) {
  const [heroEdit, setHeroEdit] = useState<HeroContent | null>(null);
  const [isSavingHero, setIsSavingHero] = useState(false);

  useEffect(() => {
    const fetchHero = async () => {
      const snap = await getDoc(doc(db, 'settings', 'hero'));
      if (snap.exists()) setHeroEdit(snap.data() as HeroContent);
      else setHeroEdit({
        title: "Koleksi Warisan Devi's",
        subtitle: "Temukan keindahan abadi dalam setiap detail kerajinan tangan terbaik Indonesia.",
        ctaText: "Lihat Koleksi",
        imageUrl: "https://picsum.photos/seed/hero/1200/600"
      });
    };
    fetchHero();
  }, []);

  const handleSaveHero = async () => {
    if (!heroEdit) return;
    setIsSavingHero(true);
    try {
      await setDoc(doc(db, 'settings', 'hero'), {
        ...heroEdit,
        updatedAt: new Date().toISOString()
      });
      toast.success('Konten Hero berhasil diperbarui!');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'settings/hero');
    } finally {
      setIsSavingHero(false);
    }
  };

  const deleteOrder = async (orderId: string) => {
    if (!window.confirm('Admin, Anda yakin ingin MENGHAPUS PERMANEN pesanan ini?')) return;
    try {
      await deleteDoc(doc(db, 'orders', orderId));
      toast.success('Pesanan berhasil dihapus secara permanen');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `orders/${orderId}`);
    }
  };

  const updateOrderStatus = async (orderId: string, status: Order['status']) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), { 
        status,
        updatedAt: new Date().toISOString()
      });
      toast.success(`Status pesanan diperbarui menjadi ${status}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `orders/${orderId}`);
    }
  };

  const deleteProduct = async (productId: string) => {
    if (!window.confirm('Admin, Anda yakin ingin MENGHAPUS produk ini dari platform?')) return;
    try {
      await deleteDoc(doc(db, 'products', productId));
      toast.success('Produk berhasil dihapus dari platform');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `products/${productId}`);
    }
  };

  const stats = useMemo(() => {
    const totalRevenue = orders.filter(o => o.status !== 'cancelled').reduce((acc, o) => acc + o.total, 0);
    const lowStock = products.filter(p => p.stock < 10);
    return { totalRevenue, lowStock };
  }, [products, orders]);

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-primary text-black border-none shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] uppercase tracking-widest font-bold opacity-70">Total Pendapatan Platform</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-heading font-bold">Rp {stats.totalRevenue.toLocaleString()}</div>
            <p className="text-[10px] mt-1 opacity-60 uppercase tracking-tighter">Seluruh transaksi platform</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] uppercase tracking-widest font-bold text-secondary-foreground">Total Pesanan</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-heading font-bold brand-text">{orders.length}</div>
            <p className="text-[10px] mt-1 text-green-500 uppercase tracking-tighter">Pesanan masuk hari ini</p>
          </CardContent>
        </Card>
        <Card className={stats.lowStock.length > 0 ? 'border-red-900/50 bg-red-950/20' : 'bg-card border-border'}>
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] uppercase tracking-widest font-bold text-secondary-foreground">Stok Menipis</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-heading font-bold flex items-center gap-2 brand-text">
              {stats.lowStock.length}
              {stats.lowStock.length > 0 && <AlertTriangle className="w-5 h-5 text-red-500" />}
            </div>
            <p className="text-[10px] mt-1 text-secondary-foreground uppercase tracking-tighter">Produk platform &lt; 10</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle>Manajemen Konten Hero</CardTitle>
            <CardDescription>Ubah tampilan utama halaman depan</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {heroEdit && (
              <>
                <div className="grid gap-2">
                  <label className="text-[10px] uppercase tracking-widest font-bold">Judul Utama</label>
                  <Input value={heroEdit.title} onChange={e => setHeroEdit({...heroEdit, title: e.target.value})} className="bg-background border-border" />
                </div>
                <div className="grid gap-2">
                  <label className="text-[10px] uppercase tracking-widest font-bold">Sub-judul</label>
                  <textarea 
                    value={heroEdit.subtitle} 
                    onChange={e => setHeroEdit({...heroEdit, subtitle: e.target.value})}
                    className="w-full bg-background border border-border rounded-sm p-2 text-sm h-20"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <label className="text-[10px] uppercase tracking-widest font-bold">Teks Tombol (CTA)</label>
                    <Input value={heroEdit.ctaText} onChange={e => setHeroEdit({...heroEdit, ctaText: e.target.value})} className="bg-background border-border" />
                  </div>
                  <div className="grid gap-2">
                    <label className="text-[10px] uppercase tracking-widest font-bold">URL Gambar</label>
                    <Input value={heroEdit.imageUrl} onChange={e => setHeroEdit({...heroEdit, imageUrl: e.target.value})} className="bg-background border-border" />
                  </div>
                </div>
                <Button 
                  onClick={handleSaveHero} 
                  disabled={isSavingHero}
                  className="w-full bg-primary text-primary-foreground font-bold uppercase tracking-widest text-xs py-6"
                >
                  {isSavingHero ? 'Menyimpan...' : 'Perbarui Konten Hero'}
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pesanan Terbaru</CardTitle>
            <CardDescription>Kelola pesanan masuk platform</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {orders.slice(0, 10).map(order => (
                <div key={order.id} className="flex items-center justify-between p-3 bg-card/50 rounded-lg border border-border">
                  <div className="flex-1">
                    <p className="font-bold text-sm">#{order.id.slice(0, 8)}</p>
                    <p className="text-[10px] text-secondary-foreground">{new Date(order.createdAt).toLocaleString()}</p>
                    <div className="flex items-center gap-2 mt-2">
                       <select 
                        value={order.status} 
                        onChange={(e) => updateOrderStatus(order.id, e.target.value as any)}
                        className="bg-background text-[10px] border border-border rounded p-1 uppercase tracking-widest"
                      >
                        <option value="pending">PENDING</option>
                        <option value="processing">PROCESSING</option>
                        <option value="shipped">SHIPPED</option>
                        <option value="delivered">DELIVERED</option>
                        <option value="cancelled">CANCELLED</option>
                      </select>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6 text-red-500 hover:text-red-600"
                        onClick={() => deleteOrder(order.id)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold brand-text">Rp {order.total.toLocaleString()}</p>
                    <Badge variant="outline" className={`text-[8px] uppercase ${order.status === 'cancelled' ? 'border-red-500 text-red-500' : ''}`}>
                      {order.status}
                    </Badge>
                  </div>
                </div>
              ))}
              {orders.length === 0 && <p className="text-center text-sm text-secondary-foreground py-4">Belum ada pesanan.</p>}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Produk Terpopuler</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {products.slice(0, 5).map(product => (
                <div key={product.id} className="flex items-center gap-4">
                  <img src={product.images[0]} className="w-10 h-10 rounded object-cover" />
                  <div className="flex-1">
                    <p className="font-bold text-sm">{product.name}</p>
                    <p className="text-xs text-secondary-foreground">{product.category}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold brand-text">{product.avgRating} ★</p>
                    <p className="text-xs text-secondary-foreground">{product.stock} stok</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Seluruh Inventaris Platform</CardTitle>
              <CardDescription>Monitor dan moderasi semua produk yang diupload penjual</CardDescription>
            </div>
            <Badge variant="outline">{products.length} Produk Total</Badge>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {products.map(product => (
                  <div key={product.id} className="flex items-center gap-4 p-3 bg-card border border-border rounded-lg group">
                    <div className="w-16 h-16 rounded overflow-hidden flex-shrink-0">
                      <img src={product.images[0]} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm truncate">{product.name}</p>
                      <p className="text-[10px] text-primary font-medium tracking-widest uppercase">{product.category}</p>
                      <p className="text-[10px] text-secondary-foreground mt-1">Penjual: {product.sellerName}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="secondary" className="text-[8px]">{product.stock} Stok</Badge>
                        <Badge variant="secondary" className="text-[8px]">Rp {product.price.toLocaleString()}</Badge>
                      </div>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-600 transition-opacity"
                      onClick={() => deleteProduct(product.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
              {products.length === 0 && (
                <div className="text-center py-20 text-secondary-foreground font-heading uppercase tracking-widest text-xs opacity-50">
                  Belum ada produk di platform
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SellerDashboard({ user, products }: { user: UserProfile, products: Product[] }) {
  const myProducts = products.filter(p => p.sellerId === user.uid || user.role === 'admin');
  const [isAdding, setIsAdding] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [productForm, setProductForm] = useState({
    name: '',
    description: '',
    price: 0,
    stock: 0,
    category: 'Fashion',
    images: ['https://picsum.photos/seed/new/400/400']
  });

  const handleOpenAdd = () => {
    setProductForm({
      name: '',
      description: '',
      price: 0,
      stock: 0,
      category: 'Fashion',
      images: ['https://picsum.photos/seed/new/400/400']
    });
    setEditingProduct(null);
    setIsAdding(true);
  };

  const handleOpenEdit = (product: Product) => {
    setProductForm({
      name: product.name,
      description: product.description,
      price: product.price,
      stock: product.stock,
      category: product.category,
      images: product.images
    });
    setEditingProduct(product);
    setIsAdding(true);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      if (editingProduct) {
        await updateDoc(doc(db, 'products', editingProduct.id), {
          ...productForm,
          updatedAt: new Date().toISOString()
        });
        toast.success('Produk berhasil diperbarui!');
      } else {
        const productData = {
          ...productForm,
          sellerId: user.uid,
          sellerName: user.displayName,
          avgRating: 0,
          reviewCount: 0,
          createdAt: new Date().toISOString()
        };
        await addDoc(collection(db, 'products'), productData);
        toast.success('Produk berhasil ditambahkan!');
      }
      setIsAdding(false);
    } catch (error) {
      handleFirestoreError(error, editingProduct ? OperationType.UPDATE : OperationType.CREATE, 'products');
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!productToDelete) return;
    setIsSubmitting(true);
    try {
      await deleteDoc(doc(db, 'products', productToDelete.id));
      toast.success('Produk berhasil dihapus!');
      setProductToDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'products');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-2xl font-heading font-bold">Manajemen Produk</h3>
          <p className="text-secondary-foreground text-sm">Kelola inventaris toko Anda</p>
        </div>
        <Button onClick={handleOpenAdd} className="bg-primary text-primary-foreground rounded-sm uppercase tracking-widest text-xs font-bold">
          <Plus className="w-4 h-4 mr-2" /> Tambah Produk
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {myProducts.map(product => (
          <Card key={product.id} className="bg-card border-border overflow-hidden group">
            <div className="aspect-video relative overflow-hidden">
              <img src={product.images[0]} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <Button size="icon" variant="secondary" className="rounded-full" onClick={() => handleOpenEdit(product)}><Edit className="w-4 h-4" /></Button>
                <Button size="icon" variant="destructive" className="rounded-full" onClick={() => setProductToDelete(product)}><Trash2 className="w-4 h-4" /></Button>
              </div>
            </div>
            <CardContent className="p-4">
              <h4 className="font-bold line-clamp-1">{product.name}</h4>
              <div className="flex justify-between items-center mt-2">
                <span className="brand-text font-bold">Rp {product.price.toLocaleString()}</span>
                <Badge variant="outline" className="text-[10px]">{product.stock} Stok</Badge>
              </div>
            </CardContent>
          </Card>
        ))}
        {myProducts.length === 0 && (
          <div className="col-span-full py-20 text-center border border-dashed border-border rounded-xl">
            <Store className="w-12 h-12 mx-auto text-secondary-foreground/20 mb-4" />
            <p className="text-secondary-foreground">Anda belum memiliki produk. Mulai berjualan sekarang!</p>
          </div>
        )}
      </div>

      <Dialog open={isAdding} onOpenChange={setIsAdding}>
        <DialogContent className="bg-card border-border text-foreground">
          <DialogHeader>
            <DialogTitle className="font-heading">{editingProduct ? 'Edit Produk' : 'Tambah Produk Baru'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid gap-2">
              <label className="text-[10px] uppercase tracking-widest font-bold">Nama Produk</label>
              <Input value={productForm.name} onChange={e => setProductForm({...productForm, name: e.target.value})} className="bg-background border-border" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <label className="text-[10px] uppercase tracking-widest font-bold">Harga (Rp)</label>
                <Input type="number" value={productForm.price} onChange={e => setProductForm({...productForm, price: Number(e.target.value)})} className="bg-background border-border" />
              </div>
              <div className="grid gap-2">
                <label className="text-[10px] uppercase tracking-widest font-bold">Stok</label>
                <Input type="number" value={productForm.stock} onChange={e => setProductForm({...productForm, stock: Number(e.target.value)})} className="bg-background border-border" />
              </div>
            </div>
            <div className="grid gap-2">
              <label className="text-[10px] uppercase tracking-widest font-bold">Kategori</label>
              <select 
                value={productForm.category} 
                onChange={e => setProductForm({...productForm, category: e.target.value})}
                className="w-full bg-background border border-border rounded-sm p-2 text-sm"
              >
                {CATEGORIES.map(c => (
                  <option key={c.name} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <label className="text-[10px] uppercase tracking-widest font-bold">Deskripsi</label>
              <textarea 
                value={productForm.description} 
                onChange={e => setProductForm({...productForm, description: e.target.value})}
                className="w-full bg-background border border-border rounded-sm p-2 text-sm h-24"
              />
            </div>
             <div className="grid gap-2">
              <label className="text-[10px] uppercase tracking-widest font-bold">URL Gambar</label>
              <Input value={productForm.images[0]} onChange={e => setProductForm({...productForm, images: [e.target.value]})} className="bg-background border-border" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsAdding(false)}>Batal</Button>
            <Button onClick={handleSubmit} disabled={isSubmitting} className="bg-primary text-primary-foreground">{editingProduct ? 'Simpan Perubahan' : 'Simpan Produk'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!productToDelete} onOpenChange={(open) => !open && setProductToDelete(null)}>
        <DialogContent className="bg-card border-border text-foreground">
          <DialogHeader>
            <DialogTitle className="font-heading">Hapus Produk</DialogTitle>
          </DialogHeader>
          <div className="py-6">
            <p>Apakah Anda yakin ingin menghapus <strong>{productToDelete?.name}</strong>? Tindakan ini tidak dapat dibatalkan.</p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setProductToDelete(null)}>Batal</Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={isSubmitting}>
              {isSubmitting ? 'Menghapus...' : 'Ya, Hapus Produk'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
